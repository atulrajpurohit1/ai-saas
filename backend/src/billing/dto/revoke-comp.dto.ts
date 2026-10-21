import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class RevokeCompDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  tenantId: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
