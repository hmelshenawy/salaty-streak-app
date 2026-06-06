import { PrayerName, PrayerStatus } from './prayer';
import { NextMilestone } from './milestone';
import { AwardsSummary } from './award';

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

export interface PointsBreakdown {
  dailyCompletion: number;
  streakBonus: number;
  adjustment: number;
}

export interface PointsSummary {
  total: number;
  breakdown: PointsBreakdown;
  recentTransactions: {
    id: string;
    points: number;
    reason: string;
    relatedDate: string;
    description: string | null;
    createdAt: string;
  }[];
}

export interface TimezoneInfo {
  value: string;
  isDefaulted: boolean;
}

export interface DashboardResponse {
  currentStreak: number;
  bestStreak: number;
  monthlyPoints: number;
  completionRate: number;
  todayPrayers: TodayPrayer[];
  nextMilestone: NextMilestone | null;
  prayerTimes: PrayerTimeEntry[];

  // New fields (optional during transition)
  points?: PointsSummary;
  awards?: AwardsSummary;
  timezone?: TimezoneInfo;
}
