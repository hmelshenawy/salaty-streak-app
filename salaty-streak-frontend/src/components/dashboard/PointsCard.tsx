'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Star } from 'lucide-react';
import { PointsSummary } from '@/types/dashboard';

interface PointsCardProps {
  monthlyPoints: number;
  points?: PointsSummary;
}

export function PointsCard({ monthlyPoints, points }: PointsCardProps) {
  // Prefer new points total when backend sends it; fall back to legacy monthlyPoints
  const displayTotal = points?.total ?? monthlyPoints;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {points ? 'Total Points' : 'Monthly Points'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/15">
            <Star className="h-6 w-6 text-accent-foreground" />
          </div>
          <div>
            <div className="text-3xl font-bold">{displayTotal}</div>
            <p className="text-xs text-muted-foreground">{points ? 'points earned' : 'points this month'}</p>
          </div>
        </div>

        {/* Show breakdown when backend sends new points shape */}
        {points && (
          <div className="mt-3 pt-3 border-t border-border/50 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Daily completion</span>
              <span className="font-medium">{points.breakdown.dailyCompletion}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Streak bonus</span>
              <span className="font-medium">{points.breakdown.streakBonus}</span>
            </div>
            {points.breakdown.adjustment !== 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Adjustment</span>
                <span className="font-medium">{points.breakdown.adjustment}</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
