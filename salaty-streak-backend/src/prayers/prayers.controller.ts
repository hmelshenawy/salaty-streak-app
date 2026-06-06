import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { PrayerName } from '@prisma/client';
import { PrayersService } from './prayers.service';
import { CreatePrayerLogDto } from './dto/create-prayer-log.dto';
import { UpdatePrayerLogDto } from './dto/update-prayer-log.dto';
import { TogglePrayerDto } from './dto/toggle-prayer.dto';
import { PrayerParamsDto } from './dto/prayer-params.dto';

@Controller('prayers')
export class PrayersController {
  constructor(private readonly prayersService: PrayersService) {}

  private validatePrayerType(raw: string): PrayerName {
    const upper = raw.toUpperCase();
    if (!Object.values(PrayerName).includes(upper as PrayerName)) {
      throw new BadRequestException(`Invalid prayer type: ${raw}`);
    }
    return upper as PrayerName;
  }

  @Post()
  create(
    @Request() req: { user: { sub: string } },
    @Body() createPrayerLogDto: CreatePrayerLogDto,
  ) {
    return this.prayersService.create(req.user.sub, createPrayerLogDto);
  }

  @Get('today')
  getToday(@Request() req: { user: { sub: string } }) {
    return this.prayersService.getToday(req.user.sub);
  }

  @Get('history')
  getHistory(
    @Request() req: { user: { sub: string } },
    @Query('month') month?: string,
  ) {
    return this.prayersService.getHistory(req.user.sub, month);
  }

  @Post(':prayerType/complete')
  complete(
    @Request() req: { user: { sub: string } },
    @Param() params: PrayerParamsDto,
    @Body() dto?: TogglePrayerDto,
  ) {
    const prayerType = this.validatePrayerType(params.prayerType);
    return this.prayersService.complete(req.user.sub, prayerType, dto?.date);
  }

  @Post(':prayerType/uncomplete')
  uncomplete(
    @Request() req: { user: { sub: string } },
    @Param() params: PrayerParamsDto,
    @Body() dto?: TogglePrayerDto,
  ) {
    const prayerType = this.validatePrayerType(params.prayerType);
    return this.prayersService.uncomplete(req.user.sub, prayerType, dto?.date);
  }

  @Put(':id')
  update(
    @Request() req: { user: { sub: string } },
    @Param('id') id: string,
    @Body() updatePrayerLogDto: UpdatePrayerLogDto,
  ) {
    return this.prayersService.update(req.user.sub, id, updatePrayerLogDto);
  }

  @Delete(':id')
  remove(
    @Request() req: { user: { sub: string } },
    @Param('id') id: string,
  ) {
    return this.prayersService.remove(req.user.sub, id);
  }
}