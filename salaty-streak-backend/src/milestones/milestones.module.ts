import { Global, Module } from '@nestjs/common';
import { MilestonesService } from './milestones.service';
import { StreaksModule } from '../streaks/streaks.module';

@Global()
@Module({
  imports: [StreaksModule],
  providers: [MilestonesService],
  exports: [MilestonesService],
})
export class MilestonesModule {}