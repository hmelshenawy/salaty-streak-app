import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ExecutionContext, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { JwtAuthGuard } from '../../src/common/guards/jwt-auth.guard';
import { PrismaService } from '../../src/prisma/prisma.service';

/**
 * Dual-Write Validation Test
 * Requires USE_DUAL_WRITE=true in .env
 * Verifies that toggling prayers updates both old and new tables correctly.
 */
jest.setTimeout(60000);

describe('Dual-Write Validation', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const TEST_USER_ID = 'dual-write-test-001';
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkdWFsLXdyaXRlLXRlc3QtMDAxIiwiaWF0IjoxNjk4ODg4ODg4fQ.test';

  async function cleanup() {
    await prisma.prayerLog.deleteMany({ where: { userId: TEST_USER_ID } });
    await prisma.dailySummary.deleteMany({ where: { userId: TEST_USER_ID } });
    await prisma.pointTransaction.deleteMany({ where: { userId: TEST_USER_ID } });
    await prisma.award.deleteMany({ where: { userId: TEST_USER_ID } });
    await prisma.userMilestone.deleteMany({ where: { userId: TEST_USER_ID } });
    await prisma.user.delete({ where: { id: TEST_USER_ID } }).catch(() => {});
  }

  async function ensureUser() {
    return prisma.user.upsert({
      where: { id: TEST_USER_ID },
      update: {},
      create: {
        id: TEST_USER_ID,
        name: 'Dual Write Test',
        email: `${TEST_USER_ID}@test.local`,
        password: 'test-password',
        timezone: 'Asia/Dubai',
      },
    });
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

    const reflector = app.get(Reflector);
    app.useGlobalGuards(
      new (class extends JwtAuthGuard {
        canActivate(context: ExecutionContext) {
          const req = context.switchToHttp().getRequest();
          req.user = { sub: TEST_USER_ID };
          return true;
        }
      })(reflector),
    );

    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  beforeEach(async () => {
    await cleanup();
    await ensureUser();
  });

  async function snapshot() {
    const prayerLogs = await prisma.prayerLog.findMany({
      where: { userId: TEST_USER_ID },
      orderBy: [{ date: 'desc' }, { prayerName: 'asc' }],
    });
    const dailySummaries = await prisma.dailySummary.findMany({
      where: { userId: TEST_USER_ID },
      orderBy: { date: 'desc' },
    });
    const pointTxs = await prisma.pointTransaction.findMany({
      where: { userId: TEST_USER_ID },
      orderBy: { createdAt: 'desc' },
    });
    const awards = await prisma.award.findMany({
      where: { userId: TEST_USER_ID },
      orderBy: { milestone: 'asc' },
    });
    const userMilestones = await prisma.userMilestone.findMany({
      where: { userId: TEST_USER_ID },
      include: { milestone: true },
    });

    return { prayerLogs, dailySummaries, pointTxs, awards, userMilestones };
  }

  describe('complete prayer flow', () => {
    it('completing 1 prayer creates PrayerLog and DailySummary, no PointTransaction yet', async () => {
      const res = await request(app.getHttpServer())
        .post('/prayers/fajr/complete')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('ON_TIME');

      const state = await snapshot();
      expect(state.prayerLogs).toHaveLength(1);
      expect(state.prayerLogs[0].prayerName).toBe('FAJR');
      expect(state.prayerLogs[0].status).toBe('ON_TIME');
      expect(state.dailySummaries).toHaveLength(1);
      expect(state.dailySummaries[0].completedPrayers).toBe(1);
      expect(state.dailySummaries[0].isStreakDay).toBe(false);
      expect(state.pointTxs).toHaveLength(0);
      expect(state.awards).toHaveLength(0);
    });

    it('completing all 5 prayers creates PointTransaction and syncs DailySummary', async () => {
      for (const prayer of ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']) {
        const res = await request(app.getHttpServer())
          .post(`/prayers/${prayer}/complete`)
          .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(201);
      }

      const state = await snapshot();
      expect(state.prayerLogs).toHaveLength(5);
      expect(state.dailySummaries).toHaveLength(1);
      expect(state.dailySummaries[0].isStreakDay).toBe(true);
      expect(state.dailySummaries[0].completedPrayers).toBe(5);
      expect(state.pointTxs).toHaveLength(1);
      expect(state.pointTxs[0].reason).toBe('DAILY_COMPLETION');
    });

    it('idempotent: re-completing a prayer does not duplicate PointTransaction or Award', async () => {
      // Complete all 5
      for (const prayer of ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']) {
        await request(app.getHttpServer())
          .post(`/prayers/${prayer}/complete`)
          .set('Authorization', `Bearer ${token}`);
      }

      const state1 = await snapshot();
      const txCount1 = state1.pointTxs.length;
      const awardCount1 = state1.awards.length;

      // Re-complete FAJR
      const res = await request(app.getHttpServer())
        .post('/prayers/fajr/complete')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(201);

      const state2 = await snapshot();
      expect(state2.pointTxs.length).toBe(txCount1);
      expect(state2.awards.length).toBe(awardCount1);
    });

    it('uncomplete breaks streak, updates DailySummary, keeps PointTransaction', async () => {
      // Complete all 5
      for (const prayer of ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']) {
        await request(app.getHttpServer())
          .post(`/prayers/${prayer}/complete`)
          .set('Authorization', `Bearer ${token}`);
      }

      const stateBefore = await snapshot();
      expect(stateBefore.dailySummaries[0].isStreakDay).toBe(true);
      expect(stateBefore.pointTxs).toHaveLength(1);

      // Uncomplete MAGHRIB
      const res = await request(app.getHttpServer())
        .post('/prayers/maghrib/uncomplete')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(201);

      const stateAfter = await snapshot();
      expect(stateAfter.prayerLogs.filter((l) => l.prayerName === 'MAGHRIB' && l.status === 'MISSED')).toHaveLength(1);
      expect(stateAfter.dailySummaries[0].isStreakDay).toBe(false);
      expect(stateAfter.dailySummaries[0].completedPrayers).toBe(4);
      // PointTransaction is NOT deleted on uncomplete (no negative reversal implemented)
      expect(stateAfter.pointTxs.length).toBe(stateBefore.pointTxs.length);
    });

    it('re-completing after uncomplete restores streak without duplicating PointTransaction', async () => {
      // Complete all 5
      for (const prayer of ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']) {
        await request(app.getHttpServer())
          .post(`/prayers/${prayer}/complete`)
          .set('Authorization', `Bearer ${token}`);
      }

      // Uncomplete
      await request(app.getHttpServer())
        .post('/prayers/maghrib/uncomplete')
        .set('Authorization', `Bearer ${token}`);

      const stateMid = await snapshot();
      expect(stateMid.pointTxs.length).toBe(1);

      // Re-complete MAGHRIB
      const res = await request(app.getHttpServer())
        .post('/prayers/maghrib/complete')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(201);

      const stateEnd = await snapshot();
      expect(stateEnd.dailySummaries[0].isStreakDay).toBe(true);
      expect(stateEnd.dailySummaries[0].completedPrayers).toBe(5);
      expect(stateEnd.pointTxs.length).toBe(1); // still idempotent
    });

    it('dashboard reflects dual-write state correctly', async () => {
      // Complete all 5
      for (const prayer of ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']) {
        await request(app.getHttpServer())
          .post(`/prayers/${prayer}/complete`)
          .set('Authorization', `Bearer ${token}`);
      }

      const res = await request(app.getHttpServer())
        .get('/dashboard')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.currentStreak).toBe(1);
      expect(res.body.todayPrayers).toHaveLength(5);
      const completed = res.body.todayPrayers.filter((p: any) => p.status !== null).length;
      expect(completed).toBe(5);
    });
  });
});
