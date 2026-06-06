import { IsString, IsNumber, IsEnum, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { AwardType } from '@prisma/client';

export class EarnedAwardDto {
  @IsString()
  id!: string;

  @IsEnum(AwardType)
  awardType!: AwardType;

  @IsNumber()
  milestone!: number;

  @IsString()
  title!: string;

  @IsString()
  @IsOptional()
  description!: string | null;

  @IsString()
  @IsOptional()
  icon!: string | null;

  @IsString()
  grantedAt!: string;
}

export class LockedAwardDto {
  @IsEnum(AwardType)
  awardType!: AwardType;

  @IsNumber()
  milestone!: number;

  @IsString()
  title!: string;

  @IsString()
  @IsOptional()
  description!: string | null;

  @IsNumber()
  progress!: number;

  @IsNumber()
  target!: number;
}

export class NextTargetDto {
  @IsNumber()
  milestone!: number;

  @IsString()
  title!: string;

  @IsNumber()
  remainingDays!: number;
}

export class AwardsResponseDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EarnedAwardDto)
  earned!: EarnedAwardDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LockedAwardDto)
  locked!: LockedAwardDto[];

  @ValidateNested()
  @Type(() => NextTargetDto)
  @IsOptional()
  nextTarget!: NextTargetDto | null;
}
