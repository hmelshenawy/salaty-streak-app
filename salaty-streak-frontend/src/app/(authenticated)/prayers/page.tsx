'use client';

import { useTodayPrayers } from '@/hooks/useTodayPrayers';
import { PageHeader } from '@/components/layout/PageHeader';
import { PrayerLogForm } from '@/components/prayers/PrayerLogForm';
import { PrayerRow } from '@/components/prayers/PrayerRow';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PRAYER_LABELS, PRAYER_ICONS } from '@/lib/constants';
import { TodayPrayer } from '@/types/dashboard';
import { useDashboard } from '@/hooks/useDashboard';

export default function PrayersPage() {
  const { prayers, loading, error, refresh } = useTodayPrayers();
  const { data: dashboard, refresh: refreshDashboard } = useDashboard();

  const handlePrayerLogged = () => {
    refresh();
    refreshDashboard();
  };

  if (loading && prayers.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
      </div>
    );
  }

  // Build a map of today's prayers by name
  const prayerMap = new Map(prayers.map((p) => [p.prayerName, p]));

  return (
    <div className="space-y-6">
      <PageHeader title="Prayers" description="Track your daily prayers" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Prayer Log Form */}
        <PrayerLogForm onLogged={handlePrayerLogged} />

        {/* Today's Prayers */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Today&apos;s Prayers</CardTitle>
          </CardHeader>
          <CardContent>
            {prayers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No prayers logged yet today.</p>
                <p className="text-sm mt-1">Use the form to log your first prayer!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {prayers.map((prayer) => (
                  <PrayerRow
                    key={prayer.id}
                    prayer={prayer}
                    onDeleted={handlePrayerLogged}
                  />
                ))}
              </div>
            )}

            {/* Show unlogged prayers */}
            {dashboard?.todayPrayers && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-2">Remaining prayers:</p>
                <div className="flex flex-wrap gap-2">
                  {dashboard.todayPrayers
                    .filter((p) => p.status === null)
                    .map((p) => (
                      <span
                        key={p.prayerName}
                        className="inline-flex items-center gap-1 text-sm px-2 py-1 rounded bg-muted"
                      >
                        {PRAYER_ICONS[p.prayerName]} {PRAYER_LABELS[p.prayerName]}
                      </span>
                    ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}