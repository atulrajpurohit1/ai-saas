import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RejectTimesheetDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  rejection_reason: string;
}
