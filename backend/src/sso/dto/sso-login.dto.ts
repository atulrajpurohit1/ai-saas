import { IsEmail, IsOptional, IsString, IsUrl } from 'class-validator';

export class SSOLoginDto {
  @IsEmail()
  email: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  redirect_uri?: string;
}

export class SSOTestDto {
  @IsString()
  provider_id: string;
}
