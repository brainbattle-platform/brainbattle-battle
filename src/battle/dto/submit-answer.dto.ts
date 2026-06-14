import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class SubmitAnswerDto {
  @ApiProperty({
    example: 'battle-question-snapshot-id',
    description: 'ID của question snapshot trong battle',
  })
  @IsString()
  questionSnapshotId!: string;

  @ApiPropertyOptional({
    example: 'B',
    description: 'Dùng cho MULTIPLE_CHOICE',
  })
  @IsOptional()
  @IsString()
  selectedOptionKey?: string;

  @ApiPropertyOptional({
    example: 'cold',
    description: 'Dùng cho FILL_BLANK',
  })
  @IsOptional()
  @IsString()
  textAnswer?: string;
}