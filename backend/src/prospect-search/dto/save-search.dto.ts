import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SaveSearchDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsString()
  @IsNotEmpty()
  prompt!: string;

  /**
   * The result set on screen when the search was saved. Stored so reopening a
   * saved search shows what was found instead of re-running a billed job.
   * Optional: a search saved before this existed, or saved with nothing on
   * screen, simply has no snapshot and falls back to re-running.
   */
  @IsOptional()
  @IsObject()
  result?: Record<string, unknown>;
}
