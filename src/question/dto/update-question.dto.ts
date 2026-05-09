import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  QuestionDifficulty,
  QuestionSkill,
  QuestionType,
} from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { QuestionMediaDto } from './question-media.dto';
import { QuestionOptionDto } from './question-option.dto';

export class UpdateQuestionDto {
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

  @ApiPropertyOptional({ example: 'Choose the correct answer.' })
  @IsOptional()
  @IsString()
  promptText?: string;

  @ApiPropertyOptional({ example: 'Explanation text.' })
  @IsOptional()
  @IsString()
  explanation?: string;

  @ApiPropertyOptional({ type: [QuestionMediaDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => QuestionMediaDto)
  media?: QuestionMediaDto[];

  @ApiPropertyOptional({ type: [QuestionOptionDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => QuestionOptionDto)
  options?: QuestionOptionDto[];

  @ApiPropertyOptional({ example: 'B' })
  @IsOptional()
  @IsString()
  correctOptionKey?: string;

  @ApiPropertyOptional({ example: ['goes'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  acceptedAnswers?: string[];

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(35)
  maxTimeSec?: number;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  baseScore?: number;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsInt()
  @Min(0)
  speedBonus?: number;
}