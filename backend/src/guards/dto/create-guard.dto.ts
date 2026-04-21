import { IsNotEmpty, IsString } from 'class-validator';

export class CreateGuardDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  phone: string;
}
