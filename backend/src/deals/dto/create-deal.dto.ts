import {
  IsNotEmpty,
  IsString,
  IsUUID,
  IsOptional,
  IsEnum,
} from 'class-validator';

export enum DealStage {
  NEW = 'New',
  CONTACTED = 'Contacted',
  PROPOSAL = 'Proposal',
  WON = 'Won',
  LOST = 'Lost',
}

export class CreateDealDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsUUID()
  @IsNotEmpty()
  leadId: string;

  @IsEnum(DealStage)
  @IsOptional()
  stage?: DealStage;
}
