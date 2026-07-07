import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, ValidateNested } from 'class-validator';
import { ProspectCompanyDto } from './prospect-company.dto';

export class ImportProspectDto {
  @ValidateNested()
  @Type(() => ProspectCompanyDto)
  company: ProspectCompanyDto;

  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
