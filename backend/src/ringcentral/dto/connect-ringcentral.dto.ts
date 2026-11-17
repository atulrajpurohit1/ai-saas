import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ConnectRingCentralDto {
  /**
   * The JWT credential the tenant generated in their own RingCentral
   * Developer Console, restricted to this application's Client ID.
   *
   * Verified against RingCentral before storage and never echoed back. The
   * shape check is only to catch an obvious paste error (a Client ID, a
   * truncated copy) before spending a round trip -- RingCentral is the real
   * authority on whether it is valid.
   */
  @IsString()
  @MinLength(40)
  @MaxLength(4096)
  @Matches(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/, {
    message:
      'That does not look like a JWT credential. Copy the whole value from ' +
      'the RingCentral Developer Console -- it has three dot-separated parts.',
  })
  credential!: string;
}
