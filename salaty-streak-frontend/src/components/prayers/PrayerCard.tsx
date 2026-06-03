'use client';

import { useState } from 'react';
import { Sunrise, Sun, CloudSun, Sunset, Moon, Check, Clock, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { PrayerName, PrayerStatus } from '@/types/prayer';
import { PRAYER_LABELS, PRAYER_ICON_NAMES, PRAYER_ORDER, STATUS_LABELS, STATUS_BG_COLORS, STATUS_TEXT_COLORS } from '@/lib/constants';
import { prayersService } from '@/services/prayers.service';

const PrayerIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Sunrise,
  Sun,
  CloudSun,
  Sunset,
  Moon,
};

interface PrayerCardProps {
  prayer: {
    prayerName: PrayerName;
    status: PrayerStatus | null;
    inMosque: boolean;
    points: number;
    prayedAt: string | null;
    prayerTime: string | null;
  };
  isPast: boolean; // prayer time has passed and not yet logged
  onLogged: () => void;
}

export function PrayerCard({ prayer, isPast, onLogged }: PrayerCardProps) {
  const [loading, setLoading] = useState(false);
  const name = prayer.prayerName as PrayerName;
  const IconComponent = PrayerIconMap[PRAYER_ICON_NAMES[name]] || Sun;

  const logPrayer = async (status: PrayerStatus) => {
    setLoading(true);
    try {
      await prayersService.create({
        prayerName: name,
        status,
        date: new Date().toISOString().split('T')[0],
      });
      onLogged();
    } catch (err) {
      console.error('Failed to log prayer:', err);
    } finally {
      setLoading(false);
    }
  };

  // Format prayer time display
  const timeDisplay = prayer.prayerTime
    ? formatPrayerTime(prayer.prayerTime)
    : null;

  return (
    <div
      className={`flex items-center gap-3 p-4 rounded-xl bg-card ring-1 transition-shadow ${
        isPast && !prayer.status
          ? 'ring-destructive/20 opacity-60 hover:ring-destructive/30'
          : 'ring-foreground/5 hover:ring-foreground/10'
      }`}
    >
      {/* Prayer icon */}
      <div
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
          isPast && !prayer.status
            ? 'bg-destructive/10 text-destructive/60'
            : 'bg-primary/10 text-primary'
        }`}
      >
        <IconComponent className="h-6 w-6" />
      </div>

      {/* Prayer info */}
      <div className="flex-1 min-w-0">
        <p className={`font-medium text-base ${isPast && !prayer.status ? 'line-through decoration-destructive/40' : ''}`}>
          {PRAYER_LABELS[name]}
        </p>
        <div className="flex items-center gap-2">
          {timeDisplay && (
            <span className={`text-sm ${isPast && !prayer.status ? 'text-destructive/50' : 'text-muted-foreground'}`}>
              {timeDisplay}
            </span>
          )}
          {isPast && !prayer.status && (
            <span className="flex items-center gap-1 text-xs text-destructive/70">
              <AlertCircle className="h-3 w-3" />
              Overdue
            </span>
          )}
        </div>
      </div>

      {/* Status / Action */}
      {prayer.status ? (
        <div className="flex items-center gap-2 shrink-0">
          <Badge
            variant="secondary"
            className={`${STATUS_BG_COLORS[prayer.status]} ${STATUS_TEXT_COLORS[prayer.status]} border-0 font-medium`}
          >
            {STATUS_LABELS[prayer.status]}
          </Badge>
          {prayer.inMosque && (
            <Badge variant="secondary" className="bg-primary/10 text-primary border-0 text-[10px] px-1.5">
              🕌
            </Badge>
          )}
        </div>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                size="lg"
                className={`h-12 px-5 font-medium ${
                  isPast
                    ? 'bg-destructive/80 hover:bg-destructive text-destructive-foreground'
                    : 'bg-primary hover:bg-primary/90 text-primary-foreground'
                }`}
                disabled={loading}
              />
            }
          >
            {loading ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
            ) : isPast ? (
              <>
                <Clock className="h-4 w-4 mr-1.5" />
                Late
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-1.5" />
                Mark
              </>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="end" className="w-40">
            <DropdownMenuItem onClick={() => logPrayer('ON_TIME')} className="gap-2">
              <Check className="h-4 w-4 text-status-ontime" />
              On Time
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => logPrayer('LATE')} className="gap-2">
              <Clock className="h-4 w-4 text-status-late" />
              Late
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => logPrayer('MISSED')} className="gap-2">
              <X className="h-4 w-4 text-status-missed" />
              Missed
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

/** Format "16:30" → "4:30 PM" */
function formatPrayerTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}