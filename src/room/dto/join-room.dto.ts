import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class JoinRoomDto {
  @ApiProperty({ example: 'ABCD12' })
  @IsString()
  roomCode!: string;

  @ApiProperty({ example: 'user-2' })
  @IsString()
  userId!: string;
}
