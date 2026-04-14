import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsString } from 'class-validator';

export class ReadyDto {
  @ApiProperty({ example: 'user-1' })
  @IsString()
  userId!: string;

  @ApiProperty()
  @IsBoolean()
  ready!: boolean;
}
