import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ExecutionContext, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { JwtAuthGuard } from '../../src/common/guards/jwt-auth.guard';
import { PrayersService } from '../../src/prayers/prayers.service';
import { DashboardService } from '../../src/dashboard/dashboard.service';
import { MilestonesService } from '../../src/milestones/milestones.service';
import { StreaksService } from '../../src/streaks/streaks.service';

describe('Backward Compatibility (integration)', () => {
  let app: INestApplication<App>;

  const TEST_USER_ID = 'test-user-compat-001';

  const prayersServiceMock = {
    create: jest.fn(),
    getToday: jest.fn(),
    getHistory: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const dashboardServiceMock = {
    getDashboard: jest.fn(),
  };

  const milestonesServiceMock = {
    getMilestones: jest.fn(),
    getNextMilestone: jest.fn(),
    getUnviewedMilestones: jest.fn(),
  };

  const streaksServiceMock = {
    calculateStreaks: jest.fn(),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrayersService)
      .useValue(prayersServiceMock)
      .overrideProvider(DashboardService)
      .useValue(dashboardServiceMock)
      .overrideProvider(MilestonesService)
      .useValue(milestonesServiceMock)
      .overrideProvider(StreaksService)
      .useValue(streaksServiceMock)
      .compile();

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
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('POST /prayers should still work', async () => {
    prayersServiceMock.create.mockResolvedValue({ id: 'p1', prayerName: 'FAJR', status: 'ON_TIME' });

    const res = await request(app.getHttpServer())
      .post('/prayers')
      .send({ prayerName: 'FAJR', status: 'ON_TIME', date: '2026-06-05' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('prayerName');
  });

  it('GET /prayers/today should still work', async () => {
    prayersServiceMock.getToday.mockResolvedValue([]);

    const res = await request(app.getHttpServer()).get('/prayers/today');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /prayers/history should still work', async () => {
    prayersServiceMock.getHistory.mockResolvedValue([]);

    const res = await request(app.getHttpServer()).get('/prayers/history?month=2026-06');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('PUT /prayers/:id should still work', async () => {
    prayersServiceMock.update.mockResolvedValue({ id: 'p1', status: 'LATE' });

    const res = await request(app.getHttpServer())
      .put('/prayers/p1')
      .send({ status: 'LATE' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
  });

  it('DELETE /prayers/:id should still work', async () => {
    prayersServiceMock.remove.mockResolvedValue(undefined);

    const res = await request(app.getHttpServer()).delete('/prayers/p1');

    expect(res.status).toBe(200);
  });

  it('GET /streaks/current should still work', async () => {
    streaksServiceMock.calculateStreaks.mockResolvedValue({ currentStreak: 5, bestStreak: 10 });

    const res = await request(app.getHttpServer()).get('/streaks/current');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('currentStreak');
    expect(res.body).toHaveProperty('bestStreak');
  });

  it('GET /streaks/milestones should still work', async () => {
    milestonesServiceMock.getMilestones.mockResolvedValue([]);

    const res = await request(app.getHttpServer()).get('/streaks/milestones');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /streaks/next should still work', async () => {
    milestonesServiceMock.getNextMilestone.mockResolvedValue({
      title: '7-Day Streak',
      targetDays: 7,
      remainingDays: 2,
    });

    const res = await request(app.getHttpServer()).get('/streaks/next');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('title');
    expect(res.body).toHaveProperty('targetDays');
  });

  it('GET /streaks/unviewed should still work', async () => {
    milestonesServiceMock.getUnviewedMilestones.mockResolvedValue([]);

    const res = await request(app.getHttpServer()).get('/streaks/unviewed');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /dashboard should still work with legacy shape', async () => {
    dashboardServiceMock.getDashboard.mockResolvedValue({
      currentStreak: 3,
      bestStreak: 7,
      monthlyPoints: 150,
      completionRate: 85.5,
      todayPrayers: [],
      nextMilestone: { title: '7-Day Streak', targetDays: 7, remainingDays: 4 },
      prayerTimes: [],
    });

    const res = await request(app.getHttpServer()).get('/dashboard');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('currentStreak');
    expect(res.body).toHaveProperty('bestStreak');
    expect(res.body).toHaveProperty('monthlyPoints');
    expect(res.body).toHaveProperty('completionRate');
    expect(res.body).toHaveProperty('todayPrayers');
    expect(res.body).toHaveProperty('nextMilestone');
    expect(res.body).toHaveProperty('prayerTimes');
  });
});
