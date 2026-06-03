import { PartialType } from '@nestjs/mapped-types';
import { CreateKnowledgeEntryDto } from './create-knowledge-entry.dto';

export class UpdateKnowledgeEntryDto extends PartialType(CreateKnowledgeEntryDto) {}
