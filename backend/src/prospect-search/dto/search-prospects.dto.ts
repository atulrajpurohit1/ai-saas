import { IsString, MinLength, MaxLength } from 'class-validator';

export class SearchProspectsDto {
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  prompt!: string;
}
