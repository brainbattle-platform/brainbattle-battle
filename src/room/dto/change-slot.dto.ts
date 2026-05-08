import { ApiProperty } from '@nestjs/swagger';
import { BattleRole, RoomTeam } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class ChangeSlotDto {
  @ApiProperty({ enum: RoomTeam, example: RoomTeam.A })
  @IsEnum(RoomTeam)
  team!: RoomTeam;

  @ApiProperty({ enum: BattleRole, example: BattleRole.LISTENING })
  @IsEnum(BattleRole)
  role!: BattleRole;
}