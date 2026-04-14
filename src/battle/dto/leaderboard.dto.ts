import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class LeaderboardQueryDto {
  @ApiPropertyOptional({ example: 'global' })
  @IsOptional()
  @IsIn(['global'])
  scope?: 'global';

  @ApiPropertyOptional({ example: 'weekly' })
  @IsOptional()
  @IsIn(['daily', 'weekly', 'all'])
  period?: 'daily' | 'weekly' | 'all';

  @ApiPropertyOptional({ example: '1v1' })
  @IsOptional()
  @IsIn(['1v1', '3v3'])
  mode?: '1v1' | '3v3';

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @ApiPropertyOptional({ example: 'LISTENING' })
  @IsOptional()
  @IsString()
  battleType?: string;
}
