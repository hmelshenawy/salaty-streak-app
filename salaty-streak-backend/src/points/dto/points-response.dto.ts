import { IsNumber, IsString, IsEnum, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PointReason } from '@prisma/client';

export class PointsBreakdownDto {
  @IsNumber()
  dailyCompletion!: number;

  @IsNumber()
  streakBonus!: number;

  @IsNumber()
  adjustment!: number;
}

export class RecentTransactionDto {
  @IsString()
  id!: string;

  @IsNumber()
  points!: number;

  @IsEnum(PointReason)
  reason!: PointReason;

  @IsString()
  relatedDate!: string;

  @IsString()
  @IsOptional()
  description!: string | null;

  @IsString()
  createdAt!: string;
}

export class PointsSummaryResponseDto {
  @IsNumber()
  total!: number;

  @ValidateNested()
  @Type(() => PointsBreakdownDto)
  breakdown!: PointsBreakdownDto;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecentTransactionDto)
  recentTransactions!: RecentTransactionDto[];
}
