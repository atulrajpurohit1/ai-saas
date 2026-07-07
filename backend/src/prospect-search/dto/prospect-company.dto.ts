import { IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';

export class ProspectCompanyDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  industry: string;

  @IsString()
  @IsNotEmpty()
  website: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  state: string;

  @IsString()
  @IsNotEmpty()
  country: string;

  @IsInt()
  @Min(0)
  employeeCount: number;

  @IsString()
  @IsNotEmpty()
  revenueRange: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsInt()
  @Min(0)
  @Max(100)
  matchScore: number;
}
