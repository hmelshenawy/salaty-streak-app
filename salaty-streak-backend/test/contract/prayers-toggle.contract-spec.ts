import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ExecutionContext, ValidationPipe, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { JwtAuthGuard } from '../../src/common/guards/jwt-auth.guard';
import { PrayersService } from '../../src/prayers/prayers.service';

describe('Prayers Toggle Endpoints (contract)', () => {
  let app: INestApplication<App>;
  let prayersServiceMock: {
    complete: jest.Mock;
    uncomplete: jest.Mock;
  };

  const TEST_USER_ID = 'test-user-contract-001';

  beforeAll(async () => {
    prayersServiceMock = {
      complete: jest.fn(),
      uncomplete: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrayersService)
      .useValue(prayersServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

    // Override global guard to inject test user
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
    prayersServiceMock.complete.mockReset();
    prayersServiceMock.uncomplete.mockReset();
  });

  describe('POST /prayers/:prayerType/complete', () => {
    it('should return 400 for invalid prayer type', () => {
      return request(app.getHttpServer())
        .post('/prayers/invalid/complete')
        .expect(400);
    });

    it('should call complete service and return result', async () => {
      prayersServiceMock.complete.mockResolvedValue({
        id: 'log-1',
        prayerName: 'FAJR',
        status: 'ON_TIME',
      });

      const res = await request(app.getHttpServer())
        .post('/prayers/fajr/complete')
        .send({ date: '2026-06-05' });

      expect(res.status).toBe(201);
      expect(prayersServiceMock.complete).toHaveBeenCalledWith(
        TEST_USER_ID,
        'FAJR',
        '2026-06-05',
      );
    });
  });

  describe('POST /prayers/:prayerType/uncomplete', () => {
    it('should return 400 for invalid prayer type', () => {
      return request(app.getHttpServer())
        .post('/prayers/invalid/uncomplete')
        .expect(400);
    });

    it('should call uncomplete service and return result', async () => {
      prayersServiceMock.uncomplete.mockResolvedValue({
        id: 'log-1',
        prayerName: 'FAJR',
        status: 'MISSED',
      });

      const res = await request(app.getHttpServer())
        .post('/prayers/fajr/uncomplete')
        .send({ date: '2026-06-05' });

      expect(res.status).toBe(201);
      expect(prayersServiceMock.uncomplete).toHaveBeenCalledWith(
        TEST_USER_ID,
        'FAJR',
        '2026-06-05',
      );
    });

    it('should return 403 for edit-window violation', async () => {
      prayersServiceMock.uncomplete.mockRejectedValue(
        new ForbiddenException('Cannot modify prayers older than 3 days'),
      );

      const res = await request(app.getHttpServer())
        .post('/prayers/fajr/uncomplete')
        .send({ date: '2026-01-01' });

      expect(res.status).toBe(403);
      expect(prayersServiceMock.uncomplete).toHaveBeenCalled();
    });
  });

  describe('auth requirements', () => {
    it('should reject without auth when guard is active', async () => {
      // Create a fresh app with the real guard (no auth override)
      const freshModule: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      const freshApp = freshModule.createNestApplication();
      freshApp.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

      const reflector = freshApp.get(Reflector);
      freshApp.useGlobalGuards(new JwtAuthGuard(reflector));
      await freshApp.init();

      const res = await request(freshApp.getHttpServer())
        .post('/prayers/fajr/complete')
        .send({});

      expect(res.status).toBe(401);
      await freshApp.close();
    });
  });
});
