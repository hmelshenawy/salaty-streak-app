import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PointReason } from '@prisma/client';

export interface PointsSummary {
  total: number;
  breakdown: {
    dailyCompletion: number;
    streakBonus: number;
    adjustment: number;
  };
  recentTransactions: {
    id: string;
    points: number;
    reason: PointReason;
    relatedDate: Date;
    description: string | null;
    createdAt: Date;
  }[];
}

@Injectable()
export class PointsService {
  constructor(private prisma: PrismaService) {}

  async getSummary(userId: string): Promise<PointsSummary> {
    const transactions = await this.prisma.pointTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const total = transactions.reduce((sum, t) => sum + t.points, 0);

    const breakdown = {
      dailyCompletion: transactions
        .filter((t) => t.reason === PointReason.DAILY_COMPLETION)
        .reduce((sum, t) => sum + t.points, 0),
      streakBonus: transactions
        .filter((t) => t.reason === PointReason.STREAK_BONUS)
        .reduce((sum, t) => sum + t.points, 0),
      adjustment: transactions
        .filter((t) => t.reason === PointReason.ADJUSTMENT)
        .reduce((sum, t) => sum + t.points, 0),
    };

    const recentTransactions = transactions.slice(0, 10).map((t) => ({
      id: t.id,
      points: t.points,
      reason: t.reason,
      relatedDate: t.relatedDate,
      description: t.description,
      createdAt: t.createdAt,
    }));

    return {
      total,
      breakdown,
      recentTransactions,
    };
  }

  /**
   * Write a point transaction to the ledger.
   * INTERNAL ONLY — used by PrayersService orchestration.
   */
  async writeTransaction(
    userId: string,
    points: number,
    reason: PointReason,
    relatedDate: Date,
    description?: string,
  ) {
    return this.prisma.pointTransaction.create({
      data: {
        userId,
        points,
        reason,
        relatedDate,
        description: description ?? null,
      },
    });
  }
}
