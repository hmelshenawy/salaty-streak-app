import { Module } from '@nestjs/common';
import { PrayersService } from './prayers.service';
import { PrayersController } from './prayers.controller';
import { DailySummaryModule } from '../daily-summary/daily-summary.module';
import { PointsModule } from '../points/points.module';
import { AwardsModule } from '../awards/awards.module';
import { StreaksModule } from '../streaks/streaks.module';

@Module({
  imports: [DailySummaryModule, PointsModule, AwardsModule, StreaksModule],
  controllers: [PrayersController],
  providers: [PrayersService],
  exports: [PrayersService],
})
export class PrayersModule {}