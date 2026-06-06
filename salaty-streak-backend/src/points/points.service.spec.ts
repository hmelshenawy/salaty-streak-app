import { Test } from '@nestjs/testing';
import { PointsService } from './points.service';
import { PrismaService } from '../prisma/prisma.service';
import { PointReason } from '@prisma/client';

describe('PointsService', () => {
  let service: PointsService;
  let prismaMock: {
    pointTransaction: {
      findMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    prismaMock = {
      pointTransaction: {
        findMany: jest.fn(),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        PointsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<PointsService>(PointsService);
  });

  it('should return empty state when no transactions exist', async () => {
    prismaMock.pointTransaction.findMany.mockResolvedValue([]);
    const result = await service.getSummary('user-1');

    expect(result.total).toBe(0);
    expect(result.breakdown.dailyCompletion).toBe(0);
    expect(result.breakdown.streakBonus).toBe(0);
    expect(result.breakdown.adjustment).toBe(0);
    expect(result.recentTransactions).toEqual([]);
  });

  it('should calculate total from a single transaction', async () => {
    prismaMock.pointTransaction.findMany.mockResolvedValue([
      {
        id: 'tx-1',
        points: 25,
        reason: PointReason.DAILY_COMPLETION,
        relatedDate: new Date('2026-06-01'),
        description: null,
        createdAt: new Date('2026-06-01'),
      },
    ]);
    const result = await service.getSummary('user-1');

    expect(result.total).toBe(25);
    expect(result.breakdown.dailyCompletion).toBe(25);
    expect(result.breakdown.streakBonus).toBe(0);
    expect(result.recentTransactions).toHaveLength(1);
  });

  it('should calculate totals from multiple transactions', async () => {
    prismaMock.pointTransaction.findMany.mockResolvedValue([
      {
        id: 'tx-1',
        points: 25,
        reason: PointReason.DAILY_COMPLETION,
        relatedDate: new Date('2026-06-01'),
        description: null,
        createdAt: new Date('2026-06-01'),
      },
      {
        id: 'tx-2',
        points: 10,
        reason: PointReason.STREAK_BONUS,
        relatedDate: new Date('2026-06-02'),
        description: null,
        createdAt: new Date('2026-06-02'),
      },
      {
        id: 'tx-3',
        points: 5,
        reason: PointReason.ADJUSTMENT,
        relatedDate: new Date('2026-06-03'),
        description: 'Correction',
        createdAt: new Date('2026-06-03'),
      },
    ]);
    const result = await service.getSummary('user-1');

    expect(result.total).toBe(40);
    expect(result.breakdown.dailyCompletion).toBe(25);
    expect(result.breakdown.streakBonus).toBe(10);
    expect(result.breakdown.adjustment).toBe(5);
    expect(result.recentTransactions).toHaveLength(3);
  });

  it('should handle mixed positive and negative values', async () => {
    prismaMock.pointTransaction.findMany.mockResolvedValue([
      {
        id: 'tx-1',
        points: 25,
        reason: PointReason.DAILY_COMPLETION,
        relatedDate: new Date('2026-06-01'),
        description: null,
        createdAt: new Date('2026-06-01'),
      },
      {
        id: 'tx-2',
        points: -10,
        reason: PointReason.ADJUSTMENT,
        relatedDate: new Date('2026-06-02'),
        description: 'Penalty',
        createdAt: new Date('2026-06-02'),
      },
    ]);
    const result = await service.getSummary('user-1');

    expect(result.total).toBe(15);
    expect(result.breakdown.dailyCompletion).toBe(25);
    expect(result.breakdown.adjustment).toBe(-10);
  });

  it('should limit recent transactions to 10 items', async () => {
    const transactions = Array.from({ length: 15 }, (_, i) => ({
      id: `tx-${i}`,
      points: 1,
      reason: PointReason.DAILY_COMPLETION,
      relatedDate: new Date(),
      description: null,
      createdAt: new Date(),
    }));
    prismaMock.pointTransaction.findMany.mockResolvedValue(transactions);
    const result = await service.getSummary('user-1');

    expect(result.recentTransactions).toHaveLength(10);
  });
});
