import { ApiPropertyOptional } from '@nestjs/swagger';
import { BattleFormat, BattleRoomStatus } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class AdminListRoomsDto {
  @ApiPropertyOptional({ enum: BattleRoomStatus })
  @IsOptional()
  @IsEnum(BattleRoomStatus)
  status?: BattleRoomStatus;

  @ApiPropertyOptional({ enum: BattleFormat })
  @IsOptional()
  @IsEnum(BattleFormat)
  format?: BattleFormat;

  @ApiPropertyOptional({ example: 'ABC123' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ example: 'user-id' })
  @IsOptional()
  @IsString()
  userId?: string;

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