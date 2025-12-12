import { ApiProperty } from '@nestjs/swagger';

export class RoomMemberResponse {
  @ApiProperty()
  userId!: string;

  @ApiProperty({ enum: ['A', 'B'] })
  team!: 'A' | 'B';

  @ApiProperty({ nullable: true, example: 'listening' })
  role!: string | null;

  @ApiProperty()
  ready!: boolean;
}

export class RoomStateResponse {
  @ApiProperty()
  roomId!: string;

  @ApiProperty({ enum: ['1v1', '3v3'] })
  mode!: '1v1' | '3v3';

  @ApiProperty({ enum: ['waiting', 'playing', 'failed'] })
  status!: string;

  @ApiProperty()
  expiresAt!: string;

  @ApiProperty({ type: [RoomMemberResponse] })
  members!: RoomMemberResponse[];
}
