'use client';

import { useState } from 'react';
import { Check, X, CircleAlert, Sun, Sunrise, CloudSun, Sunset, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { prayersService } from '@/services/prayers.service';
import { TodayPrayer, PrayerPeriod } from '@/types/dashboard';
import { PRAYER_ICON_NAMES, PRAYER_LABELS, PRAYER_TIMES, STATUS_BG_COLORS, STATUS_LABELS, STATUS_TEXT_COLORS } from '@/lib/constants';

const ICONS = { Sunrise, Sun, CloudSun, Sunset, Moon };
const PERIOD_COLORS: Record<PrayerPeriod['label'], string> = {
  early: 'bg-emerald-500',
  mid: 'bg-amber-400',
  late: 'bg-red-500',
};
const PERIOD_LABELS: Record<PrayerPeriod['label'], string> = {
  early: 'Early',
  mid: 'On Time',
  late: 'Late',
};

function formatPrayerTime(time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  return `${hours === 0 ? 12 : hours > 12 ? hours - 12 : hours}:${String(minutes).padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`;
}

function getCurrentPeriod(periods: PrayerPeriod[], prayerTimestamp?: string | null) {
  if (!prayerTimestamp || periods.length === 0) return null;
  const elapsedMinutes = (Date.now() - new Date(prayerTimestamp).getTime()) / 60000;
  for (const period of periods) {
    if (elapsedMinutes >= period.startOffset && elapsedMinutes < period.endOffset) return period;
  }
  return periods[periods.length - 1];
}

interface PrayerCardProps {
  prayer: TodayPrayer;
  isPast: boolean;
  isCurrent?: boolean;
  onLogged: () => void;
}

export function PrayerCard({ prayer, isPast, isCurrent = false, onLogged }: PrayerCardProps) {
  const [loading, setLoading] = useState(false);
  const [inMosque, setInMosque] = useState(false);
  const prayerName = prayer.prayerName;
  const Icon = ICONS[PRAYER_ICON_NAMES[prayerName]] || Sun;

  const handleComplete = async () => {
    setLoading(true);
    try {
      await prayersService.quickComplete(prayerName);
      setInMosque(false);
      onLogged();
    } catch (error) {
      console.error('Failed to complete prayer:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUncomplete = async () => {
    setLoading(true);
    try {
      await prayersService.quickUncomplete(prayerName);
      onLogged();
    } catch (error) {
      console.error('Failed to uncomplete prayer:', error);
    } finally {
      setLoading(false);
    }
  };

  const timeLabel = prayer.prayerTime ? formatPrayerTime(prayer.prayerTime) : PRAYER_TIMES[prayerName];
  const activePeriod = prayer.status || isPast || !isCurrent ? null : getCurrentPeriod(prayer.periods, prayer.prayerTimestamp);
  const missedPeriod = isPast && !prayer.status ? getCurrentPeriod(prayer.periods, prayer.prayerTimestamp) : null;
  const period = activePeriod ?? missedPeriod;

  return (
    <div className={`flex items-center gap-3 p-4 rounded-xl bg-card ring-1 transition-shadow ${
      isPast && !prayer.status
        ? 'ring-destructive/20 opacity-60 hover:ring-destructive/30'
        : isCurrent && !prayer.status
          ? 'ring-primary/30 hover:ring-primary/40'
          : 'ring-foreground/5 hover:ring-foreground/10'
    }`}>
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
        isPast && !prayer.status
          ? 'bg-destructive/10 text-destructive/60'
          : isCurrent && !prayer.status
            ? 'bg-primary/15 text-primary'
            : 'bg-primary/10 text-primary'
      }`}>
        <Icon className="h-6 w-6" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className={`font-medium text-base ${isPast && !prayer.status ? 'line-through decoration-destructive/40' : ''}`}>
            {PRAYER_LABELS[prayerName]}
          </p>
          {period && (
            <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
              period.label === 'early'
                ? 'bg-emerald-500/15 text-emerald-400'
                : period.label === 'mid'
                  ? 'bg-amber-400/15 text-amber-400'
                  : 'bg-red-500/15 text-red-400'
            }`}>
              {PERIOD_LABELS[period.label]}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {timeLabel && <span className={`text-sm ${isPast && !prayer.status ? 'text-destructive/50' : 'text-muted-foreground'}`}>{timeLabel}</span>}
          {isPast && !prayer.status && (
            <span className="flex items-center gap-1 text-xs text-destructive/70">
              <CircleAlert className="h-3 w-3" /> Missed
            </span>
          )}
          {isCurrent && !prayer.status && !isPast && prayer.windowMinutes > 0 && (
            <span className="text-xs text-primary/70">{prayer.windowMinutes}min window</span>
          )}
        </div>

        {period && prayer.periods.length > 0 && !prayer.status && (
          <div className="flex gap-0.5 mt-1.5 h-1.5 rounded-full overflow-hidden">
            {prayer.periods.map((p) => (
              <div
                key={p.label}
                className={`${PERIOD_COLORS[p.label]} ${p.label === period.label ? 'opacity-100' : 'opacity-30'} transition-opacity`}
                style={{ width: `${((p.endOffset - p.startOffset) / prayer.windowMinutes) * 100}%` }}
              />
            ))}
          </div>
        )}
      </div>

      {prayer.status ? (
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="secondary" className={`${STATUS_BG_COLORS[prayer.status]} ${STATUS_TEXT_COLORS[prayer.status]} border-0 font-medium`}>
            {STATUS_LABELS[prayer.status]}
          </Badge>
          {prayer.inMosque && <Badge variant="secondary" className="bg-primary/10 text-primary border-0 text-xs px-1.5">🕌</Badge>}
          {(prayer.status === 'ON_TIME' || prayer.status === 'LATE') && !isPast && (
            <button
              type="button"
              onClick={handleUncomplete}
              disabled={loading}
              className="text-xs text-muted-foreground hover:text-destructive transition-colors px-1"
              title="Mark as missed"
            >
              {loading ? (
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground inline-block" />
              ) : (
                <X className="h-3.5 w-3.5" />
              )}
            </button>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setInMosque(!inMosque)}
            disabled={isPast}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              isPast
                ? 'opacity-40 cursor-not-allowed bg-muted/30 text-muted-foreground'
                : inMosque
                  ? 'bg-primary/15 text-primary ring-1 ring-primary/30'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <span className="text-sm">🕌</span> Mosque
          </button>
          <Button
            size="lg"
            className={`h-12 px-5 font-medium ${
              isPast
                ? 'bg-muted text-muted-foreground opacity-50'
                : isCurrent
                  ? 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20'
                  : 'bg-primary/80 hover:bg-primary text-primary-foreground'
            }`}
            disabled={loading || isPast}
            onClick={handleComplete}
          >
            {loading ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
            ) : isPast ? (
              <><X className="h-4 w-4 mr-1.5" />Missed</>
            ) : (
              <><Check className="h-4 w-4 mr-1.5" />Pray</>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
