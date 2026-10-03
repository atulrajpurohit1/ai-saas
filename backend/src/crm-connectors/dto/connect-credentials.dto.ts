import { IsObject } from 'class-validator';

export class ConnectCredentialsDto {
  /**
   * Provider-specific credential fields, keyed by the `key` the adapter
   * declares in credentialFields (e.g. { apiKey, domain } for Freshsales).
   * Values are verified against the CRM before being stored, and never
   * echoed back to the client.
   */
  @IsObject()
  credentials!: Record<string, string>;
}
