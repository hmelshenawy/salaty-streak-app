import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ExecutionContext, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { JwtAuthGuard } from '../../src/common/guards/jwt-auth.guard';
import { PointsService } from '../../src/points/points.service';
import { AwardsService } from '../../src/awards/awards.service';
import { PointReason } from '@prisma/client';

describe('Points and Awards Endpoints (contract)', () => {
  let app: INestApplication<App>;
  let pointsServiceMock: {
    getSummary: jest.Mock;
  };
  let awardsServiceMock: {
    getAwards: jest.Mock;
  };

  const TEST_USER_ID = 'test-user-contract-002';

  beforeAll(async () => {
    pointsServiceMock = {
      getSummary: jest.fn(),
    };
    awardsServiceMock = {
      getAwards: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PointsService)
      .useValue(pointsServiceMock)
      .overrideProvider(AwardsService)
      .useValue(awardsServiceMock)
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
    pointsServiceMock.getSummary.mockReset();
    awardsServiceMock.getAwards.mockReset();
  });

  describe('GET /points/summary', () => {
    it('should return points summary for authenticated user', async () => {
      pointsServiceMock.getSummary.mockResolvedValue({
        total: 100,
        breakdown: {
          dailyCompletion: 80,
          streakBonus: 15,
          adjustment: 5,
        },
        recentTransactions: [
          {
            id: 'tx-1',
            points: 25,
            reason: PointReason.DAILY_COMPLETION,
            relatedDate: new Date('2026-06-05').toISOString(),
            description: null,
            createdAt: new Date('2026-06-05').toISOString(),
          },
        ],
      });

      const res = await request(app.getHttpServer()).get('/points/summary');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('total', 100);
      expect(res.body).toHaveProperty('breakdown');
      expect(res.body.breakdown).toHaveProperty('dailyCompletion', 80);
      expect(res.body.breakdown).toHaveProperty('streakBonus', 15);
      expect(res.body).toHaveProperty('recentTransactions');
      expect(res.body.recentTransactions).toBeInstanceOf(Array);
      expect(pointsServiceMock.getSummary).toHaveBeenCalledWith(TEST_USER_ID);
    });
  });

  describe('GET /awards', () => {
    it('should return awards for authenticated user', async () => {
      awardsServiceMock.getAwards.mockResolvedValue({
        earned: [
          {
            id: 'award-1',
            awardType: 'STREAK_MILESTONE',
            milestone: 7,
            title: '7-Day Streak',
            description: 'Complete prayers for 7 consecutive days',
            icon: '🔥',
            grantedAt: new Date('2026-05-01').toISOString(),
          },
        ],
        locked: [
          {
            awardType: 'STREAK_MILESTONE',
            milestone: 15,
            title: '15-Day Streak',
            description: 'Complete prayers for 15 consecutive days',
            progress: 0,
            target: 15,
          },
        ],
        nextTarget: {
          milestone: 15,
          title: '15-Day Streak',
          remainingDays: 15,
        },
      });

      const res = await request(app.getHttpServer()).get('/awards');

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('earned');
      expect(res.body).toHaveProperty('locked');
      expect(res.body).toHaveProperty('nextTarget');
      expect(res.body.earned).toBeInstanceOf(Array);
      expect(res.body.locked).toBeInstanceOf(Array);
      expect(awardsServiceMock.getAwards).toHaveBeenCalledWith(TEST_USER_ID);
    });
  });

  describe('auth requirements', () => {
    it('should reject points endpoint without auth', async () => {
      const freshModule: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      const freshApp = freshModule.createNestApplication();
      freshApp.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

      const reflector = freshApp.get(Reflector);
      freshApp.useGlobalGuards(new JwtAuthGuard(reflector));
      await freshApp.init();

      const res = await request(freshApp.getHttpServer()).get('/points/summary');
      expect(res.status).toBe(401);
      await freshApp.close();
    });

    it('should reject awards endpoint without auth', async () => {
      const freshModule: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      const freshApp = freshModule.createNestApplication();
      freshApp.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

      const reflector = freshApp.get(Reflector);
      freshApp.useGlobalGuards(new JwtAuthGuard(reflector));
      await freshApp.init();

      const res = await request(freshApp.getHttpServer()).get('/awards');
      expect(res.status).toBe(401);
      await freshApp.close();
    });
  });
});
