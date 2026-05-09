import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class RejectQuestionDto {
  @ApiProperty({ example: 'Answer is ambiguous.' })
  @IsString()
  @MinLength(3)
  reason!: string;
}