'use client';

import { Flame, Star, Target } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { PrayerCard } from './PrayerCard';
import { TodayPrayer } from '@/types/dashboard';

interface PrayerCardListProps {
  prayers: TodayPrayer[];
  currentStreak: number;
  monthlyPoints: number;
  completionRate: number;
  onPrayerLogged: () => void;
}

export function PrayerCardList({
  prayers,
  currentStreak,
  monthlyPoints,
  completionRate,
  onPrayerLogged,
}: PrayerCardListProps) {
  const { user } = useAuth();
  const completedCount = prayers.filter((p) => p.status).length;

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div>
      {/* Greeting & date */}
      <div className="mb-5">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">
            Assalamu Alaikum{user?.name ? `, ${user.name}` : ''}
          </h1>
          {currentStreak > 0 && (
            <div className="flex items-center gap-1 text-accent-foreground bg-accent/15 px-2.5 py-1 rounded-full">
              <Flame className="h-4 w-4 text-accent" />
              <span className="text-sm font-semibold">{currentStreak}</span>
            </div>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">{today}</p>
      </div>

      {/* Prayer cards */}
      <div className="space-y-3">
        {prayers.map((prayer) => (
          <PrayerCard
            key={prayer.prayerName}
            prayer={prayer}
            onLogged={onPrayerLogged}
          />
        ))}
      </div>

      {/* Compact stats row */}
      <div className="flex items-center justify-center gap-6 mt-5 py-3 px-4 rounded-xl bg-card ring-1 ring-foreground/5">
        <div className="flex items-center gap-1.5 text-sm">
          <Flame className="h-4 w-4 text-accent" />
          <span className="font-semibold">{currentStreak}</span>
          <span className="text-muted-foreground">day{currentStreak !== 1 ? 's' : ''}</span>
        </div>
        <div className="w-px h-4 bg-border" />
        <div className="flex items-center gap-1.5 text-sm">
          <Star className="h-4 w-4 text-accent" />
          <span className="font-semibold">{monthlyPoints}</span>
          <span className="text-muted-foreground">pts</span>
        </div>
        <div className="w-px h-4 bg-border" />
        <div className="flex items-center gap-1.5 text-sm">
          <Target className="h-4 w-4 text-primary" />
          <span className="font-semibold">{completionRate.toFixed(0)}%</span>
          <span className="text-muted-foreground">rate</span>
        </div>
      </div>

      {/* Motivational message */}
      {completedCount > 0 && completedCount < 5 && (
        <p className="text-center text-sm text-muted-foreground mt-3">
          {5 - completedCount} more prayer{5 - completedCount !== 1 ? 's' : ''} to maintain your streak ✨
        </p>
      )}
      {completedCount === 5 && (
        <p className="text-center text-sm text-primary font-medium mt-3">
          All prayers completed today! MashaAllah 🌙
        </p>
      )}
    </div>
  );
}