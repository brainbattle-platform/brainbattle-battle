import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class ReadyDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  ready!: boolean;
}
