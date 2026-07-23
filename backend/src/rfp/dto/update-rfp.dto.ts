import { PartialType } from '@nestjs/mapped-types';
import { CreateRfpDto } from './create-rfp.dto';

export class UpdateRfpDto extends PartialType(CreateRfpDto) {}
