import { PrayerName, PrayerStatus } from './prayer';
import { NextMilestone } from './milestone';

export interface PrayerPeriod {
  label: 'early' | 'mid' | 'late';
  startOffset: number; // minutes after prayer start
  endOffset: number; // minutes after prayer start
}

export interface TodayPrayer {
  prayerName: PrayerName;
  status: PrayerStatus | null;
  inMosque: boolean;
  points: number;
  prayedAt: string | null;
  prayerTime: string | null; // HH:mm in user's timezone
  prayerTimestamp: string | null; // ISO timestamp
  endTime: string | null; // ISO timestamp
  windowMinutes: number;
  periods: PrayerPeriod[];
}

export interface PrayerTimeEntry {
  prayerName: PrayerName;
  time: string; // HH:mm
  timestamp: string; // ISO timestamp
  endTime: string; // ISO timestamp
  windowMinutes: number;
}

export interface DashboardResponse {
  currentStreak: number;
  bestStreak: number;
  monthlyPoints: number;
  completionRate: number;
  todayPrayers: TodayPrayer[];
  nextMilestone: NextMilestone | null;
  prayerTimes: PrayerTimeEntry[];
}