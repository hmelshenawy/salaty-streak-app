import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../src/prisma/prisma.service';
import { DashboardService } from '../../src/dashboard/dashboard.service';
import { StreaksService } from '../../src/streaks/streaks.service';
import { PointsService } from '../../src/points/points.service';
import { AwardsService } from '../../src/awards/awards.service';
import { MilestonesService } from '../../src/milestones/milestones.service';
import { PrayerTimesService } from '../../src/prayer-times/prayer-times.service';
import { JwtAuthGuard } from '../../src/common/guards/jwt-auth.guard';
import { startOfDay, subDays } from 'date-fns';

/**
 * Integration test: dashboard parity between old and new aggregation paths.
 * Runs against the real database. Cleans up test data after each scenario.
 */
jest.setTimeout(30000);

describe('Dashboard Comparison (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let dashboardService: DashboardService;

  const TEST_PREFIX = 'dashboard-parity-test';

  async function cleanupTestData(userId: string) {
    await prisma.prayerLog.deleteMany({ where: { userId } });
    await prisma.dailySummary.deleteMany({ where: { userId } });
    await prisma.pointTransaction.deleteMany({ where: { userId } });
    await prisma.award.deleteMany({ where: { userId } });
    await prisma.userMilestone.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  }

  async function createTestUser(id: string) {
    await prisma.user.delete({ where: { id } }).catch(() => {});
    return prisma.user.create({
      data: {
        id,
        name: 'Dashboard Parity Test',
        email: `${id}@test.local`,
        password: 'test-password',
        timezone: 'Asia/Dubai',
      },
    });
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [],
      providers: [
        PrismaService,
        DashboardService,
        StreaksService,
        PointsService,
        AwardsService,
        MilestonesService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('false') },
        },
        {
          provide: PrayerTimesService,
          useValue: {
            getPrayerTimes: jest.fn().mockResolvedValue({
              date: '2026-06-05',
              timezone: 'Asia/Dubai',
              times: [
                { prayerName: 'FAJR', time: '04:30', timestamp: new Date(), endTime: new Date(), windowMinutes: 90 },
                { prayerName: 'DHUHR', time: '12:15', timestamp: new Date(), endTime: new Date(), windowMinutes: 120 },
                { prayerName: 'ASR', time: '15:30', timestamp: new Date(), endTime: new Date(), windowMinutes: 120 },
                { prayerName: 'MAGHRIB', time: '18:30', timestamp: new Date(), endTime: new Date(), windowMinutes: 90 },
                { prayerName: 'ISHA', time: '20:00', timestamp: new Date(), endTime: new Date(), windowMinutes: 120 },
              ],
            }),
          },
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
    dashboardService = app.get(DashboardService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('parity scenarios', () => {
    const allPrayers = ['FAJR', 'DHUHR', 'ASR', 'MAGHRIB', 'ISHA'];
    const allCompleted = Object.fromEntries(allPrayers.map((p) => [p, 'ON_TIME']));

    it('empty user → both dashboards return comparable empty state', async () => {
      const userId = `${TEST_PREFIX}-empty`;
      await createTestUser(userId);

      try {
        const oldDash = await dashboardService.getDashboard(userId);
        const newDash = await dashboardService.getDashboardFromNewServices(userId);

        expect(oldDash.currentStreak).toBe(newDash.currentStreak);
        expect(oldDash.bestStreak).toBe(newDash.bestStreak);
        expect(oldDash.monthlyPoints).toBe(newDash.monthlyPoints);
        expect(oldDash.completionRate).toBe(newDash.completionRate);
        expect(oldDash.todayPrayers).toHaveLength(5);
        expect(newDash.todayPrayers).toHaveLength(5);
      } finally {
        await cleanupTestData(userId);
      }
    });

    it('seeded data → both dashboards match on key metrics', async () => {
      const userId = `${TEST_PREFIX}-seeded`;
      await createTestUser(userId);

      const today = startOfDay(new Date());
      const yesterday = subDays(today, 1);
      const dayBefore = subDays(today, 2);

      try {
        // Seed DailySummary (old system)
        await prisma.dailySummary.createMany({
          data: [
            { userId, date: today, isStreakDay: true, totalPoints: 25, completedPrayers: 5, missedPrayers: 0 },
            { userId, date: yesterday, isStreakDay: true, totalPoints: 25, completedPrayers: 5, missedPrayers: 0 },
            { userId, date: dayBefore, isStreakDay: true, totalPoints: 25, completedPrayers: 5, missedPrayers: 0 },
          ],
        });

        // Seed PrayerLog (new system source of truth)
        const logData = [today, yesterday, dayBefore].flatMap((d) =>
          allPrayers.map((p) => ({
            userId,
            prayerName: p as any,
            date: d,
            status: 'ON_TIME' as any,
            points: 5,
          })),
        );
        await prisma.prayerLog.createMany({ data: logData });

        // Seed PointTransaction (new system ledger)
        await prisma.pointTransaction.createMany({
          data: [
            { userId, points: 25, reason: 'DAILY_COMPLETION' as any, relatedDate: today },
            { userId, points: 25, reason: 'DAILY_COMPLETION' as any, relatedDate: yesterday },
            { userId, points: 25, reason: 'DAILY_COMPLETION' as any, relatedDate: dayBefore },
          ],
        });

        // Seed Milestones (old system) — upsert because targetDays is unique
        const milestone7 = await prisma.milestone.upsert({
          where: { targetDays: 7 },
          update: {},
          create: { title: '7-Day Streak', targetDays: 7, description: '7 days', icon: '🔥' },
        });
        const milestone15 = await prisma.milestone.upsert({
          where: { targetDays: 15 },
          update: {},
          create: { title: '15-Day Streak', targetDays: 15, description: '15 days', icon: '🌟' },
        });

        await prisma.userMilestone.createMany({
          data: [
            { userId, milestoneId: milestone7.id },
            { userId, milestoneId: milestone15.id },
          ],
        });

        // Seed Awards (new system)
        await prisma.award.createMany({
          data: [
            { userId, awardType: 'STREAK_MILESTONE' as any, milestone: 7, title: '7-Day Streak' },
            { userId, awardType: 'STREAK_MILESTONE' as any, milestone: 15, title: '15-Day Streak' },
          ],
        });

        const oldDash = await dashboardService.getDashboard(userId);
        const newDash = await dashboardService.getDashboardFromNewServices(userId);

        // Streak parity
        expect(oldDash.currentStreak).toBe(newDash.currentStreak);
        expect(oldDash.bestStreak).toBe(newDash.bestStreak);
        expect(oldDash.currentStreak).toBe(3);

        // Points parity (monthly)
        expect(oldDash.monthlyPoints).toBe(newDash.monthlyPoints);
        expect(oldDash.monthlyPoints).toBe(75);

        // Completion rate parity
        expect(oldDash.completionRate).toBe(newDash.completionRate);

        // Today prayers parity
        expect(oldDash.todayPrayers.length).toBe(newDash.todayPrayers.length);
        for (let i = 0; i < oldDash.todayPrayers.length; i++) {
          expect(oldDash.todayPrayers[i].prayerName).toBe(newDash.todayPrayers[i].prayerName);
          expect(oldDash.todayPrayers[i].status).toBe(newDash.todayPrayers[i].status);
        }

        // Cleanup user-specific milestone links only (never delete shared master rows)
        await prisma.userMilestone.deleteMany({ where: { userId } });
      } finally {
        await cleanupTestData(userId);
      }
    });

    it('compareDashboardCalculations returns zero mismatches for synced data', async () => {
      const userId = `${TEST_PREFIX}-compare`;
      await createTestUser(userId);

      const today = startOfDay(new Date());
      const yesterday = subDays(today, 1);

      try {
        await prisma.dailySummary.createMany({
          data: [
            { userId, date: today, isStreakDay: true, totalPoints: 25, completedPrayers: 5, missedPrayers: 0 },
            { userId, date: yesterday, isStreakDay: true, totalPoints: 25, completedPrayers: 5, missedPrayers: 0 },
          ],
        });

        const logData = [today, yesterday].flatMap((d) =>
          allPrayers.map((p) => ({
            userId,
            prayerName: p as any,
            date: d,
            status: 'ON_TIME' as any,
            points: 5,
          })),
        );
        await prisma.prayerLog.createMany({ data: logData });

        await prisma.pointTransaction.createMany({
          data: [
            { userId, points: 25, reason: 'DAILY_COMPLETION' as any, relatedDate: today },
            { userId, points: 25, reason: 'DAILY_COMPLETION' as any, relatedDate: yesterday },
          ],
        });

        // Temporarily enable comparison
        const originalEnv = process.env.ENABLE_DASHBOARD_COMPARISON;
        process.env.ENABLE_DASHBOARD_COMPARISON = 'true';

        const result = await dashboardService.compareDashboardCalculations(userId);

        // Restore env
        process.env.ENABLE_DASHBOARD_COMPARISON = originalEnv;

        expect(result.mismatches).toHaveLength(0);
        expect(result.oldResult.currentStreak).toBe(result.newResult.currentStreak);
        expect(result.oldResult.monthlyPoints).toBe(result.newResult.monthlyPoints);
      } finally {
        await cleanupTestData(userId);
      }
    });
  });
});
