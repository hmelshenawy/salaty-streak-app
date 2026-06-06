import { Controller, Get, Request } from '@nestjs/common';
import { PointsService } from './points.service';

@Controller('points')
export class PointsController {
  constructor(private readonly pointsService: PointsService) {}

  @Get('summary')
  getSummary(@Request() req: { user: { sub: string } }) {
    return this.pointsService.getSummary(req.user.sub);
  }
}
