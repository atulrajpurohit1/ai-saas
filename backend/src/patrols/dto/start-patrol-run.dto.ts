import { IsNotEmpty, IsString } from 'class-validator';

export class StartPatrolRunDto {
  @IsNotEmpty()
  @IsString()
  patrol_route_id: string;
}
