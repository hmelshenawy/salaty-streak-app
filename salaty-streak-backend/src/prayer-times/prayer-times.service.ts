import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrayerName } from '@prisma/client';
import { toZonedTime } from 'date-fns-tz';
import { format } from 'date-fns';

export interface PrayerTimeEntry {
  prayerName: PrayerName;
  time: string; // HH:mm format in user's timezone
  timestamp: Date; // UTC timestamp for comparison
}

export interface PrayerTimesResponse {
  date: string;
  timezone: string;
  times: PrayerTimeEntry[];
}

/**
 * Maps Aladhan API prayer names to our PrayerName enum.
 */
const ALADHAN_MAP: Record<string, PrayerName> = {
  Fajr: 'FAJR',
  Dhuhr: 'DHUHR',
  Asr: 'ASR',
  Maghrib: 'MAGHRIB',
  Isha: 'ISHA',
};

/**
 * Default coordinates for well-known timezones.
 * Used as fallback when no coordinates are stored for the user.
 */
const TIMEZONE_COORDS: Record<string, { lat: number; lng: number }> = {
  'Asia/Dubai': { lat: 25.2048, lng: 55.2708 },
  'Asia/Riyadh': { lat: 24.7136, lng: 46.6753 },
  'Asia/Cairo': { lat: 30.0444, lng: 31.2357 },
  'Asia/Istanbul': { lat: 41.0082, lng: 28.9784 },
  'Asia/Karachi': { lat: 24.8607, lng: 67.0011 },
  'Asia/Kolkata': { lat: 19.076, lng: 72.8777 },
  'Asia/Jakarta': { lat: -6.2088, lng: 106.8456 },
  'Asia/Kuala_Lumpur': { lat: 3.139, lng: 101.6869 },
  'Europe/London': { lat: 51.5074, lng: -0.1278 },
  'Europe/Paris': { lat: 48.8566, lng: 2.3522 },
  'America/New_York': { lat: 40.7128, lng: -74.006 },
  'America/Chicago': { lat: 41.8781, lng: -87.6298 },
  'America/Denver': { lat: 39.7392, lng: -104.9903 },
  'America/Los_Angeles': { lat: 34.0522, lng: -118.2437 },
  'Australia/Sydney': { lat: -33.8688, lng: 151.2093 },
};

@Injectable()
export class PrayerTimesService {
  private readonly logger = new Logger(PrayerTimesService.name);
  private cache = new Map<string, { data: PrayerTimesResponse; expiresAt: number }>();

  constructor(private configService: ConfigService) {}

  /**
   * Get today's prayer times for a user.
   * Uses Aladhan API with coordinates (from user profile or timezone fallback).
   * Results are cached for 1 hour.
   */
  async getPrayerTimes(
    userId: string,
    timezone: string,
    latitude?: number,
    longitude?: number,
  ): Promise<PrayerTimesResponse> {
    const now = new Date();
    const zonedNow = toZonedTime(now, timezone);
    const dateStr = format(zonedNow, 'yyyy-MM-dd');
    const cacheKey = `${dateStr}-${timezone}-${latitude}-${longitude}`;

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }

    // Determine coordinates
    const coords = latitude && longitude
      ? { lat: latitude, lng: longitude }
      : TIMEZONE_COORDS[timezone] ?? TIMEZONE_COORDS['Asia/Dubai'];

    try {
      const times = await this.fetchFromAladhan(coords.lat, coords.lng, timezone, dateStr);
      const result: PrayerTimesResponse = {
        date: dateStr,
        timezone,
        times,
      };

      // Cache for 1 hour
      this.cache.set(cacheKey, { data: result, expiresAt: Date.now() + 3600000 });
      return result;
    } catch (error) {
      this.logger.error(`Failed to fetch prayer times: ${error.message}`);
      // Return estimated times as fallback
      return this.getEstimatedPrayerTimes(timezone, dateStr);
    }
  }

  private async fetchFromAladhan(
    lat: number,
    lng: number,
    timezone: string,
    dateStr: string,
  ): Promise<PrayerTimeEntry[]> {
    const [year, month, day] = dateStr.split('-').map(Number);

    const url = `https://api.aladhan.com/v1/timings/${day}-${month}-${year}?latitude=${lat}&longitude=${lng}&method=2&school=0`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Aladhan API returned ${response.status}`);
    }

    const data = await response.json();
    const timings = data.data.timings;

    const times: PrayerTimeEntry[] = [];

    for (const [aladhanName, timeStr] of Object.entries(timings)) {
      const prayerName = ALADHAN_MAP[aladhanName];
      if (!prayerName) continue;

      // Parse time string like "04:32" or "04:32 (EEST)"
      const cleanTime = (timeStr as string).split(' ')[0];
      const [hours, minutes] = cleanTime.split(':').map(Number);

      // Convert to UTC Date for comparison
      const zonedDate = toZonedTime(new Date(), timezone);
      const zonedYear = zonedDate.getFullYear();
      const zonedMonth = zonedDate.getMonth();
      const zonedDay = zonedDate.getDate();

      // Create a date in the user's timezone then convert to UTC
      const localDate = new Date(zonedYear, zonedMonth, zonedDay, hours, minutes, 0);
      const utcTimestamp = new Date(localDate.getTime() - localDate.getTimezoneOffset() * 60000);

      times.push({
        prayerName,
        time: cleanTime,
        timestamp: utcTimestamp,
      });
    }

    // Sort by prayer order
    const prayerOrder: Record<PrayerName, number> = {
      FAJR: 0,
      DHUHR: 1,
      ASR: 2,
      MAGHRIB: 3,
      ISHA: 4,
    };

    return times.sort((a, b) => prayerOrder[a.prayerName] - prayerOrder[b.prayerName]);
  }

  /**
   * Fallback: estimate prayer times based on timezone.
   * Uses approximate times that are reasonable for most Muslim-majority regions.
   */
  private getEstimatedPrayerTimes(
    timezone: string,
    dateStr: string,
  ): PrayerTimesResponse {
    const [year, month, day] = dateStr.split('-').map(Number);

    // Approximate prayer times (varies by season/location but reasonable defaults)
    const estimates: Record<PrayerName, { h: number; m: number }> = {
      FAJR: { h: 4, m: 30 },
      DHUHR: { h: 12, m: 15 },
      ASR: { h: 15, m: 30 },
      MAGHRIB: { h: 18, m: 30 },
      ISHA: { h: 20, m: 0 },
    };

    const times: PrayerTimeEntry[] = Object.entries(estimates).map(
      ([prayerName, { h, m }]) => {
        const localDate = new Date(year, month - 1, day, h, m, 0);
        const utcTimestamp = new Date(
          localDate.getTime() - localDate.getTimezoneOffset() * 60000,
        );
        return {
          prayerName: prayerName as PrayerName,
          time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
          timestamp: utcTimestamp,
        };
      },
    );

    return { date: dateStr, timezone, times };
  }
}