import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ProspectSearchFiltersDto } from './prospect-search-filters.dto';

export class SaveSearchDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsString()
  @IsNotEmpty()
  prompt!: string;

  @ValidateNested()
  @Type(() => ProspectSearchFiltersDto)
  filters!: ProspectSearchFiltersDto;
}
