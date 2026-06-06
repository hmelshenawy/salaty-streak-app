import { IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { PrayerName } from '@prisma/client';

export class PrayerParamsDto {
  @IsEnum(PrayerName)
  @Transform(({ value }) => value?.toUpperCase())
  prayerType!: PrayerName;
}
