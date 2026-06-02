'use client';

import { useDashboard } from '@/hooks/useDashboard';
import { usePrayerHistory } from '@/hooks/usePrayerHistory';
import { PageHeader } from '@/components/layout/PageHeader';
import { StreakCard } from '@/components/dashboard/StreakCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PRAYER_LABELS, STATUS_COLORS, STATUS_LABELS, PRAYER_ICONS } from '@/lib/constants';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

export function StreakCalendar() {
  const { data: dashboard } = useDashboard();
  const { prayers } = usePrayerHistory(format(new Date(), 'yyyy-MM'));

  // Group by date and calculate streak status
  const dayMap = new Map<string, { total: number; points: number; hasStreak: boolean }>();

  // Build a simple calendar grid for the current month
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  // Count prayers per day from history
  for (const prayer of prayers) {
    const dateKey = prayer.date.split('T')[0];
    const existing = dayMap.get(dateKey) || { total: 0, points: 0, hasStreak: false };
    existing.total++;
    existing.points += prayer.points;
    dayMap.set(dateKey, existing);
  }

  const days = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayData = dayMap.get(dateStr);
    days.push({
      day: d,
      dateStr,
      prayers: dayData?.total ?? 0,
      points: dayData?.points ?? 0,
      hasData: !!dayData,
    });
  }

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const today = now.getDate();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Streak Calendar</CardTitle>
        <p className="text-sm text-muted-foreground">
          {format(now, 'MMMM yyyy')}
        </p>
      </CardHeader>
      <CardContent>
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {weekDays.map((day) => (
            <div key={day} className="text-center text-xs font-medium text-muted-foreground py-1">
              {day}
            </div>
          ))}
        </div>
        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Empty cells for days before the 1st */}
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {days.map((day) => (
            <div
              key={day.day}
              className={`aspect-square rounded-md flex flex-col items-center justify-center text-xs ${
                day.day === today
                  ? 'ring-2 ring-emerald-500'
                  : ''
              } ${
                day.hasData
                  ? day.prayers >= 5
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
                    : day.prayers > 0
                      ? 'bg-amber-50 text-amber-700 dark:bg-amber-900 dark:text-amber-300'
                      : ''
                  : 'bg-muted/30 text-muted-foreground'
              }`}
            >
              <span className="font-medium">{day.day}</span>
              {day.hasData && (
                <span className="text-[10px] leading-none">{day.points}pts</span>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}