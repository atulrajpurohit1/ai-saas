import { IsBoolean } from 'class-validator';

export class SetAutoAssignmentDto {
  @IsBoolean()
  enabled: boolean;
}
