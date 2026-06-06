import { IsDateString, IsOptional } from 'class-validator';

export class TogglePrayerDto {
  @IsDateString()
  @IsOptional()
  date?: string;
}
