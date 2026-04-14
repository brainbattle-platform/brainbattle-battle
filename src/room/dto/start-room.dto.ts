import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class StartRoomDto {
  @ApiProperty({ example: 'user-1' })
  @IsString()
  userId!: string;
}
