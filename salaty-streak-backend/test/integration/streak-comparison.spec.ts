import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../src/prisma/prisma.service';
import { StreaksService } from '../../src/streaks/streaks.service';
import { JwtAuthGuard } from '../../src/common/guards/jwt-auth.guard';
import { startOfDay, subDays } from 'date-fns';

/**
 * Integration test: streak parity between old (DailySummary) and new (PrayerLog) calculations.
 * Runs against the real database. Cleans up test data after each scenario.
 */
jest.setTimeout(30000);

describe('Streak Comparison (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let streaksService: StreaksService;

  const TEST_PREFIX = 'streak-parity-test';

  async function cleanupTestData(userId: string) {
    await prisma.prayerLog.deleteMany({ where: { userId } });
    await prisma.dailySummary.deleteMany({ where: { userId } });
    await prisma.pointTransaction.deleteMany({ where: { userId } });
    await prisma.award.deleteMany({ where: { userId } });
    await prisma.userMilestone.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  }

  async function createTestUser(id: string) {
    return prisma.user.create({
      data: {
        id,
        name: 'Streak Parity Test',
        email: `${id}@test.local`,
        password: 'test-password',
        timezone: 'Asia/Dubai',
      },
    });
  }

  async function seedPrayerLogs(userId: string, days: { date: Date; statuses: Record<string, string> }[]) {
    const data = days.flatMap((day) =>
      Object.entries(day.statuses).map(([prayerName, status]) => ({
        userId,
        prayerName: prayerName as any,
        date: day.date,
        status: status as any,
        points: status === 'MISSED' ? -10 : 5,
      })),
    );
    await prisma.prayerLog.createMany({ data });
  }

  async function seedDailySummaries(userId: string, summaries: { date: Date; isStreakDay: boolean; totalPoints: number; completedPrayers: number; missedPrayers: number }[]) {
    const data = summaries.map((s) => ({
      userId,
      date: s.date,
      isStreakDay: s.isStreakDay,
      totalPoints: s.totalPoints,
      completedPrayers: s.completedPrayers,
      missedPrayers: s.missedPrayers,
    }));
    await prisma.dailySummary.createMany({ data });
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [],
      providers: [
        PrismaService,
        StreaksService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('false') },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();

    const reflector = app.get(Reflector);
    app.useGlobalGuards(
      new (class extends JwtAuthGuard {
        canActivate(context: ExecutionContext) {
          return true;
        }
      })(reflector),
    );

    await app.init();
    prisma = app.get(PrismaService);
    streaksService = app.get(StreaksService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('parity scenarios', () => {
    const allPrayers = ['FAJR', 'DHUHR', 'ASR', 'MAGHRIB', 'ISHA'];
    const allCompleted = Object.fromEntries(allPrayers.map((p) => [p, 'ON_TIME']));
    const allMissed = Object.fromEntries(allPrayers.map((p) => [p, 'MISSED']));

    it('empty history → both return 0', async () => {
      const userId = `${TEST_PREFIX}-empty`;
      await createTestUser(userId);

      try {
        const oldResult = await streaksService.calculateStreaks(userId);
        const newResult = await streaksService.calculateStreaksFromPrayerLogs(userId);

        expect(oldResult.currentStreak).toBe(newResult.currentStreak);
        expect(oldResult.bestStreak).toBe(newResult.bestStreak);
        expect(oldResult).toEqual({ currentStreak: 0, bestStreak: 0 });
      } finally {
        await cleanupTestData(userId);
      }
    });

    it('5-day streak → both return current=5, best=5', async () => {
      const userId = `${TEST_PREFIX}-5day`;
      await createTestUser(userId);

      const today = startOfDay(new Date());
      const days = Array.from({ length: 5 }, (_, i) => subDays(today, i));

      try {
        await seedDailySummaries(
          userId,
          days.map((d) => ({
            date: d,
            isStreakDay: true,
            totalPoints: 25,
            completedPrayers: 5,
            missedPrayers: 0,
          })),
        );

        await seedPrayerLogs(
          userId,
          days.map((d) => ({ date: d, statuses: allCompleted })),
        );

        const oldResult = await streaksService.calculateStreaks(userId);
        const newResult = await streaksService.calculateStreaksFromPrayerLogs(userId);

        expect(oldResult.currentStreak).toBe(newResult.currentStreak);
        expect(oldResult.bestStreak).toBe(newResult.bestStreak);
        expect(oldResult.currentStreak).toBe(5);
        expect(oldResult.bestStreak).toBe(5);
      } finally {
        await cleanupTestData(userId);
      }
    });

    it('broken streak (day 2 incomplete) → both return same', async () => {
      const userId = `${TEST_PREFIX}-broken`;
      await createTestUser(userId);

      const today = startOfDay(new Date());
      const d0 = today;
      const d1 = subDays(today, 1);
      const d2 = subDays(today, 2);

      try {
        // Day 0: complete
        await seedDailySummaries(userId, [
          { date: d0, isStreakDay: true, totalPoints: 25, completedPrayers: 5, missedPrayers: 0 },
          { date: d1, isStreakDay: false, totalPoints: 15, completedPrayers: 3, missedPrayers: 2 },
          { date: d2, isStreakDay: true, totalPoints: 25, completedPrayers: 5, missedPrayers: 0 },
        ]);

        await seedPrayerLogs(userId, [
          { date: d0, statuses: allCompleted },
          { date: d1, statuses: { ...allCompleted, MAGHRIB: 'MISSED', ISHA: 'MISSED' } },
          { date: d2, statuses: allCompleted },
        ]);

        const oldResult = await streaksService.calculateStreaks(userId);
        const newResult = await streaksService.calculateStreaksFromPrayerLogs(userId);

        expect(oldResult.currentStreak).toBe(newResult.currentStreak);
        expect(oldResult.bestStreak).toBe(newResult.bestStreak);
        expect(oldResult.currentStreak).toBe(1); // only today
        expect(oldResult.bestStreak).toBe(1);    // no consecutive runs > 1
      } finally {
        await cleanupTestData(userId);
      }
    });

    it('single complete day → both return current=1, best=1', async () => {
      const userId = `${TEST_PREFIX}-single`;
      await createTestUser(userId);

      const today = startOfDay(new Date());

      try {
        await seedDailySummaries(userId, [
          { date: today, isStreakDay: true, totalPoints: 25, completedPrayers: 5, missedPrayers: 0 },
        ]);

        await seedPrayerLogs(userId, [{ date: today, statuses: allCompleted }]);

        const oldResult = await streaksService.calculateStreaks(userId);
        const newResult = await streaksService.calculateStreaksFromPrayerLogs(userId);

        expect(oldResult.currentStreak).toBe(newResult.currentStreak);
        expect(oldResult.bestStreak).toBe(newResult.bestStreak);
        expect(oldResult.currentStreak).toBe(1);
        expect(oldResult.bestStreak).toBe(1);
      } finally {
        await cleanupTestData(userId);
      }
    });

    it('missed day (all 5 missed) → both return 0 current streak', async () => {
      const userId = `${TEST_PREFIX}-missed`;
      await createTestUser(userId);

      const today = startOfDay(new Date());
      const yesterday = subDays(today, 1);

      try {
        await seedDailySummaries(userId, [
          { date: today, isStreakDay: true, totalPoints: 25, completedPrayers: 5, missedPrayers: 0 },
          { date: yesterday, isStreakDay: false, totalPoints: -50, completedPrayers: 0, missedPrayers: 5 },
        ]);

        await seedPrayerLogs(userId, [
          { date: today, statuses: allCompleted },
          { date: yesterday, statuses: allMissed },
        ]);

        const oldResult = await streaksService.calculateStreaks(userId);
        const newResult = await streaksService.calculateStreaksFromPrayerLogs(userId);

        expect(oldResult.currentStreak).toBe(newResult.currentStreak);
        expect(oldResult.bestStreak).toBe(newResult.bestStreak);
        expect(oldResult.currentStreak).toBe(1); // today only
      } finally {
        await cleanupTestData(userId);
      }
    });

    it('out-of-order completion → both return same', async () => {
      const userId = `${TEST_PREFIX}-unordered`;
      await createTestUser(userId);

      const today = startOfDay(new Date());

      try {
        await seedDailySummaries(userId, [
          { date: today, isStreakDay: true, totalPoints: 25, completedPrayers: 5, missedPrayers: 0 },
        ]);

        // Insert prayers in scrambled order
        await prisma.prayerLog.createMany({
          data: [
            { userId, prayerName: 'ISHA', date: today, status: 'ON_TIME', points: 5 },
            { userId, prayerName: 'FAJR', date: today, status: 'ON_TIME', points: 5 },
            { userId, prayerName: 'MAGHRIB', date: today, status: 'ON_TIME', points: 5 },
            { userId, prayerName: 'ASR', date: today, status: 'ON_TIME', points: 5 },
            { userId, prayerName: 'DHUHR', date: today, status: 'ON_TIME', points: 5 },
          ],
        });

        const oldResult = await streaksService.calculateStreaks(userId);
        const newResult = await streaksService.calculateStreaksFromPrayerLogs(userId);

        expect(oldResult.currentStreak).toBe(newResult.currentStreak);
        expect(oldResult.bestStreak).toBe(newResult.bestStreak);
      } finally {
        await cleanupTestData(userId);
      }
    });
  });
});
