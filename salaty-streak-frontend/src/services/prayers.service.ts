import { apiClient } from '@/lib/api';
import { PrayerLog, CreatePrayerLogDto, UpdatePrayerLogDto, PrayerName } from '@/types/prayer';

export const prayersService = {
  async quickLog(data: { prayerName: PrayerName; date: string; inMosque?: boolean }): Promise<PrayerLog> {
    return apiClient.post<PrayerLog>('/prayers', {
      ...data,
      status: 'ON_TIME',
      prayedAt: new Date().toISOString(),
    });
  },

  async create(data: CreatePrayerLogDto): Promise<PrayerLog> {
    return apiClient.post<PrayerLog>('/prayers', data);
  },

  async getToday(): Promise<PrayerLog[]> {
    return apiClient.get<PrayerLog[]>('/prayers/today');
  },

  async getHistory(month?: string): Promise<PrayerLog[]> {
    const query = month ? `?month=${month}` : '';
    return apiClient.get<PrayerLog[]>(`/prayers/history${query}`);
  },

  async update(id: string, data: UpdatePrayerLogDto): Promise<PrayerLog> {
    return apiClient.put<PrayerLog>(`/prayers/${id}`, data);
  },

  async remove(id: string): Promise<void> {
    return apiClient.delete<void>(`/prayers/${id}`);
  },

  // New toggle endpoints (Phase 4)
  async quickComplete(prayerName: PrayerName, date?: string): Promise<PrayerLog> {
    const body = date ? { date } : undefined;
    return apiClient.post<PrayerLog>(`/prayers/${prayerName.toLowerCase()}/complete`, body);
  },

  async quickUncomplete(prayerName: PrayerName, date?: string): Promise<PrayerLog | { message: string }> {
    const body = date ? { date } : undefined;
    return apiClient.post<PrayerLog | { message: string }>(`/prayers/${prayerName.toLowerCase()}/uncomplete`, body);
  },
};
