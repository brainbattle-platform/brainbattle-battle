import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class StartBattleDto {
  @ApiProperty({ example: 'user-1' })
  @IsString()
  userId!: string;
}
