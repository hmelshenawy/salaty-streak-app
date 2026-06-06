import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { startOfDay, differenceInDays, subDays } from 'date-fns';
import { getTodayInTimezone } from '../common/utils/date.utils';

export interface StreakResult {
  currentStreak: number;
  bestStreak: number;
}

export interface StreakComparisonLog {
  userId: string;
  date: string;
  oldCurrentStreak: number;
  newCurrentStreak: number;
  oldBestStreak: number;
  newBestStreak: number;
  currentDifference: number;
  bestDifference: number;
  timestamp: string;
}

@Injectable()
export class StreaksService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  /**
   * Calculate current and best streaks for a user.
   * A streak day is achieved when all 5 prayers are completed (isStreakDay = true).
   * Walks backwards from today to count consecutive streak days.
   *
   * Feature flag: USE_NEW_STREAK_ENGINE — when true, delegates to PrayerLog-based calculation.
   */
  async calculateStreaks(userId: string): Promise<StreakResult> {
    const useNewEngine = this.configService.get('USE_NEW_STREAK_ENGINE') === 'true';
    if (useNewEngine) {
      return this.calculateStreaksFromPrayerLogs(userId);
    }
    const summaries = await this.prisma.dailySummary.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
    });

    if (summaries.length === 0) {
      return { currentStreak: 0, bestStreak: 0 };
    }

    // Build a Set of dates that are streak days for O(1) lookup
    const streakDaySet = new Set<string>();
    const summaryMap = new Map<string, boolean>();

    for (const summary of summaries) {
      const dateKey = startOfDay(summary.date).toISOString().split('T')[0];
      summaryMap.set(dateKey, summary.isStreakDay);
      if (summary.isStreakDay) {
        streakDaySet.add(dateKey);
      }
    }

    // Calculate current streak
    const today = startOfDay(new Date());
    let currentStreak = 0;
    let checkDate = today;

    // If today doesn't have a summary yet, start checking from yesterday
    const todayKey = today.toISOString().split('T')[0];
    if (!summaryMap.has(todayKey)) {
      checkDate = subDays(today, 1);
    }

    // Walk backwards counting consecutive streak days
    while (true) {
      const dateKey = checkDate.toISOString().split('T')[0];
      const isStreak = summaryMap.get(dateKey);

      if (isStreak === true) {
        currentStreak++;
        checkDate = subDays(checkDate, 1);
      } else {
        // If no summary exists for this day, the streak is broken
        // If isStreak is false, the streak is also broken
        break;
      }
    }

    // Calculate best streak
    const sortedDates = Array.from(streakDaySet).sort();
    let bestStreak = 0;
    let currentBest = sortedDates.length > 0 ? 1 : 0;

    for (let i = 1; i < sortedDates.length; i++) {
      const prevDate = new Date(sortedDates[i - 1]);
      const currDate = new Date(sortedDates[i]);
      const diff = differenceInDays(currDate, prevDate);

      if (diff === 1) {
        currentBest++;
      } else {
        bestStreak = Math.max(bestStreak, currentBest);
        currentBest = 1;
      }
    }
    bestStreak = Math.max(bestStreak, currentBest);

    // If currentStreak > 0 and bestStreak hasn't been set yet
    if (bestStreak === 0 && currentStreak > 0) {
      bestStreak = currentStreak;
    }

    return { currentStreak, bestStreak };
  }

  /**
   * Calculate streaks directly from PrayerLog records.
   * A day is "complete" (streak day) when all 5 prayers have status ON_TIME or LATE.
   */
  async calculateStreaksFromPrayerLogs(userId: string): Promise<StreakResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });

    const timezone = user?.timezone ?? 'Asia/Dubai';

    // Fetch all prayer logs for the user, ordered by date desc
    const logs = await this.prisma.prayerLog.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      select: { date: true, prayerName: true, status: true },
    });

    if (logs.length === 0) {
      return { currentStreak: 0, bestStreak: 0 };
    }

    // Group logs by date and determine if each day is a streak day
    const dayMap = new Map<string, Set<string>>();

    for (const log of logs) {
      const dateKey = startOfDay(log.date).toISOString().split('T')[0];
      if (!dayMap.has(dateKey)) {
        dayMap.set(dateKey, new Set());
      }
      if (log.status !== 'MISSED') {
        dayMap.get(dateKey)!.add(log.prayerName);
      }
    }

    const streakDaySet = new Set<string>();
    for (const [dateKey, prayers] of dayMap.entries()) {
      if (prayers.size === 5) {
        streakDaySet.add(dateKey);
      }
    }

    // Calculate current streak
    const today = getTodayInTimezone(timezone);
    const todayKey = startOfDay(today).toISOString().split('T')[0];
    let currentStreak = 0;
    let checkDate = dayMap.has(todayKey) ? today : subDays(today, 1);

    while (true) {
      const dateKey = startOfDay(checkDate).toISOString().split('T')[0];
      if (streakDaySet.has(dateKey)) {
        currentStreak++;
        checkDate = subDays(checkDate, 1);
      } else {
        break;
      }
    }

    // Calculate best streak
    const sortedDates = Array.from(streakDaySet).sort();
    let bestStreak = 0;
    let currentBest = sortedDates.length > 0 ? 1 : 0;

    for (let i = 1; i < sortedDates.length; i++) {
      const prevDate = new Date(sortedDates[i - 1]);
      const currDate = new Date(sortedDates[i]);
      const diff = differenceInDays(currDate, prevDate);

      if (diff === 1) {
        currentBest++;
      } else {
        bestStreak = Math.max(bestStreak, currentBest);
        currentBest = 1;
      }
    }
    bestStreak = Math.max(bestStreak, currentBest);

    if (bestStreak === 0 && currentStreak > 0) {
      bestStreak = currentStreak;
    }

    return { currentStreak, bestStreak };
  }

  /**
   * Compare old (DailySummary-based) and new (PrayerLog-based) streak calculations.
   * Logs structured mismatch data when differences are detected.
   * Enabled only when ENABLE_STREAK_COMPARISON=true.
   */
  async compareStreakCalculations(userId: string): Promise<StreakComparisonLog | null> {
    const enabled = process.env.ENABLE_STREAK_COMPARISON === 'true';
    if (!enabled) {
      return null;
    }

    const oldResult = await this.calculateStreaks(userId);
    const newResult = await this.calculateStreaksFromPrayerLogs(userId);

    const currentDifference = oldResult.currentStreak - newResult.currentStreak;
    const bestDifference = oldResult.bestStreak - newResult.bestStreak;

    const logEntry: StreakComparisonLog = {
      userId,
      date: new Date().toISOString().split('T')[0],
      oldCurrentStreak: oldResult.currentStreak,
      newCurrentStreak: newResult.currentStreak,
      oldBestStreak: oldResult.bestStreak,
      newBestStreak: newResult.bestStreak,
      currentDifference,
      bestDifference,
      timestamp: new Date().toISOString(),
    };

    if (currentDifference !== 0 || bestDifference !== 0) {
      console.warn('[STREAK_MISMATCH]', JSON.stringify(logEntry));
    } else {
      console.log('[STREAK_MATCH]', JSON.stringify(logEntry));
    }

    return logEntry;
  }
}