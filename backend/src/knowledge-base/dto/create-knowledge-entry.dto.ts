import { IsArray, IsIn, IsOptional, IsString } from 'class-validator';
import { KNOWLEDGE_CATEGORIES, KnowledgeCategory } from '../knowledge-base.types';

export class CreateKnowledgeEntryDto {
  @IsString()
  title!: string;

  @IsIn(KNOWLEDGE_CATEGORIES)
  category!: KnowledgeCategory;

  @IsOptional()
  @IsString()
  sourceType?: string;

  @IsOptional()
  @IsString()
  sourceId?: string;

  @IsString()
  summary!: string;

  @IsString()
  detailedContent!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
