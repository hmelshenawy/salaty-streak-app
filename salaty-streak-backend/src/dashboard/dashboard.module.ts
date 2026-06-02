import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { StreaksModule } from '../streaks/streaks.module';
import { MilestonesModule } from '../milestones/milestones.module';

@Module({
  imports: [StreaksModule, MilestonesModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}