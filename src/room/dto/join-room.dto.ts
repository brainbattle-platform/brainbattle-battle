import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class JoinRoomDto {
  @ApiProperty({ example: 'BB7K9Q' })
  @IsString()
  roomCode!: string;
}
