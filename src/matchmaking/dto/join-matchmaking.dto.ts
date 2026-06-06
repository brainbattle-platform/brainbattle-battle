import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BattleFormat, BattleRole, BattleSkill } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';

export class JoinMatchmakingDto {
  @ApiProperty({
    enum: BattleFormat,
    example: BattleFormat.DUEL_1V1,
  })
  @IsEnum(BattleFormat)
  format!: BattleFormat;

  @ApiProperty({
    enum: BattleSkill,
    example: BattleSkill.GRAMMAR,
  })
  @IsEnum(BattleSkill)
  skill!: BattleSkill;

  @ApiPropertyOptional({
    enum: BattleRole,
    example: BattleRole.GRAMMAR,
    description: 'Required for TEAM_3V3 matchmaking.',
  })
  @IsOptional()
  @IsEnum(BattleRole)
  role?: BattleRole;

  @ApiPropertyOptional({
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isRanked?: boolean;
}