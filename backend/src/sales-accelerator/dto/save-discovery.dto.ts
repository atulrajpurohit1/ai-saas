import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SaveDiscoveryDto {
  @IsOptional()
  @IsString()
  propertyType?: string;

  @IsOptional()
  @IsString()
  buyerRole?: string;

  @IsOptional()
  @IsString()
  currentProvider?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  guardCount?: number;

  @IsOptional()
  @IsString()
  serviceHours?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  painPoints?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  riskConcerns?: string[];

  @IsOptional()
  @IsString()
  decisionTimeline?: string;

  @IsOptional()
  @IsString()
  budgetSensitivity?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  objections?: string[];

  @IsOptional()
  @IsString()
  notes?: string;
}
