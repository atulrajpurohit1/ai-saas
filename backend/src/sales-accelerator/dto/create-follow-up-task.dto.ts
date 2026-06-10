import { IsOptional, IsString } from 'class-validator';

export class CreateFollowUpTaskDto {
  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  dueDate?: string;
}
