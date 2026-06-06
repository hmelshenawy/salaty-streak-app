import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { StreaksService } from '../streaks/streaks.service';
import { MilestonesService } from '../milestones/milestones.service';
import { PrayerTimesService } from '../prayer-times/prayer-times.service';
import { PointsService } from '../points/points.service';
import { AwardsService } from '../awards/awards.service';
import { getTodayInTimezone, getMonthRange } from '../common/utils/date.utils';
import { PrayerName } from '@prisma/client';

const ALL_PRAYERS: PrayerName[] = [
  'FAJR',
  'DHUHR',
  'ASR',
  'MAGHRIB',
  'ISHA',
];

export interface DashboardComparisonLog {
  userId: string;
  date: string;
  field: string;
  oldValue: unknown;
  newValue: unknown;
  difference: unknown;
  timestamp: string;
}

export interface DashboardResult {
  currentStreak: number;
  bestStreak: number;
  monthlyPoints: number;
  completionRate: number;
  todayPrayers: {
    prayerName: PrayerName;
    status: string | null;
    inMosque: boolean;
    points: number;
    prayedAt: Date | null;
    prayerTime: string | null;
    prayerTimestamp: Date | null;
    endTime: Date | null;
    windowMinutes: number;
    periods: { label: string; startOffset: number; endOffset: number }[];
  }[];
  nextMilestone: {
    title: string;
    targetDays: number;
    remainingDays: number;
  };
  prayerTimes: {
    prayerName: PrayerName;
    time: string;
    timestamp: Date;
    endTime: Date;
    windowMinutes: number;
  }[];
}

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    private streaksService: StreaksService,
    private milestonesService: MilestonesService,
    private prayerTimesService: PrayerTimesService,
    private pointsService: PointsService,
    private awardsService: AwardsService,
    private configService: ConfigService,
  ) {}

  /**
   * Primary dashboard endpoint.
   *
   * Feature flag: USE_NEW_DASHBOARD_ENGINE — when true, delegates to PrayerLog-derived aggregation.
   */
  async getDashboard(userId: string) {
    const useNewEngine = this.configService.get('USE_NEW_DASHBOARD_ENGINE') === 'true';
    if (useNewEngine) {
      return this.getDashboardFromNewServices(userId);
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true, latitude: true, longitude: true },
    });

    const timezone = user?.timezone ?? 'Asia/Dubai';
    const today = getTodayInTimezone(timezone);

    // Get streaks
    const { currentStreak, bestStreak } =
      await this.streaksService.calculateStreaks(userId);

    // Get monthly points
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const { start, end } = getMonthRange(timezone, year, month);

    const monthlySummary = await this.prisma.dailySummary.aggregate({
      where: {
        userId,
        date: { gte: start, lte: end },
      },
      _sum: { totalPoints: true },
    });

    const monthlyPoints = monthlySummary._sum.totalPoints ?? 0;

    // Get completion rate
    const totalDaysThisMonth =
      differenceInDays(end, start) + 1;
    const completedDays = await this.prisma.dailySummary.count({
      where: {
        userId,
        date: { gte: start, lte: end },
        isStreakDay: true,
      },
    });

    const completionRate =
      totalDaysThisMonth > 0
        ? Math.round((completedDays / totalDaysThisMonth) * 100 * 100) / 100
        : 0;

    // Get today's prayers
    const todayLogs = await this.prisma.prayerLog.findMany({
      where: { userId, date: today },
    });

    // Get prayer times
    const prayerTimes = await this.prayerTimesService.getPrayerTimes(
      userId,
      timezone,
      user?.latitude ?? undefined,
      user?.longitude ?? undefined,
    );

    const todayPrayers = ALL_PRAYERS.map((prayerName) => {
      const log = todayLogs.find((l) => l.prayerName === prayerName);
      const prayerTime = prayerTimes.times.find((t) => t.prayerName === prayerName);
      const windowMinutes = prayerTime?.windowMinutes ?? 0;
      return {
        prayerName,
        status: log?.status ?? null,
        inMosque: log?.inMosque ?? false,
        points: log?.points ?? 0,
        prayedAt: log?.prayedAt ?? null,
        prayerTime: prayerTime?.time ?? null,
        prayerTimestamp: prayerTime?.timestamp ?? null,
        endTime: prayerTime?.endTime ?? null,
        windowMinutes,
        periods: windowMinutes > 0
          ? [
              { label: 'early', startOffset: 0, endOffset: Math.round(windowMinutes * 0.35) },
              { label: 'mid', startOffset: Math.round(windowMinutes * 0.35), endOffset: Math.round(windowMinutes * 0.75) },
              { label: 'late', startOffset: Math.round(windowMinutes * 0.75), endOffset: windowMinutes },
            ]
          : [],
      };
    });

    // Get next milestone
    const nextMilestone = await this.milestonesService.getNextMilestone(userId);

    return {
      currentStreak,
      bestStreak,
      monthlyPoints,
      completionRate,
      todayPrayers,
      nextMilestone,
      prayerTimes: prayerTimes.times.map((t) => ({
        prayerName: t.prayerName,
        time: t.time,
        timestamp: t.timestamp,
        endTime: t.endTime,
        windowMinutes: t.windowMinutes,
      })),
    };
  }

  /**
   * Assemble dashboard data from new services (PrayerLog-derived).
   * INTERNAL ONLY — not exposed as the primary dashboard endpoint.
   * Returns the same shape as getDashboard() for comparison purposes.
   */
  async getDashboardFromNewServices(userId: string): Promise<DashboardResult> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true, latitude: true, longitude: true },
    });

    const timezone = user?.timezone ?? 'Asia/Dubai';
    const today = getTodayInTimezone(timezone);

    // Get streaks from PrayerLogs
    const { currentStreak, bestStreak } =
      await this.streaksService.calculateStreaksFromPrayerLogs(userId);

    // Get monthly points from PointTransaction ledger
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const { start, end } = getMonthRange(timezone, year, month);

    const monthlyTxs = await this.prisma.pointTransaction.findMany({
      where: {
        userId,
        relatedDate: { gte: start, lte: end },
      },
    });
    const monthlyPoints = monthlyTxs.reduce((sum, t) => sum + t.points, 0);

    // Completion rate: count complete days from PrayerLogs
    const monthLogs = await this.prisma.prayerLog.findMany({
      where: {
        userId,
        date: { gte: start, lte: end },
      },
      select: { date: true, status: true },
    });

    const dayMap = new Map<string, number>();
    for (const log of monthLogs) {
      const dateKey = log.date.toISOString().split('T')[0];
      const count = dayMap.get(dateKey) ?? 0;
      if (log.status !== 'MISSED') {
        dayMap.set(dateKey, count + 1);
      }
    }

    const totalDaysThisMonth = differenceInDays(end, start) + 1;
    const completedDays = Array.from(dayMap.values()).filter((c) => c === 5).length;
    const completionRate =
      totalDaysThisMonth > 0
        ? Math.round((completedDays / totalDaysThisMonth) * 100 * 100) / 100
        : 0;

    // Today's prayers
    const todayLogs = await this.prisma.prayerLog.findMany({
      where: { userId, date: today },
    });

    const prayerTimes = await this.prayerTimesService.getPrayerTimes(
      userId,
      timezone,
      user?.latitude ?? undefined,
      user?.longitude ?? undefined,
    );

    const todayPrayers = ALL_PRAYERS.map((prayerName) => {
      const log = todayLogs.find((l) => l.prayerName === prayerName);
      const prayerTime = prayerTimes.times.find((t) => t.prayerName === prayerName);
      const windowMinutes = prayerTime?.windowMinutes ?? 0;
      return {
        prayerName,
        status: log?.status ?? null,
        inMosque: log?.inMosque ?? false,
        points: log?.points ?? 0,
        prayedAt: log?.prayedAt ?? null,
        prayerTime: prayerTime?.time ?? null,
        prayerTimestamp: prayerTime?.timestamp ?? null,
        endTime: prayerTime?.endTime ?? null,
        windowMinutes,
        periods: windowMinutes > 0
          ? [
              { label: 'early', startOffset: 0, endOffset: Math.round(windowMinutes * 0.35) },
              { label: 'mid', startOffset: Math.round(windowMinutes * 0.35), endOffset: Math.round(windowMinutes * 0.75) },
              { label: 'late', startOffset: Math.round(windowMinutes * 0.75), endOffset: windowMinutes },
            ]
          : [],
      };
    });

    // Next milestone from AwardsService
    const awardsResult = await this.awardsService.getAwards(userId);
    const nextMilestone = awardsResult.nextTarget
      ? {
          title: awardsResult.nextTarget.title,
          targetDays: awardsResult.nextTarget.milestone,
          remainingDays: awardsResult.nextTarget.remainingDays,
        }
      : await this.milestonesService.getNextMilestone(userId);

    return {
      currentStreak,
      bestStreak,
      monthlyPoints,
      completionRate,
      todayPrayers,
      nextMilestone,
      prayerTimes: prayerTimes.times.map((t) => ({
        prayerName: t.prayerName,
        time: t.time,
        timestamp: t.timestamp,
        endTime: t.endTime,
        windowMinutes: t.windowMinutes,
      })),
    };
  }

  /**
   * Run both old and new dashboard calculations and log any mismatches.
   * Enabled only when ENABLE_DASHBOARD_COMPARISON=true.
   */
  async compareDashboardCalculations(userId: string): Promise<{
    mismatches: DashboardComparisonLog[];
    oldResult: DashboardResult;
    newResult: DashboardResult;
  }> {
    const enabled = process.env.ENABLE_DASHBOARD_COMPARISON === 'true';
    if (!enabled) {
      throw new Error('Dashboard comparison is disabled. Set ENABLE_DASHBOARD_COMPARISON=true to enable.');
    }

    const oldResult = await this.getDashboard(userId);
    const newResult = await this.getDashboardFromNewServices(userId);

    const mismatches: DashboardComparisonLog[] = [];
    const now = new Date().toISOString();
    const today = new Date().toISOString().split('T')[0];

    const compareField = (field: string, oldValue: unknown, newValue: unknown) => {
      const difference =
        typeof oldValue === 'number' && typeof newValue === 'number'
          ? oldValue - newValue
          : oldValue !== newValue
            ? 'MISMATCH'
            : 0;

      if (oldValue !== newValue) {
        const logEntry: DashboardComparisonLog = {
          userId,
          date: today,
          field,
          oldValue,
          newValue,
          difference,
          timestamp: now,
        };
        mismatches.push(logEntry);
        console.warn('[DASHBOARD_MISMATCH]', JSON.stringify(logEntry));
      }
    };

    compareField('currentStreak', oldResult.currentStreak, newResult.currentStreak);
    compareField('bestStreak', oldResult.bestStreak, newResult.bestStreak);
    compareField('monthlyPoints', oldResult.monthlyPoints, newResult.monthlyPoints);
    compareField('completionRate', oldResult.completionRate, newResult.completionRate);

    if (mismatches.length === 0) {
      console.log('[DASHBOARD_MATCH]', JSON.stringify({ userId, date: today, timestamp: now }));
    }

    return { mismatches, oldResult, newResult };
  }
}

// Helper for date difference
function differenceInDays(dateLeft: Date, dateRight: Date): number {
  const msPerDay = 86400000;
  return Math.round(
    (dateLeft.getTime() - dateRight.getTime()) / msPerDay,
  );
}