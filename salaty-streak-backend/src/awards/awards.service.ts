import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { STREAK_MILESTONES } from './config/award.config';
import { AwardType } from '@prisma/client';

export interface EarnedAward {
  id: string;
  awardType: AwardType;
  milestone: number;
  title: string;
  description: string | null;
  icon: string | null;
  grantedAt: Date;
}

export interface LockedAward {
  awardType: AwardType;
  milestone: number;
  title: string;
  description: string | null;
  progress: number;
  target: number;
}

export interface AwardsResult {
  earned: EarnedAward[];
  locked: LockedAward[];
  nextTarget: { milestone: number; title: string; remainingDays: number } | null;
}

@Injectable()
export class AwardsService {
  constructor(private prisma: PrismaService) {}

  async getAwards(userId: string): Promise<AwardsResult> {
    const awards = await this.prisma.award.findMany({
      where: { userId },
      orderBy: { milestone: 'asc' },
    });

    const earned = awards.map((a) => ({
      id: a.id,
      awardType: a.awardType,
      milestone: a.milestone,
      title: a.title,
      description: a.description,
      icon: a.icon,
      grantedAt: a.grantedAt,
    }));

    const earnedMilestones = new Set(awards.map((a) => a.milestone));

    const locked: LockedAward[] = STREAK_MILESTONES.filter(
      (m) => !earnedMilestones.has(m),
    ).map((m) => {
      // Title/description will be hydrated from Milestone table or defaults
      return {
        awardType: AwardType.STREAK_MILESTONE,
        milestone: m,
        title: `${m}-Day Streak`,
        description: `Complete prayers for ${m} consecutive days`,
        progress: 0, // Will be hydrated by caller with current streak
        target: m,
      };
    });

    const nextLocked = locked[0] ?? null;
    const nextTarget = nextLocked
      ? {
          milestone: nextLocked.milestone,
          title: nextLocked.title,
          remainingDays: nextLocked.target - nextLocked.progress,
        }
      : null;

    return {
      earned,
      locked,
      nextTarget,
    };
  }

  /**
   * Grant awards if the user's current streak has reached new milestones.
   * INTERNAL ONLY — used by PrayersService orchestration.
   * Idempotent via upsert on @@unique([userId, awardType, milestone]).
   */
  async grantAwardsIfEligible(userId: string, currentStreak: number) {
    const newlyGranted: EarnedAward[] = [];

    for (const milestone of STREAK_MILESTONES) {
      if (currentStreak >= milestone) {
        const award = await this.prisma.award.upsert({
          where: {
            userId_awardType_milestone: {
              userId,
              awardType: AwardType.STREAK_MILESTONE,
              milestone,
            },
          },
          create: {
            userId,
            awardType: AwardType.STREAK_MILESTONE,
            milestone,
            title: `${milestone}-Day Streak`,
            description: `Complete prayers for ${milestone} consecutive days`,
          },
          update: {},
        });

        newlyGranted.push({
          id: award.id,
          awardType: award.awardType,
          milestone: award.milestone,
          title: award.title,
          description: award.description,
          icon: award.icon,
          grantedAt: award.grantedAt,
        });
      }
    }

    return newlyGranted;
  }
}
