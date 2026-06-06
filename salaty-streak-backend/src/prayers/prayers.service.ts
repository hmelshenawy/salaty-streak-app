import {
  Injectable,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePrayerLogDto } from './dto/create-prayer-log.dto';
import { UpdatePrayerLogDto } from './dto/update-prayer-log.dto';
import { calculatePrayerPoints } from './utils/points-calculator';
import { getTodayInTimezone, getMonthRange, parseDateString } from '../common/utils/date.utils';
import { DailySummaryService } from '../daily-summary/daily-summary.service';
import { MilestonesService } from '../milestones/milestones.service';
import { PointsService } from '../points/points.service';
import { AwardsService } from '../awards/awards.service';
import { StreaksService } from '../streaks/streaks.service';
import { PrayerName, PointReason } from '@prisma/client';
import { subDays } from 'date-fns';

@Injectable()
export class PrayersService {
  constructor(
    private prisma: PrismaService,
    private dailySummaryService: DailySummaryService,
    private milestonesService: MilestonesService,
    private pointsService: PointsService,
    private awardsService: AwardsService,
    private streaksService: StreaksService,
    private configService: ConfigService,
  ) {}

  private isDualWriteEnabled(): boolean {
    return this.configService.get('USE_DUAL_WRITE') === 'true';
  }

  /**
   * When dual-write is enabled, recalculate the old DailySummary and
   * check milestones. Optionally write a PointTransaction and grant awards
   * if the day just became complete.
   */
  private async orchestrateSideEffects(userId: string, date: Date) {
    if (!this.isDualWriteEnabled()) {
      return;
    }

    // Sync old system
    await this.dailySummaryService.recalculate(userId, date);
    await this.milestonesService.checkMilestones(userId).catch(() => {});

    // Check if the day is now complete (all 5 prayers not MISSED)
    const dayLogs = await this.prisma.prayerLog.findMany({
      where: { userId, date },
      select: { status: true, points: true },
    });

    const completedPrayers = dayLogs.filter((l) => l.status !== 'MISSED').length;
    const isDayComplete = completedPrayers === 5;

    if (isDayComplete) {
      const totalPoints = dayLogs.reduce((sum, l) => sum + l.points, 0);

      // Idempotent: only write if no DAILY_COMPLETION tx exists for this date
      const existingTx = await this.prisma.pointTransaction.findFirst({
        where: {
          userId,
          relatedDate: date,
          reason: PointReason.DAILY_COMPLETION,
        },
      });

      if (!existingTx) {
        await this.pointsService.writeTransaction(
          userId,
          totalPoints,
          PointReason.DAILY_COMPLETION,
          date,
          'Auto-generated from prayer toggle (dual-write)',
        );
      }
    }

    // Grant awards based on new streak calculation
    const { currentStreak } = await this.streaksService.calculateStreaksFromPrayerLogs(userId);
    await this.awardsService.grantAwardsIfEligible(userId, currentStreak);
  }

  async create(userId: string, dto: CreatePrayerLogDto) {
    const date = parseDateString(dto.date);

    // Prevent logging prayers for future dates
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    if (date > today) {
      throw new BadRequestException('Cannot log prayers for future dates');
    }

    const inMosque = dto.inMosque ?? false;
    const points = calculatePrayerPoints(dto.status, inMosque, dto.prayerName);
    const prayedAt = dto.prayedAt ? new Date(dto.prayedAt) : null;

    try {
      const prayerLog = await this.prisma.prayerLog.create({
        data: {
          userId,
          prayerName: dto.prayerName,
          date,
          status: dto.status,
          inMosque,
          points,
          prayedAt,
        },
      });

      await this.dailySummaryService.recalculate(userId, date);
      await this.milestonesService.checkMilestones(userId).catch(() => {});

      return prayerLog;
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException(
          'Prayer already logged for this date and prayer name',
        );
      }
      throw error;
    }
  }

  async getToday(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });

    const timezone = user?.timezone ?? 'Asia/Dubai';
    const today = getTodayInTimezone(timezone);

    return this.prisma.prayerLog.findMany({
      where: {
        userId,
        date: today,
      },
      orderBy: { prayerName: 'asc' },
    });
  }

  async getHistory(userId: string, month?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });

    const timezone = user?.timezone ?? 'Asia/Dubai';

    let year: number;
    let monthNum: number;

    if (month) {
      const [y, m] = month.split('-').map(Number);
      year = y;
      monthNum = m;
    } else {
      const now = new Date();
      year = now.getFullYear();
      monthNum = now.getMonth() + 1;
    }

    const { start, end } = getMonthRange(timezone, year, monthNum);

    return this.prisma.prayerLog.findMany({
      where: {
        userId,
        date: {
          gte: start,
          lte: end,
        },
      },
      orderBy: [{ date: 'asc' }, { prayerName: 'asc' }],
    });
  }

  async update(userId: string, prayerId: string, dto: UpdatePrayerLogDto) {
    const existing = await this.prisma.prayerLog.findUnique({
      where: { id: prayerId },
    });

    if (!existing) {
      throw new NotFoundException('Prayer log not found');
    }

    if (existing.userId !== userId) {
      throw new ForbiddenException('You do not own this prayer log');
    }

    const status = dto.status ?? existing.status;
    const inMosque = dto.inMosque ?? existing.inMosque;
    const points = calculatePrayerPoints(status, inMosque, existing.prayerName);
    const prayedAt = dto.prayedAt ? new Date(dto.prayedAt) : existing.prayedAt;

    const updated = await this.prisma.prayerLog.update({
      where: { id: prayerId },
      data: {
        status,
        inMosque,
        points,
        prayedAt,
      },
    });

    await this.dailySummaryService.recalculate(userId, existing.date);
    await this.milestonesService.checkMilestones(userId).catch(() => {});

    return updated;
  }

  async remove(userId: string, prayerId: string) {
    const existing = await this.prisma.prayerLog.findUnique({
      where: { id: prayerId },
    });

    if (!existing) {
      throw new NotFoundException('Prayer log not found');
    }

    if (existing.userId !== userId) {
      throw new ForbiddenException('You do not own this prayer log');
    }

    await this.prisma.prayerLog.delete({
      where: { id: prayerId },
    });

    await this.dailySummaryService.recalculate(userId, existing.date);
    await this.milestonesService.checkMilestones(userId).catch(() => {});
  }

  async complete(userId: string, prayerName: PrayerName, dateStr?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });

    const timezone = user?.timezone ?? 'Asia/Dubai';
    const date = dateStr ? parseDateString(dateStr) : getTodayInTimezone(timezone);

    // Prevent logging prayers for future dates
    const today = getTodayInTimezone(timezone);
    if (date > today) {
      throw new BadRequestException('Cannot log prayers for future dates');
    }

    const points = calculatePrayerPoints('ON_TIME', false, prayerName);

    try {
      const prayerLog = await this.prisma.prayerLog.upsert({
        where: {
          userId_date_prayerName: { userId, date, prayerName },
        },
        create: {
          userId,
          prayerName,
          date,
          status: 'ON_TIME',
          inMosque: false,
          points,
        },
        update: {
          status: 'ON_TIME',
          inMosque: false,
          points,
          prayedAt: null,
        },
      });

      await this.orchestrateSideEffects(userId, date);

      return prayerLog;
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new ConflictException(
          'Prayer already logged for this date and prayer name',
        );
      }
      throw error;
    }
  }

  async uncomplete(userId: string, prayerName: PrayerName, dateStr?: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true },
    });

    const timezone = user?.timezone ?? 'Asia/Dubai';
    const date = dateStr ? parseDateString(dateStr) : getTodayInTimezone(timezone);

    // Edit window: today + previous 3 days only
    const today = getTodayInTimezone(timezone);
    const cutoff = subDays(today, 3);
    if (date < cutoff) {
      throw new ForbiddenException('Cannot modify prayers older than 3 days');
    }

    const existing = await this.prisma.prayerLog.findUnique({
      where: { userId_date_prayerName: { userId, date, prayerName } },
    });

    if (!existing) {
      return { message: 'No prayer log found to uncomplete' };
    }

    const points = calculatePrayerPoints('MISSED', false, prayerName);

    const updated = await this.prisma.prayerLog.update({
      where: { id: existing.id },
      data: {
        status: 'MISSED',
        points,
        prayedAt: null,
      },
    });

    await this.orchestrateSideEffects(userId, date);

    return updated;
  }
}