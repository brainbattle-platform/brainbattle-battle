import { IsString } from 'class-validator';

export class ActivateItemDto {
  @IsString()
  inventoryItemId!: string;
}
