import { IsArray, IsNotEmpty, IsObject, IsString } from 'class-validator';

export class OfflineActionDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  actionType: string;

  @IsObject()
  @IsNotEmpty()
  payload: Record<string, any>;

  @IsString()
  @IsNotEmpty()
  createdAt: string;
}

export class SyncOfflineActionsDto {
  @IsArray()
  actions: OfflineActionDto[];
}
