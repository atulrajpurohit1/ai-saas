import { IsString, MinLength, MaxLength } from 'class-validator';

export class SearchProspectsDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  companyName!: string;
}
