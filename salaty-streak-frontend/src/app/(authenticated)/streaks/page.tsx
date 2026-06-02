'use client';

import { useDashboard } from '@/hooks/useDashboard';
import { PageHeader } from '@/components/layout/PageHeader';
import { StreakCard } from '@/components/dashboard/StreakCard';
import { BestStreakCard } from '@/components/streaks/BestStreakCard';
import { StreakCalendar } from '@/components/streaks/StreakCalendar';

export default function StreaksPage() {
  const { data, loading, error } = useDashboard();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <PageHeader title="Streaks" description="Track your prayer consistency" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StreakCard
          currentStreak={data.currentStreak}
          bestStreak={data.bestStreak}
        />
        <BestStreakCard bestStreak={data.bestStreak} />
      </div>

      <StreakCalendar />
    </div>
  );
}