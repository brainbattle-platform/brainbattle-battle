import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  QuestionDifficulty,
  QuestionSkill,
  QuestionSource,
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

export class CreateQuestionDto {
  @ApiPropertyOptional({
    enum: QuestionSource,
    example: QuestionSource.ADMIN_CREATED,
    default: QuestionSource.ADMIN_CREATED,
  })
  @IsOptional()
  @IsEnum(QuestionSource)
  source?: QuestionSource;

  @ApiPropertyOptional({ example: 'LEARNING' })
  @IsOptional()
  @IsString()
  externalSource?: string;

  @ApiPropertyOptional({ example: 'learning-question-id' })
  @IsOptional()
  @IsString()
  externalQuestionId?: string;

  @ApiPropertyOptional({ example: 'v1' })
  @IsOptional()
  @IsString()
  sourceVersion?: string;

  @ApiProperty({ enum: QuestionSkill, example: QuestionSkill.GRAMMAR })
  @IsEnum(QuestionSkill)
  skill!: QuestionSkill;

  @ApiProperty({ enum: QuestionDifficulty, example: QuestionDifficulty.EASY })
  @IsEnum(QuestionDifficulty)
  difficulty!: QuestionDifficulty;

  @ApiProperty({ enum: QuestionType, example: QuestionType.MULTIPLE_CHOICE })
  @IsEnum(QuestionType)
  type!: QuestionType;

  @ApiPropertyOptional({ example: 'Choose the correct sentence.' })
  @IsOptional()
  @IsString()
  promptText?: string;

  @ApiPropertyOptional({ example: 'Present simple agreement.' })
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

  @ApiProperty({ example: 10 })
  @IsInt()
  @Min(5)
  @Max(35)
  maxTimeSec!: number;

  @ApiPropertyOptional({ example: 100, default: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  baseScore?: number;

  @ApiPropertyOptional({ example: 50, default: 50 })
  @IsOptional()
  @IsInt()
  @Min(0)
  speedBonus?: number;
}