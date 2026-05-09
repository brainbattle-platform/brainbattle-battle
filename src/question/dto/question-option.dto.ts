import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUrl, Min } from 'class-validator';

export class QuestionOptionDto {
  @ApiProperty({ example: 'A' })
  @IsString()
  key!: string;

  @ApiPropertyOptional({ example: 'She goes to school.' })
  @IsOptional()
  @IsString()
  text?: string;

  @ApiPropertyOptional({ example: 'https://cdn.example.com/option-a.png' })
  @IsOptional()
  @IsUrl()
  mediaUrl?: string;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  orderIndex?: number;
}