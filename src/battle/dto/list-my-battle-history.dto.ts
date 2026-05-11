import { ApiPropertyOptional } from '@nestjs/swagger';
import { BattleFormat, BattlePlayerResult, BattleStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export class ListMyBattleHistoryDto {
  @ApiPropertyOptional({ enum: BattleStatus })
  @IsOptional()
  @IsEnum(BattleStatus)
  status?: BattleStatus;

  @ApiPropertyOptional({ enum: BattleFormat })
  @IsOptional()
  @IsEnum(BattleFormat)
  format?: BattleFormat;

  @ApiPropertyOptional({ enum: BattlePlayerResult })
  @IsOptional()
  @IsEnum(BattlePlayerResult)
  result?: BattlePlayerResult;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}