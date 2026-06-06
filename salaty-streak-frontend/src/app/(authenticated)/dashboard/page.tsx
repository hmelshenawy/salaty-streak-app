'use client';

import { useDashboard } from '@/hooks/useDashboard';
import { PrayerCardList } from '@/components/prayers/PrayerCardList';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

export default function DashboardPage() {
  const { data, loading, error, refresh } = useDashboard();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-destructive mb-4">{error}</p>
            <Button variant="outline" onClick={refresh} className="h-12">
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  // Dashboard response is backward-compatible: old fields are always present.
  // New fields (points, awards, timezone) are optional and rendered when available.
  return (
    <div className="space-y-6">
      {/* Prayer cards with streak/points/completion from dashboard */}
      <PrayerCardList
        prayers={data.todayPrayers}
        prayerTimes={data.prayerTimes ?? []}
        currentStreak={data.currentStreak}
        monthlyPoints={data.monthlyPoints}
        completionRate={data.completionRate}
        onPrayerLogged={refresh}
      />

      {/* New fields rendered only when backend sends them (flags ON) */}
      {data.points && (
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Points</p>
                <p className="text-2xl font-bold">{data.points.total}</p>
              </div>
              <div className="text-right text-xs text-muted-foreground space-y-1">
                <p>Daily: {data.points.breakdown.dailyCompletion}</p>
                <p>Bonus: {data.points.breakdown.streakBonus}</p>
                {data.points.breakdown.adjustment !== 0 && (
                  <p>Adj: {data.points.breakdown.adjustment}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {data.awards && data.awards.earned.length > 0 && (
        <Card>
          <CardContent className="py-4">
            <p className="text-sm font-medium text-muted-foreground mb-2">Awards</p>
            <div className="flex flex-wrap gap-2">
              {data.awards.earned.map((award) => (
                <span
                  key={award.id}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium"
                >
                  {award.icon ?? '🏆'} {award.title}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
