import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { QuestionMediaType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, IsUrl, Min } from 'class-validator';

export class QuestionMediaDto {
  @ApiProperty({ enum: QuestionMediaType, example: QuestionMediaType.AUDIO })
  @IsEnum(QuestionMediaType)
  type!: QuestionMediaType;

  @ApiProperty({ example: 'https://cdn.example.com/audio/question-1.mp3' })
  @IsUrl()
  url!: string;

  @ApiPropertyOptional({ example: 8 })
  @IsOptional()
  @IsInt()
  @Min(1)
  durationSec?: number;

  @ApiPropertyOptional({ example: 'audio/mpeg' })
  @IsOptional()
  @IsString()
  mimeType?: string;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  orderIndex?: number;
}