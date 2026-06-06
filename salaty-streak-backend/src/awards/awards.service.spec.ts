import { Test } from '@nestjs/testing';
import { AwardsService } from './awards.service';
import { PrismaService } from '../prisma/prisma.service';
import { AwardType } from '@prisma/client';

describe('AwardsService', () => {
  let service: AwardsService;
  let prismaMock: {
    award: {
      findMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    prismaMock = {
      award: {
        findMany: jest.fn(),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        AwardsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<AwardsService>(AwardsService);
  });

  it('should return empty state when no awards exist', async () => {
    prismaMock.award.findMany.mockResolvedValue([]);
    const result = await service.getAwards('user-1');

    expect(result.earned).toEqual([]);
    expect(result.locked).toHaveLength(3); // 7, 15, 30
    expect(result.locked[0].milestone).toBe(7);
    expect(result.locked[1].milestone).toBe(15);
    expect(result.locked[2].milestone).toBe(30);
    expect(result.nextTarget).not.toBeNull();
    expect(result.nextTarget?.milestone).toBe(7);
  });

  it('should return earned awards correctly', async () => {
    prismaMock.award.findMany.mockResolvedValue([
      {
        id: 'award-1',
        awardType: AwardType.STREAK_MILESTONE,
        milestone: 7,
        title: '7-Day Streak',
        description: 'Complete prayers for 7 consecutive days',
        icon: '🔥',
        grantedAt: new Date('2026-05-01'),
      },
      {
        id: 'award-2',
        awardType: AwardType.STREAK_MILESTONE,
        milestone: 15,
        title: '15-Day Streak',
        description: null,
        icon: null,
        grantedAt: new Date('2026-05-10'),
      },
    ]);
    const result = await service.getAwards('user-1');

    expect(result.earned).toHaveLength(2);
    expect(result.earned[0].milestone).toBe(7);
    expect(result.earned[1].milestone).toBe(15);
  });

  it('should show remaining milestones as locked', async () => {
    prismaMock.award.findMany.mockResolvedValue([
      {
        id: 'award-1',
        awardType: AwardType.STREAK_MILESTONE,
        milestone: 7,
        title: '7-Day Streak',
        description: null,
        icon: null,
        grantedAt: new Date('2026-05-01'),
      },
    ]);
    const result = await service.getAwards('user-1');

    expect(result.earned).toHaveLength(1);
    expect(result.locked).toHaveLength(2); // 15, 30
    expect(result.locked[0].milestone).toBe(15);
    expect(result.locked[1].milestone).toBe(30);
    expect(result.nextTarget?.milestone).toBe(15);
  });

  it('should show null nextTarget when all milestones earned', async () => {
    prismaMock.award.findMany.mockResolvedValue([
      { id: 'a1', awardType: AwardType.STREAK_MILESTONE, milestone: 7, title: '7-Day', description: null, icon: null, grantedAt: new Date() },
      { id: 'a2', awardType: AwardType.STREAK_MILESTONE, milestone: 15, title: '15-Day', description: null, icon: null, grantedAt: new Date() },
      { id: 'a3', awardType: AwardType.STREAK_MILESTONE, milestone: 30, title: '30-Day', description: null, icon: null, grantedAt: new Date() },
    ]);
    const result = await service.getAwards('user-1');

    expect(result.earned).toHaveLength(3);
    expect(result.locked).toEqual([]);
    expect(result.nextTarget).toBeNull();
  });
});
