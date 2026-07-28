import { Type } from 'class-transformer';
import {
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreatePerformanceReviewDto {
  @IsOptional()
  @IsISO8601()
  reviewDate?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  overallRating: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  slaCompliance: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  incidentCount: number;

  @IsString()
  responseTime: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
