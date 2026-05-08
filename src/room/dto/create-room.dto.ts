import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BattleFormat, BattleRole, BattleSkill, RoomTeam } from '@prisma/client';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';

export class CreateRoomDto {
  @ApiProperty({
    enum: BattleFormat,
    example: BattleFormat.DUEL_1V1,
    description: 'DUEL_1V1 = 2 players, TEAM_3V3 = 6 players role-based',
  })
  @IsEnum(BattleFormat)
  format!: BattleFormat;

  @ApiProperty({
    enum: BattleSkill,
    example: BattleSkill.GRAMMAR,
    description:
      'For DUEL_1V1 choose GRAMMAR/LISTENING/VOCABULARY/MIXED. For TEAM_3V3 service will force MIXED.',
  })
  @IsEnum(BattleSkill)
  skill!: BattleSkill;

  @ApiPropertyOptional({
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isRanked?: boolean;

  @ApiPropertyOptional({
    enum: RoomTeam,
    example: RoomTeam.A,
    description: 'Required for TEAM_3V3 host slot. Ignored for DUEL_1V1.',
  })
  @IsOptional()
  @IsEnum(RoomTeam)
  team?: RoomTeam;

  @ApiPropertyOptional({
    enum: BattleRole,
    example: BattleRole.GRAMMAR,
    description: 'Required for TEAM_3V3 host slot. Ignored for DUEL_1V1.',
  })
  @IsOptional()
  @IsEnum(BattleRole)
  role?: BattleRole;
}