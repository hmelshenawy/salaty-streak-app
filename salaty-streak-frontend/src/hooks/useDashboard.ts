'use client';

import { useState, useEffect, useCallback } from 'react';
import { DashboardResponse } from '@/types/dashboard';
import { dashboardService } from '@/services/dashboard.service';

/**
 * useDashboard hook
 *
 * Fetches the full dashboard payload from `/dashboard`.
 * The response shape is backward-compatible: all legacy fields are always present.
 * New optional fields (`points`, `awards`, `timezone`) are populated when the
 * backend feature flags are ON and the new dashboard engine is active.
 * This hook is safe to use with both old and new response shapes.
 */
export function useDashboard() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await dashboardService.getDashboard();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  return { data, loading, error, refresh: fetchDashboard };
}
