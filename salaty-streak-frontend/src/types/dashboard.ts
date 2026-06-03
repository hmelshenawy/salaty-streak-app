import { PrayerName, PrayerStatus } from './prayer';
import { NextMilestone } from './milestone';

export interface TodayPrayer {
  prayerName: PrayerName;
  status: PrayerStatus | null;
  inMosque: boolean;
  points: number;
  prayedAt: string | null;
  prayerTime: string | null; // HH:mm in user's timezone
}

export interface PrayerTimeEntry {
  prayerName: PrayerName;
  time: string; // HH:mm
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