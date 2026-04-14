import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CreateFromRoomDto {
  @ApiProperty({ example: 'user-1' })
  @IsString()
  userId!: string;
}
