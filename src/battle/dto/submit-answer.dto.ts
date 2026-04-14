import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Min } from 'class-validator';

export class SubmitAnswerDto {
  @ApiProperty({ example: 'user-2' })
  @IsString()
  userId!: string;

  @ApiProperty({ example: 'questionInst-uuid' })
  @IsString()
  questionInstId!: string;

  @ApiProperty({ example: 'A' })
  @IsString()
  selectedKey!: string;

  @ApiProperty({ example: 4200 })
  @IsInt()
  @Min(0)
  timeMs!: number;
}
