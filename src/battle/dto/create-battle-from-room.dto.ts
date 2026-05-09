import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class CreateBattleFromRoomDto {
  @ApiPropertyOptional({
    example: 10,
    default: 10,
    description: 'Question count for DUEL_1V1. For TEAM_3V3, each role receives this count.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(20)
  questionCount?: number;
}