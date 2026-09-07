import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsObject,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

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
  // Without @ValidateNested({ each: true }) + @Type(), class-validator does not
  // recurse into array elements: malformed actions (missing actionType /
  // payload / createdAt) would pass validation and then crash processSyncQueue
  // with a Prisma error (HTTP 500) instead of a clean 400.
  @IsArray()
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => OfflineActionDto)
  actions: OfflineActionDto[];
}
