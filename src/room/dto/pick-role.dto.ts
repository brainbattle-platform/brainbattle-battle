import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';

export class PickRoleDto {
  @ApiProperty({ example: 'user-1' })
  @IsString()
  userId!: string;

  @ApiProperty({ enum: ['A', 'B'] })
  @IsIn(['A', 'B'])
  team!: 'A' | 'B';

  @ApiProperty({ enum: ['listening', 'reading', 'writing'] })
  @IsIn(['listening', 'reading', 'writing'])
  role!: 'listening' | 'reading' | 'writing';
}
