import { ApiKeyContext } from '../api-keys/api-keys.service';

export type PublicApiRequest = {
  publicApiKey?: ApiKeyContext;
  headers: Record<string, string | string[] | undefined>;
  method: string;
  originalUrl?: string;
  url?: string;
  ip?: string;
  socket?: {
    remoteAddress?: string;
  };
};
