import { IsEnum, IsNotEmpty } from 'class-validator';
import { DealStage } from './create-deal.dto';

export class UpdateDealStageDto {
  @IsEnum(DealStage)
  @IsNotEmpty()
  stage: DealStage;
}
