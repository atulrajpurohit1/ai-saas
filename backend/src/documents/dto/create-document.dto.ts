import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { IsSafeUrl } from '../../common/is-safe-url.validator';

export class CreateDocumentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2048)
  @IsSafeUrl()
  url: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsString()
  @IsNotEmpty()
  clientId: string;
}
