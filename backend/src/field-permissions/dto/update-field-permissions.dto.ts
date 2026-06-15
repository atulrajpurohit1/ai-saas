import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsString,
  ValidateNested,
} from 'class-validator';
import {
  FIELD_PERMISSION_ENTITIES,
  FieldPermissionEntity,
} from '../field-permissions.constants';

export class FieldPermissionInputDto {
  @IsString()
  @IsIn(FIELD_PERMISSION_ENTITIES)
  entity: FieldPermissionEntity;

  @IsString()
  @IsNotEmpty()
  field: string;

  @IsBoolean()
  can_view: boolean;

  @IsBoolean()
  can_edit: boolean;
}

export class UpdateFieldPermissionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FieldPermissionInputDto)
  permissions: FieldPermissionInputDto[];
}
