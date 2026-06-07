import { IsString, Matches } from 'class-validator';

export class CreateDomainDto {
  @IsString()
  @Matches(/^(?!-)(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}$/i, {
    message: 'domain must be a valid hostname',
  })
  domain: string;
}
