import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class SaveSearchDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsString()
  @IsNotEmpty()
  prompt!: string;
}
