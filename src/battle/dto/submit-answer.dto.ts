import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

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

  @ApiProperty({
    example: 3200,
    description: 'Thời gian trả lời tính bằng milliseconds',
  })
  @IsInt()
  @Min(0)
  responseTimeMs!: number;
}