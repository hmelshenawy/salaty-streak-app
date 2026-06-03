'use client';

import { useEffect, useState } from 'react';
import { Clock, Flame, Star, Target, TriangleAlert } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUnviewedMilestones } from '@/hooks/useUnviewedMilestones';
import { PrayerCard } from './PrayerCard';
import { TodayPrayer, PrayerTimeEntry } from '@/types/dashboard';
import { PrayerName } from '@/types/prayer';

interface PrayerCardListProps {
  prayers: TodayPrayer[];
  prayerTimes: PrayerTimeEntry[];
  currentStreak: number;
  monthlyPoints: number;
  completionRate: number;
  onPrayerLogged: () => void;
}

const PRAYER_DISPLAY: Record<PrayerName, string> = {
  FAJR: 'Fajr',
  DHUHR: 'Dhuhr',
  ASR: 'Asr',
  MAGHRIB: 'Maghrib',
  ISHA: 'Isha',
};

function formatDuration(ms: number) {
  if (ms <= 0) return 'Now';
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const seconds = Math.floor((ms % 60000) / 1000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function getPastPrayers(prayerTimes: PrayerTimeEntry[]): Set<PrayerName> {
  const now = Date.now();
  const past = new Set<PrayerName>();
  if (prayerTimes.length === 0) return past;

  for (const prayerTime of prayerTimes) {
    if (now >= new Date(prayerTime.endTime).getTime()) {
      past.add(prayerTime.prayerName);
    }
  }

  const fajr = prayerTimes.find((pt) => pt.prayerName === 'FAJR');
  if (fajr && now < new Date(fajr.timestamp).getTime()) {
    past.clear();
  }

  return past;
}

function getCurrentOrNextPrayer(prayerTimes: PrayerTimeEntry[]) {
  const now = Date.now();
  for (const prayerTime of prayerTimes) {
    if (now < new Date(prayerTime.endTime).getTime()) return prayerTime;
  }
  return null;
}

function isCurrentPrayer(prayerName: PrayerName, prayerTimes: PrayerTimeEntry[]) {
  const now = Date.now();
  const prayerTime = prayerTimes.find((pt) => pt.prayerName === prayerName);
  if (!prayerTime) return false;
  const start = new Date(prayerTime.timestamp).getTime();
  const end = new Date(prayerTime.endTime).getTime();
  return now >= start && now < end;
}

function PrayerCountdown({ prayerName, timestamp, endTime }: PrayerTimeEntry) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const startMs = new Date(timestamp).getTime();
  const endMs = new Date(endTime).getTime();
  const startsIn = startMs - now;

  if (startsIn > 0) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-primary/10 ring-1 ring-primary/20">
        <Clock className="h-5 w-5 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-primary">Next: {PRAYER_DISPLAY[prayerName] ?? prayerName}</p>
          <p className="text-xs text-muted-foreground">
            Starts in <span className="font-semibold text-foreground">{formatDuration(startsIn)}</span>
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-bold text-primary tabular-nums">{formatDuration(startsIn)}</p>
        </div>
      </div>
    );
  }

  const remaining = endMs - now;
  if (remaining > 0) {
    const progress = Math.min((now - startMs) / (endMs - startMs), 1);
    const remainingMinutes = remaining / 60000;
    const urgent = remainingMinutes <= 15;
    const warning = remainingMinutes <= 30;
    const Icon = urgent ? TriangleAlert : Clock;

    return (
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl ${
        urgent ? 'bg-destructive/10 ring-destructive/30'
          : warning ? 'bg-amber-500/10 ring-amber-500/30'
            : 'bg-accent/10 ring-accent/20'
      } ring-1`}>
        <Icon className={`h-5 w-5 ${urgent ? 'text-destructive' : warning ? 'text-amber-500' : 'text-accent'} shrink-0`} />
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${urgent ? 'text-destructive' : warning ? 'text-amber-500' : 'text-accent-foreground'}`}>
            {urgent ? '⚠️ ' : ''}Now: {PRAYER_DISPLAY[prayerName] ?? prayerName}
          </p>
          <p className="text-xs text-muted-foreground">
            {urgent ? (
              <span className="font-semibold text-destructive">{formatDuration(remaining)} left — Pray now!</span>
            ) : warning ? (
              <span className="font-semibold text-amber-500">{formatDuration(remaining)} remaining</span>
            ) : (
              <>Time remaining <span className="font-semibold text-foreground">{formatDuration(remaining)}</span></>
            )}
          </p>
        </div>
        <div className="relative h-10 w-10 shrink-0">
          <svg className="h-10 w-10 -rotate-90" viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/30" />
            <circle
              cx="18"
              cy="18"
              r="15"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeDasharray={`${94.25 * progress} 94.25`}
              strokeLinecap="round"
              className={urgent ? 'text-destructive' : warning ? 'text-amber-500' : 'text-accent'}
            />
          </svg>
        </div>
      </div>
    );
  }

  return null;
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
  const [, forceTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => forceTick((tick) => tick + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  const handlePrayerLogged = () => {
    onPrayerLogged();
    setTimeout(() => checkMilestones(), 1500);
  };

  const pastPrayers = getPastPrayers(prayerTimes);
  const currentOrNextPrayer = getCurrentOrNextPrayer(prayerTimes);

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div>
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

      {currentOrNextPrayer && (
        <div className="mb-4">
          <PrayerCountdown {...currentOrNextPrayer} />
        </div>
      )}

      <div className="space-y-3">
        {prayers.map((prayer) => (
          <PrayerCard
            key={prayer.prayerName}
            prayer={prayer}
            isPast={pastPrayers.has(prayer.prayerName) && !prayer.status}
            isCurrent={isCurrentPrayer(prayer.prayerName, prayerTimes)}
            onLogged={handlePrayerLogged}
          />
        ))}
      </div>

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