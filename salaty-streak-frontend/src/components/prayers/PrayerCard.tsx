'use client';

import { useState } from 'react';
import { Sunrise, Sun, CloudSun, Sunset, Moon, Check, Clock, X, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { PrayerName, PrayerStatus } from '@/types/prayer';
import { TodayPrayer } from '@/types/dashboard';
import { PRAYER_LABELS, PRAYER_TIMES, PRAYER_ICON_NAMES, STATUS_LABELS, STATUS_BG_COLORS, STATUS_TEXT_COLORS } from '@/lib/constants';
import { prayersService } from '@/services/prayers.service';

const PrayerIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  Sunrise,
  Sun,
  CloudSun,
  Sunset,
  Moon,
};

interface PrayerCardProps {
  prayer: TodayPrayer;
  onLogged: () => void;
}

export function PrayerCard({ prayer, onLogged }: PrayerCardProps) {
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

  return (
    <div className="flex items-center gap-3 p-4 rounded-xl bg-card ring-1 ring-foreground/5 transition-shadow hover:ring-foreground/10">
      {/* Prayer icon */}
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <IconComponent className="h-6 w-6" />
      </div>

      {/* Prayer info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-base">{PRAYER_LABELS[name]}</p>
        <p className="text-sm text-muted-foreground">{PRAYER_TIMES[name]}</p>
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
            <Badge variant="secondary" className="bg-primary/10 text-primary border-0 text-xs px-1.5">
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
                className="h-12 px-5 bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                disabled={loading}
              />
            }
          >
            {loading ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
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