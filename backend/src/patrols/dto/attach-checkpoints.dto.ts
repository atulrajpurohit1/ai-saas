import { IsArray, IsInt, IsNotEmpty, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class RouteCheckpointDto {
  @IsNotEmpty()
  @IsString()
  checkpoint_id: string;

  @IsNotEmpty()
  @IsInt()
  @Min(0)
  sequence_order: number;
}

export class AttachCheckpointsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RouteCheckpointDto)
  checkpoints: RouteCheckpointDto[];
}
