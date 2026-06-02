import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateAiFeedbackDto {
  @IsOptional()
  @IsString()
  aiGenerationId?: string;

  @IsOptional()
  @IsString()
  recommendationId?: string;

  @IsOptional()
  @IsString()
  actionId?: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  feedbackText?: string;

  @IsBoolean()
  isUseful: boolean;

  @IsBoolean()
  isAccurate: boolean;
}
