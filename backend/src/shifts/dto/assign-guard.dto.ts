import { IsString, IsNotEmpty } from 'class-validator';

export class AssignGuardDto {
  @IsString()
  @IsNotEmpty()
  guardId: string;
}
