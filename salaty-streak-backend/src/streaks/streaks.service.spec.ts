import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { StreaksService } from './streaks.service';
import { PrismaService } from '../prisma/prisma.service';
import { getTodayInTimezone } from '../common/utils/date.utils';

describe('StreaksService', () => {
  let service: StreaksService;
  let prismaMock: {
    dailySummary: {
      findMany: jest.Mock;
    };
    prayerLog: {
      findMany: jest.Mock;
    };
    user: {
      findUnique: jest.Mock;
    };
  };

  beforeEach(async () => {
    prismaMock = {
      dailySummary: {
        findMany: jest.fn(),
      },
      prayerLog: {
        findMany: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        StreaksService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('false') } },
      ],
    }).compile();

    service = module.get<StreaksService>(StreaksService);
  });

  describe('calculateStreaks (legacy, from DailySummary)', () => {
    it('should return 0 streaks when no summaries exist', async () => {
      prismaMock.dailySummary.findMany.mockResolvedValue([]);
      const result = await service.calculateStreaks('user-1');
      expect(result).toEqual({ currentStreak: 0, bestStreak: 0 });
    });

    it('should calculate current streak from consecutive streak days', async () => {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const yesterday = new Date(today);
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const dayBefore = new Date(today);
      dayBefore.setUTCDate(dayBefore.getUTCDate() - 2);

      prismaMock.dailySummary.findMany.mockResolvedValue([
        { id: '1', userId: 'user-1', date: today, isStreakDay: true, totalPoints: 25, completedPrayers: 5, missedPrayers: 0 },
        { id: '2', userId: 'user-1', date: yesterday, isStreakDay: true, totalPoints: 25, completedPrayers: 5, missedPrayers: 0 },
        { id: '3', userId: 'user-1', date: dayBefore, isStreakDay: true, totalPoints: 25, completedPrayers: 5, missedPrayers: 0 },
      ]);

      const result = await service.calculateStreaks('user-1');
      expect(result.currentStreak).toBe(3);
      expect(result.bestStreak).toBe(3);
    });

    it('should reset current streak on non-streak day', async () => {
      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      const yesterday = new Date(today);
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);

      prismaMock.dailySummary.findMany.mockResolvedValue([
        { id: '1', userId: 'user-1', date: today, isStreakDay: false, totalPoints: 10, completedPrayers: 4, missedPrayers: 1 },
        { id: '2', userId: 'user-1', date: yesterday, isStreakDay: true, totalPoints: 25, completedPrayers: 5, missedPrayers: 0 },
      ]);

      const result = await service.calculateStreaks('user-1');
      expect(result.currentStreak).toBe(0);
      expect(result.bestStreak).toBe(1);
    });
  });

  describe('calculateStreaksFromPrayerLogs (new)', () => {
    beforeEach(() => {
      prismaMock.user.findUnique.mockResolvedValue({ timezone: 'Asia/Dubai' });
    });

    it('should return 0 streaks when no logs exist', async () => {
      prismaMock.prayerLog.findMany.mockResolvedValue([]);
      const result = await service.calculateStreaksFromPrayerLogs('user-1');
      expect(result).toEqual({ currentStreak: 0, bestStreak: 0 });
    });

    it('should calculate current streak when all 5 prayers completed today', async () => {
      const today = getTodayInTimezone('Asia/Dubai');
      prismaMock.prayerLog.findMany.mockResolvedValue([
        { date: today, prayerName: 'FAJR', status: 'ON_TIME' },
        { date: today, prayerName: 'DHUHR', status: 'ON_TIME' },
        { date: today, prayerName: 'ASR', status: 'ON_TIME' },
        { date: today, prayerName: 'MAGHRIB', status: 'ON_TIME' },
        { date: today, prayerName: 'ISHA', status: 'ON_TIME' },
      ]);

      const result = await service.calculateStreaksFromPrayerLogs('user-1');
      expect(result.currentStreak).toBe(1);
      expect(result.bestStreak).toBe(1);
    });

    it('should calculate 5-day streak from consecutive complete days', async () => {
      const today = getTodayInTimezone('Asia/Dubai');
      const d1 = new Date(today); d1.setUTCDate(d1.getUTCDate() - 1);
      const d2 = new Date(today); d2.setUTCDate(d2.getUTCDate() - 2);
      const d3 = new Date(today); d3.setUTCDate(d3.getUTCDate() - 3);
      const d4 = new Date(today); d4.setUTCDate(d4.getUTCDate() - 4);

      prismaMock.prayerLog.findMany.mockResolvedValue([
        // Today (5 prayers)
        { date: today, prayerName: 'FAJR', status: 'ON_TIME' },
        { date: today, prayerName: 'DHUHR', status: 'ON_TIME' },
        { date: today, prayerName: 'ASR', status: 'ON_TIME' },
        { date: today, prayerName: 'MAGHRIB', status: 'ON_TIME' },
        { date: today, prayerName: 'ISHA', status: 'ON_TIME' },
        // Day -1 (5 prayers)
        { date: d1, prayerName: 'FAJR', status: 'ON_TIME' },
        { date: d1, prayerName: 'DHUHR', status: 'ON_TIME' },
        { date: d1, prayerName: 'ASR', status: 'ON_TIME' },
        { date: d1, prayerName: 'MAGHRIB', status: 'ON_TIME' },
        { date: d1, prayerName: 'ISHA', status: 'ON_TIME' },
        // Day -2 (5 prayers)
        { date: d2, prayerName: 'FAJR', status: 'ON_TIME' },
        { date: d2, prayerName: 'DHUHR', status: 'ON_TIME' },
        { date: d2, prayerName: 'ASR', status: 'ON_TIME' },
        { date: d2, prayerName: 'MAGHRIB', status: 'ON_TIME' },
        { date: d2, prayerName: 'ISHA', status: 'ON_TIME' },
        // Day -3 (5 prayers)
        { date: d3, prayerName: 'FAJR', status: 'ON_TIME' },
        { date: d3, prayerName: 'DHUHR', status: 'ON_TIME' },
        { date: d3, prayerName: 'ASR', status: 'ON_TIME' },
        { date: d3, prayerName: 'MAGHRIB', status: 'ON_TIME' },
        { date: d3, prayerName: 'ISHA', status: 'ON_TIME' },
        // Day -4 (5 prayers)
        { date: d4, prayerName: 'FAJR', status: 'ON_TIME' },
        { date: d4, prayerName: 'DHUHR', status: 'ON_TIME' },
        { date: d4, prayerName: 'ASR', status: 'ON_TIME' },
        { date: d4, prayerName: 'MAGHRIB', status: 'ON_TIME' },
        { date: d4, prayerName: 'ISHA', status: 'ON_TIME' },
      ]);

      const result = await service.calculateStreaksFromPrayerLogs('user-1');
      expect(result.currentStreak).toBe(5);
      expect(result.bestStreak).toBe(5);
    });

    it('should reset current streak when a day is incomplete (broken streak)', async () => {
      const today = getTodayInTimezone('Asia/Dubai');
      const yesterday = new Date(today);
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const dayBefore = new Date(today);
      dayBefore.setUTCDate(dayBefore.getUTCDate() - 2);

      // Yesterday is incomplete (only 4 prayers done)
      prismaMock.prayerLog.findMany.mockResolvedValue([
        { date: today, prayerName: 'FAJR', status: 'ON_TIME' },
        { date: today, prayerName: 'DHUHR', status: 'ON_TIME' },
        { date: today, prayerName: 'ASR', status: 'ON_TIME' },
        { date: today, prayerName: 'MAGHRIB', status: 'ON_TIME' },
        { date: today, prayerName: 'ISHA', status: 'ON_TIME' },
        { date: yesterday, prayerName: 'FAJR', status: 'ON_TIME' },
        { date: yesterday, prayerName: 'DHUHR', status: 'ON_TIME' },
        { date: yesterday, prayerName: 'ASR', status: 'ON_TIME' },
        { date: yesterday, prayerName: 'MAGHRIB', status: 'ON_TIME' },
        // ISHA missed on yesterday
        { date: dayBefore, prayerName: 'FAJR', status: 'ON_TIME' },
        { date: dayBefore, prayerName: 'DHUHR', status: 'ON_TIME' },
        { date: dayBefore, prayerName: 'ASR', status: 'ON_TIME' },
        { date: dayBefore, prayerName: 'MAGHRIB', status: 'ON_TIME' },
        { date: dayBefore, prayerName: 'ISHA', status: 'ON_TIME' },
      ]);

      const result = await service.calculateStreaksFromPrayerLogs('user-1');
      // Today is complete (1), yesterday is incomplete → streak breaks
      expect(result.currentStreak).toBe(1);
      expect(result.bestStreak).toBe(1); // non-consecutive streak days
    });

    it('should return 0 current streak when today is incomplete before midnight', async () => {
      const today = getTodayInTimezone('Asia/Dubai');
      const yesterday = new Date(today);
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);

      // Only 3 prayers done today, but yesterday was complete
      prismaMock.prayerLog.findMany.mockResolvedValue([
        { date: today, prayerName: 'FAJR', status: 'ON_TIME' },
        { date: today, prayerName: 'DHUHR', status: 'ON_TIME' },
        { date: today, prayerName: 'ASR', status: 'ON_TIME' },
        // MAGHRIB and ISHA missing today
        { date: yesterday, prayerName: 'FAJR', status: 'ON_TIME' },
        { date: yesterday, prayerName: 'DHUHR', status: 'ON_TIME' },
        { date: yesterday, prayerName: 'ASR', status: 'ON_TIME' },
        { date: yesterday, prayerName: 'MAGHRIB', status: 'ON_TIME' },
        { date: yesterday, prayerName: 'ISHA', status: 'ON_TIME' },
      ]);

      const result = await service.calculateStreaksFromPrayerLogs('user-1');
      // Today is incomplete and has logs, so check starts from today and breaks immediately
      expect(result.currentStreak).toBe(0);
    });

    it('should handle out-of-order prayer completion', async () => {
      const today = getTodayInTimezone('Asia/Dubai');
      prismaMock.prayerLog.findMany.mockResolvedValue([
        { date: today, prayerName: 'ISHA', status: 'ON_TIME' },
        { date: today, prayerName: 'FAJR', status: 'ON_TIME' },
        { date: today, prayerName: 'MAGHRIB', status: 'ON_TIME' },
        { date: today, prayerName: 'ASR', status: 'ON_TIME' },
        { date: today, prayerName: 'DHUHR', status: 'ON_TIME' },
      ]);

      const result = await service.calculateStreaksFromPrayerLogs('user-1');
      expect(result.currentStreak).toBe(1);
      expect(result.bestStreak).toBe(1);
    });

    it('should handle missed day (all prayers MISSED)', async () => {
      const today = getTodayInTimezone('Asia/Dubai');
      const yesterday = new Date(today);
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);

      prismaMock.prayerLog.findMany.mockResolvedValue([
        { date: today, prayerName: 'FAJR', status: 'ON_TIME' },
        { date: today, prayerName: 'DHUHR', status: 'ON_TIME' },
        { date: today, prayerName: 'ASR', status: 'ON_TIME' },
        { date: today, prayerName: 'MAGHRIB', status: 'ON_TIME' },
        { date: today, prayerName: 'ISHA', status: 'ON_TIME' },
        { date: yesterday, prayerName: 'FAJR', status: 'MISSED' },
        { date: yesterday, prayerName: 'DHUHR', status: 'MISSED' },
        { date: yesterday, prayerName: 'ASR', status: 'MISSED' },
        { date: yesterday, prayerName: 'MAGHRIB', status: 'MISSED' },
        { date: yesterday, prayerName: 'ISHA', status: 'MISSED' },
      ]);

      const result = await service.calculateStreaksFromPrayerLogs('user-1');
      expect(result.currentStreak).toBe(1); // only today
      expect(result.bestStreak).toBe(1);
    });

    it('should handle single day history', async () => {
      const today = getTodayInTimezone('Asia/Dubai');
      prismaMock.prayerLog.findMany.mockResolvedValue([
        { date: today, prayerName: 'FAJR', status: 'ON_TIME' },
        { date: today, prayerName: 'DHUHR', status: 'ON_TIME' },
        { date: today, prayerName: 'ASR', status: 'ON_TIME' },
        { date: today, prayerName: 'MAGHRIB', status: 'ON_TIME' },
        { date: today, prayerName: 'ISHA', status: 'ON_TIME' },
      ]);

      const result = await service.calculateStreaksFromPrayerLogs('user-1');
      expect(result.currentStreak).toBe(1);
      expect(result.bestStreak).toBe(1);
    });
  });
});
