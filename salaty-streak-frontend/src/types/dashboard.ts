import { PrayerName, PrayerStatus } from './prayer';

export interface TodayPrayer {
  prayerName: PrayerName;
  status: PrayerStatus | null;
  inMosque: boolean;
  points: number;
  prayedAt: string | null;
}

export interface DashboardResponse {
  currentStreak: number;
  bestStreak: number;
  monthlyPoints: number;
  completionRate: number;
  todayPrayers: TodayPrayer[];
}