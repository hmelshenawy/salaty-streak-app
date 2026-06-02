'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { PRAYER_NAMES, PRAYER_LABELS, PRAYER_ICONS } from '@/lib/constants';
import { PrayerName, PrayerStatus, CreatePrayerLogDto } from '@/types/prayer';
import { prayersService } from '@/services/prayers.service';

interface PrayerLogFormProps {
  onLogged?: () => void;
}

export function PrayerLogForm({ onLogged }: PrayerLogFormProps) {
  const [prayerName, setPrayerName] = useState<PrayerName | ''>('');
  const [status, setStatus] = useState<PrayerStatus | ''>('');
  const [inMosque, setInMosque] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const today = new Date().toISOString().split('T')[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prayerName || !status) return;

    setLoading(true);
    setError('');

    try {
      const dto: CreatePrayerLogDto = {
        prayerName: prayerName as PrayerName,
        status: status as PrayerStatus,
        date: today,
        inMosque,
      };

      await prayersService.create(dto);
      setPrayerName('');
      setStatus('');
      setInMosque(false);
      onLogged?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log prayer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Log a Prayer</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label>Prayer</Label>
            <Select value={prayerName} onValueChange={(v) => setPrayerName(v as PrayerName)}>
              <SelectTrigger>
                <SelectValue placeholder="Select prayer" />
              </SelectTrigger>
              <SelectContent>
                {PRAYER_NAMES.map((name) => (
                  <SelectItem key={name} value={name}>
                    {PRAYER_ICONS[name]} {PRAYER_LABELS[name]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as PrayerStatus)}>
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ON_TIME">✅ On Time (+5 pts)</SelectItem>
                <SelectItem value="LATE">⏰ Late (+1 pt)</SelectItem>
                <SelectItem value="MISSED">❌ Missed (-10 pts)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setInMosque(!inMosque)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                inMosque
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                  : 'border-border text-muted-foreground hover:border-muted-foreground'
              }`}
            >
              🕌 In Mosque {inMosque ? '(+21 pts)' : ''}
            </button>
          </div>

          <Button
            type="submit"
            className="w-full bg-emerald-600 hover:bg-emerald-700"
            disabled={!prayerName || !status || loading}
          >
            {loading ? 'Logging...' : 'Log Prayer'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}