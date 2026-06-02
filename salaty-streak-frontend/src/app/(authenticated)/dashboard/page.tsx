'use client';

import { useDashboard } from '@/hooks/useDashboard';
import { PageHeader } from '@/components/layout/PageHeader';
import { TodayProgressCard } from '@/components/dashboard/TodayProgressCard';
import { StreakCard } from '@/components/dashboard/StreakCard';
import { PointsCard } from '@/components/dashboard/PointsCard';
import { CompletionRateCard } from '@/components/dashboard/CompletionRateCard';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { RefreshCw } from 'lucide-react';

export default function DashboardPage() {
  const { data, loading, error, refresh } = useDashboard();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <PageHeader title="Dashboard" />
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-destructive mb-4">{error}</p>
            <Button variant="outline" onClick={refresh}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Your prayer tracking overview">
        <Link href="/prayers">
          <Button className="bg-emerald-600 hover:bg-emerald-700">
            Log Prayer
          </Button>
        </Link>
      </PageHeader>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StreakCard
          currentStreak={data.currentStreak}
          bestStreak={data.bestStreak}
        />
        <PointsCard monthlyPoints={data.monthlyPoints} />
        <CompletionRateCard completionRate={data.completionRate} />
      </div>

      {/* Today's Progress */}
      <TodayProgressCard prayers={data.todayPrayers} />
    </div>
  );
}