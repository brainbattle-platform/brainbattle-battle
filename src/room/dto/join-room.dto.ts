import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BattleRole, RoomTeam } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class JoinRoomDto {
  @ApiProperty({ example: 'ABC123' })
  @IsString()
  roomCode!: string;

  @ApiPropertyOptional({
    enum: RoomTeam,
    example: RoomTeam.B,
    description: 'Required for TEAM_3V3. Ignored for DUEL_1V1.',
  })
  @IsOptional()
  @IsEnum(RoomTeam)
  team?: RoomTeam;

  @ApiPropertyOptional({
    enum: BattleRole,
    example: BattleRole.VOCABULARY,
    description: 'Required for TEAM_3V3. Ignored for DUEL_1V1.',
  })
  @IsOptional()
  @IsEnum(BattleRole)
  role?: BattleRole;
}