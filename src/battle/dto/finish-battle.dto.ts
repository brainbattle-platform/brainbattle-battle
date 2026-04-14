import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class FinishBattleDto {
  @ApiPropertyOptional({ example: 'FORCE' })
  @IsOptional()
  @IsString()
  reason?: string;
}
