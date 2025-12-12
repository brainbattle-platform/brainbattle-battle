import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString } from 'class-validator';

export enum RoleDto {
  LISTENING = 'listening',
  READING = 'reading',
  WRITING = 'writing',
}

export class PickRoleDto {
  @ApiProperty({ enum: ['A', 'B'], example: 'A' })
  @IsString()
  team!: 'A' | 'B';

  @ApiProperty({ enum: RoleDto, example: RoleDto.LISTENING })
  @IsEnum(RoleDto)
  role!: RoleDto;
}
