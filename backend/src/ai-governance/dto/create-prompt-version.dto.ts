import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePromptVersionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  moduleName: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  promptKey: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  version: string;

  @IsString()
  @IsNotEmpty()
  promptText: string;

  @IsOptional()
  @IsIn(['active', 'inactive'])
  status?: 'active' | 'inactive';
}
