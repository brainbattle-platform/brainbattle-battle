import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class MeDto {
  @ApiProperty({ example: 'user-1' })
  @IsString()
  userId!: string;
}
