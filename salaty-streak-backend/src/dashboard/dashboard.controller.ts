import { Controller, Get, Request, ForbiddenException } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  getDashboard(@Request() req: { user: { sub: string } }) {
    return this.dashboardService.getDashboard(req.user.sub);
  }

  @Get('compare')
  async compareDashboard(@Request() req: { user: { sub: string } }) {
    if (process.env.ENABLE_DASHBOARD_COMPARISON !== 'true') {
      throw new ForbiddenException('Dashboard comparison is disabled');
    }
    return this.dashboardService.compareDashboardCalculations(req.user.sub);
  }
}