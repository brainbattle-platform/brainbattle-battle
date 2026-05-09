import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  QuestionDifficulty,
  QuestionSkill,
  QuestionSource,
  QuestionStatus,
  QuestionType,
} from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListQuestionsDto {
  @ApiPropertyOptional({ enum: QuestionStatus })
  @IsOptional()
  @IsEnum(QuestionStatus)
  status?: QuestionStatus;

  @ApiPropertyOptional({ enum: QuestionSource })
  @IsOptional()
  @IsEnum(QuestionSource)
  source?: QuestionSource;

  @ApiPropertyOptional({ enum: QuestionSkill })
  @IsOptional()
  @IsEnum(QuestionSkill)
  skill?: QuestionSkill;

  @ApiPropertyOptional({ enum: QuestionDifficulty })
  @IsOptional()
  @IsEnum(QuestionDifficulty)
  difficulty?: QuestionDifficulty;

  @ApiPropertyOptional({ enum: QuestionType })
  @IsOptional()
  @IsEnum(QuestionType)
  type?: QuestionType;

  @ApiPropertyOptional({ example: 'learning-question-id' })
  @IsOptional()
  @IsString()
  externalQuestionId?: string;

  @ApiPropertyOptional({ example: 'grammar' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}