import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum } from 'class-validator';

export enum ModeDto {
  ONE_VS_ONE = '1v1',
  THREE_VS_THREE = '3v3',
}

export enum BattleTypeDto {
  LISTENING = 'listening',
  READING = 'reading',
  WRITING = 'writing',
  MIXED = 'mixed',
}

export enum LevelDto {
  BASIC = 'basic',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export class CreateRoomDto {
  @ApiProperty({ enum: ModeDto })
  @IsEnum(ModeDto)
  mode!: ModeDto;

  @ApiProperty({ enum: BattleTypeDto })
  @IsEnum(BattleTypeDto)
  battleType!: BattleTypeDto;

  @ApiProperty({ enum: LevelDto })
  @IsEnum(LevelDto)
  level!: LevelDto;

  @ApiProperty()
  @IsBoolean()
  isRanked!: boolean;
}
