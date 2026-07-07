import { Type } from 'class-transformer';
import { IsOptional, IsString, ValidateNested } from 'class-validator';
import { ProspectCompanyDto } from './prospect-company.dto';

export class CompanyInsightDto {
  @ValidateNested()
  @Type(() => ProspectCompanyDto)
  company: ProspectCompanyDto;

  @IsOptional()
  @IsString()
  prompt?: string;
}
