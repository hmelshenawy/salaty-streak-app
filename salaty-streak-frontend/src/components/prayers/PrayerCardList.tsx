'use client';

import { Flame, Star, Target } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUnviewedMilestones } from '@/hooks/useUnviewedMilestones';
import { PrayerCard } from './PrayerCard';
import { TodayPrayer, PrayerTimeEntry } from '@/types/dashboard';
import { PrayerName, PrayerStatus } from '@/types/prayer';
import { PRAYER_ORDER } from '@/lib/constants';

interface PrayerCardListProps {
  prayers: TodayPrayer[];
  prayerTimes: PrayerTimeEntry[];
  currentStreak: number;
  monthlyPoints: number;
  completionRate: number;
  onPrayerLogged: () => void;
}

/**
 * Determine which prayers are "past" (their time window has ended).
 * A prayer is past if the current time is after the NEXT prayer's start time,
 * or if it's Isha and current time is past Isha + a buffer.
 * Simplified: a prayer is past when we've moved past its time slot.
 */
function getPastPrayers(prayerTimes: PrayerTimeEntry[]): Set<PrayerName> {
  const now = new Date();
  const past = new Set<PrayerName>();

  if (prayerTimes.length === 0) return past;

  // Parse prayer times into minutes-since-midnight for comparison
  const timeSlots = prayerTimes.map((pt) => {
    const [h, m] = pt.time.split(':').map(Number);
    return {
      prayerName: pt.prayerName,
      minutes: h * 60 + m,
    };
  });

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // A prayer is "past" when current time exceeds the next prayer's start time
  // For Isha, it's past when it's after Isha time + 2 hours buffer
  for (let i = 0; i < timeSlots.length; i++) {
    const nextSlotMinutes = i < timeSlots.length - 1
      ? timeSlots[i + 1].minutes
      : timeSlots[i].minutes + 120; // 2hr after Isha

    if (currentMinutes >= nextSlotMinutes) {
      past.add(timeSlots[i].prayerName);
    }
  }

  // Special case: before Fajr, no prayers are past
  // Between Isha and midnight (after Fajr next day conceptually), Isha is current
  // Handle overnight: between Isha and Fajr, Isha is NOT past yet
  const fajrMinutes = timeSlots.find(t => t.prayerName === 'FAJR')?.minutes ?? 300;
  if (currentMinutes < fajrMinutes) {
    // Before Fajr — Isha is still "current" from yesterday perspective
    // Actually, we consider all prayers still open for today
    past.clear();
  }

  return past;
}

export function PrayerCardList({
  prayers,
  prayerTimes,
  currentStreak,
  monthlyPoints,
  completionRate,
  onPrayerLogged,
}: PrayerCardListProps) {
  const { user } = useAuth();
  const { checkAgain: checkMilestones } = useUnviewedMilestones();
  const completedCount = prayers.filter((p) => p.status).length;

  const handlePrayerLogged = () => {
    onPrayerLogged();
    setTimeout(() => checkMilestones(), 1500);
  };

  // Build a map of prayer times for quick lookup
  const prayerTimeMap = new Map(prayerTimes.map(pt => [pt.prayerName, pt.time]));

  // Determine which prayers are past their time slot
  const pastPrayers = getPastPrayers(prayerTimes);

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
        {prayers.map((prayer ) => (
          <PrayerCard
            key={prayer.prayerName}
            prayer={prayer}
            isPast={pastPrayers.has(prayer.prayerName) && !prayer.status}
            onLogged={handlePrayerLogged}
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