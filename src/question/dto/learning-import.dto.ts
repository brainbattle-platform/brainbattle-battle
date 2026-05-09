import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  QuestionDifficulty,
  QuestionMediaType,
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
  IsUrl,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class LearningQuestionMediaDto {
  @ApiProperty({ enum: QuestionMediaType, example: QuestionMediaType.AUDIO })
  @IsEnum(QuestionMediaType)
  type!: QuestionMediaType;

  @ApiProperty({ example: 'https://res.cloudinary.com/demo/audio.mp3' })
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
}

export class LearningQuestionOptionDto {
  @ApiProperty({ example: 'A' })
  @IsString()
  key!: string;

  @ApiPropertyOptional({ example: 'She goes to school.' })
  @IsOptional()
  @IsString()
  text?: string;

  @ApiPropertyOptional({ example: 'https://res.cloudinary.com/demo/option.png' })
  @IsOptional()
  @IsUrl()
  mediaUrl?: string;
}

export class LearningCorrectAnswerDto {
  @ApiPropertyOptional({ example: 'B' })
  @IsOptional()
  @IsString()
  optionKey?: string;

  @ApiPropertyOptional({ example: ['cold'], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  acceptedAnswers?: string[];
}

export class LearningQuestionItemDto {
  @ApiProperty({ example: 'learning-question-id' })
  @IsString()
  externalQuestionId!: string;

  @ApiPropertyOptional({ example: 'v1' })
  @IsOptional()
  @IsString()
  sourceVersion?: string;

  @ApiPropertyOptional({ example: 'sha256-content-hash' })
  @IsOptional()
  @IsString()
  contentHash?: string;

  @ApiProperty({ enum: QuestionSkill, example: QuestionSkill.GRAMMAR })
  @IsEnum(QuestionSkill)
  skill!: QuestionSkill;

  @ApiProperty({ enum: QuestionDifficulty, example: QuestionDifficulty.EASY })
  @IsEnum(QuestionDifficulty)
  difficulty!: QuestionDifficulty;

  @ApiProperty({ enum: QuestionType, example: QuestionType.MULTIPLE_CHOICE })
  @IsEnum(QuestionType)
  type!: QuestionType;

  @ApiPropertyOptional({ example: 'Choose the correct answer.' })
  @IsOptional()
  @IsString()
  promptText?: string;

  @ApiPropertyOptional({ type: [LearningQuestionMediaDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => LearningQuestionMediaDto)
  media?: LearningQuestionMediaDto[];

  @ApiPropertyOptional({ type: [LearningQuestionOptionDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => LearningQuestionOptionDto)
  options?: LearningQuestionOptionDto[];

  @ApiProperty({ type: LearningCorrectAnswerDto })
  @ValidateNested()
  @Type(() => LearningCorrectAnswerDto)
  correctAnswer!: LearningCorrectAnswerDto;

  @ApiPropertyOptional({ example: 'Optional explanation.' })
  @IsOptional()
  @IsString()
  explanation?: string;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(35)
  estimatedTimeSec?: number;
}

export class ImportLearningQuestionsDto {
  @ApiPropertyOptional({ example: 'LEARNING', default: 'LEARNING' })
  @IsOptional()
  @IsString()
  externalSource?: string;

  @ApiProperty({ type: [LearningQuestionItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LearningQuestionItemDto)
  questions!: LearningQuestionItemDto[];
}