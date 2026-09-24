import { ArrayNotEmpty, IsArray, IsIn, IsOptional } from 'class-validator';
import { ServiceModule } from '@prisma/client';

const MODULES: ServiceModule[] = ['LEAD_GEN', 'GUARD_TOUR', 'FINANCE'];

export class CreateCheckoutSessionDto {
  @IsArray()
  @ArrayNotEmpty({ message: 'Select at least one service to purchase.' })
  @IsIn(MODULES, { each: true, message: 'Unknown service selected.' })
  modules: ServiceModule[];

  @IsOptional()
  @IsIn(['monthly', 'annual'])
  interval?: 'monthly' | 'annual';
}
