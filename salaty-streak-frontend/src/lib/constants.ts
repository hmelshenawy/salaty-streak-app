import { PrayerName, PrayerStatus } from '@/types/prayer';

export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3100';

export const PRAYER_NAMES: PrayerName[] = [
  'FAJR',
  'DHUHR',
  'ASR',
  'MAGHRIB',
  'ISHA',
];

export const PRAYER_LABELS: Record<PrayerName, string> = {
  FAJR: 'Fajr',
  DHUHR: 'Dhuhr',
  ASR: 'Asr',
  MAGHRIB: 'Maghrib',
  ISHA: 'Isha',
};

export const PRAYER_TIMES: Record<PrayerName, string> = {
  FAJR: 'Dawn',
  DHUHR: 'Noon',
  ASR: 'Afternoon',
  MAGHRIB: 'Sunset',
  ISHA: 'Night',
};

export const PRAYER_ICONS: Record<PrayerName, string> = {
  FAJR: '🌅',
  DHUHR: '☀️',
  ASR: '🌤️',
  MAGHRIB: '🌇',
  ISHA: '🌙',
};

export const STATUS_LABELS: Record<PrayerStatus, string> = {
  ON_TIME: 'On Time',
  LATE: 'Late',
  MISSED: 'Missed',
};

export const STATUS_COLORS: Record<PrayerStatus, string> = {
  ON_TIME: 'bg-emerald-500',
  LATE: 'bg-amber-500',
  MISSED: 'bg-red-500',
};

export const POINTS_RULES = {
  ON_TIME: 5,
  LATE: 1,
  MISSED: -10,
  IN_MOSQUE_BONUS: 21,
  FAJR_ON_TIME_BONUS: 15,
} as const;

export const TIMEZONES = [
  'Asia/Dubai',
  'Asia/Riyadh',
  'Asia/Cairo',
  'Asia/Istanbul',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Jakarta',
  'Asia/Kuala_Lumpur',
  'Europe/London',
  'Europe/Paris',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Australia/Sydney',
] as const;