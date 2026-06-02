import { dashboardService } from './dashboard.service';

export const streaksService = {
  async getStreaks() {
    const dashboard = await dashboardService.getDashboard();
    return {
      currentStreak: dashboard.currentStreak,
      bestStreak: dashboard.bestStreak,
    };
  },
};