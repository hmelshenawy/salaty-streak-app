import { Controller, Get, Request } from '@nestjs/common';
import { AwardsService } from './awards.service';

@Controller('awards')
export class AwardsController {
  constructor(private readonly awardsService: AwardsService) {}

  @Get()
  getAwards(@Request() req: { user: { sub: string } }) {
    return this.awardsService.getAwards(req.user.sub);
  }
}
