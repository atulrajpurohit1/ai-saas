import { ServiceUnavailableException } from '@nestjs/common';
import {
  RingCentralApiError,
  RingCentralClientService,
  redactRingCentralSecrets,
} from './ringcentral-client.service';

const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJlLXZhbHVl';

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Map(Object.entries(headers)) as unknown as Headers,
    text: async () => JSON.stringify(body),
    arrayBuffer: async () => new ArrayBuffer(0),
  } as unknown as Response;
}

function binaryResponse(bytes: Uint8Array, status = 200, contentType = 'audio/mpeg') {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => contentType } as unknown as Headers,
    text: async () => '',
    arrayBuffer: async () => bytes.buffer.slice(0),
  } as unknown as Response;
}

describe('RingCentralClientService', () => {
  let service: RingCentralClientService;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    process.env.RINGCENTRAL_CLIENT_ID = 'client-id';
    process.env.RINGCENTRAL_CLIENT_SECRET = 'client-secret';
    process.env.RINGCENTRAL_SERVER_URL = 'https://platform.devtest.ringcentral.com';

    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    service = new RingCentralClientService();
  });

  describe('token minting', () => {
    it('exchanges the JWT for an access token using the jwt-bearer grant', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ access_token: 'at-1', expires_in: 3600 }),
      );

      await expect(service.getAccessToken('conn-1', JWT)).resolves.toBe('at-1');

      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://platform.devtest.ringcentral.com/restapi/oauth/token');
      const body = (init.body as URLSearchParams).toString();
      expect(body).toContain(
        `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}`,
      );
      expect(body).toContain('assertion=');
      // The app authenticates itself with Basic, the tenant with the assertion.
      expect(init.headers.Authorization).toBe(
        `Basic ${Buffer.from('client-id:client-secret').toString('base64')}`,
      );
    });

    it('caches the token instead of minting one per request', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({ access_token: 'at-1', expires_in: 3600 }),
      );

      await service.getAccessToken('conn-1', JWT);
      await service.getAccessToken('conn-1', JWT);

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('keys the cache per connection so tenants never share a token', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ access_token: 'at-a', expires_in: 3600 }))
        .mockResolvedValueOnce(jsonResponse({ access_token: 'at-b', expires_in: 3600 }));

      await expect(service.getAccessToken('conn-a', JWT)).resolves.toBe('at-a');
      await expect(service.getAccessToken('conn-b', JWT)).resolves.toBe('at-b');
    });

    it('re-mints once a cached token has aged past its safety margin', async () => {
      // expires_in below the 5-minute margin must not produce a token that is
      // cached as if it were live -- that would 401 on the very next call.
      fetchMock.mockResolvedValue(
        jsonResponse({ access_token: 'at-short', expires_in: 60 }),
      );

      await service.getAccessToken('conn-1', JWT);
      jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 40_000);
      await service.getAccessToken('conn-1', JWT);

      expect(fetchMock).toHaveBeenCalledTimes(2);
      jest.spyOn(Date, 'now').mockRestore();
    });

    it('surfaces a rejected credential as a credential failure', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(
          { error: 'invalid_grant', error_description: 'Invalid assertion' },
          400,
        ),
      );

      await expect(service.getAccessToken('conn-1', JWT)).rejects.toMatchObject({
        status: 400,
      });

      const error = await service
        .getAccessToken('conn-2', JWT)
        .catch((caught: RingCentralApiError) => caught);
      expect((error as RingCentralApiError).isCredentialFailure).toBe(true);
    });
  });

  describe('request', () => {
    it('re-mints and retries once on a 401', async () => {
      // A cached token can be invalidated server-side by a password change or
      // the parallel-session cap while our cache still believes it is live.
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ access_token: 'at-1', expires_in: 3600 }))
        .mockResolvedValueOnce(jsonResponse({ message: 'Token invalid' }, 401))
        .mockResolvedValueOnce(jsonResponse({ access_token: 'at-2', expires_in: 3600 }))
        .mockResolvedValueOnce(jsonResponse({ id: '42' }));

      await expect(
        service.request('conn-1', JWT, '/restapi/v1.0/account/~'),
      ).resolves.toEqual({ id: '42' });

      const retried = fetchMock.mock.calls[3][1];
      expect(retried.headers.Authorization).toBe('Bearer at-2');
    });

    it('does not retry forever when the credential is genuinely dead', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ access_token: 'at-1', expires_in: 3600 }))
        .mockResolvedValueOnce(jsonResponse({ message: 'Token invalid' }, 401))
        .mockResolvedValueOnce(jsonResponse({ access_token: 'at-2', expires_in: 3600 }))
        .mockResolvedValueOnce(jsonResponse({ message: 'Token invalid' }, 401));

      await expect(
        service.request('conn-1', JWT, '/restapi/v1.0/account/~'),
      ).rejects.toBeInstanceOf(RingCentralApiError);
    });

    it('flags a missing scope as a permission failure, not a bad credential', async () => {
      // SUB-410 means the app lacks a scope. Treating it as a bad credential
      // would tell the customer to re-paste a JWT that was never the problem.
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ access_token: 'at-1', expires_in: 3600 }))
        .mockResolvedValueOnce(
          jsonResponse(
            {
              errors: [
                { errorCode: 'SUB-410', message: 'Required permission missing' },
              ],
            },
            403,
          ),
        );

      const error = await service
        .request('conn-1', JWT, '/restapi/v1.0/subscription')
        .catch((caught: RingCentralApiError) => caught);

      expect((error as RingCentralApiError).isPermissionFailure).toBe(true);
      expect((error as RingCentralApiError).isCredentialFailure).toBe(false);
    });

    it('does not fail on a non-JSON error body', async () => {
      // Gateways return HTML. A JSON parse failure here would mask the status.
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ access_token: 'at-1', expires_in: 3600 }))
        .mockResolvedValueOnce({
          ok: false,
          status: 502,
          headers: new Map() as unknown as Headers,
          text: async () => '<html>Bad Gateway</html>',
          arrayBuffer: async () => new ArrayBuffer(0),
        } as unknown as Response);

      const error = await service
        .request('conn-1', JWT, '/restapi/v1.0/account/~')
        .catch((caught: RingCentralApiError) => caught);

      expect((error as RingCentralApiError).status).toBe(502);
    });

    it('converts a network failure into a service-unavailable, not a crash', async () => {
      fetchMock.mockRejectedValueOnce(new Error('ECONNRESET'));

      await expect(
        service.request('conn-1', JWT, '/restapi/v1.0/account/~'),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
    });
  });

  describe('downloadContent', () => {
    const CONTENT_URI =
      'https://media.ringcentral.com/restapi/v1.0/account/1/recording/9/content';

    it('sends the token in a header, keeping it out of the URL', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ access_token: 'at-1', expires_in: 3600 }))
        .mockResolvedValueOnce(binaryResponse(new Uint8Array([1, 2, 3])));

      const result = await service.downloadContent('conn-1', JWT, CONTENT_URI);

      expect(result.contentType).toBe('audio/mpeg');
      expect(fetchMock.mock.calls[1][0]).toBe(CONTENT_URI);
      expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer at-1');
    });

    it('falls back to the documented query parameter when the header is refused', async () => {
      // RingCentral documents access_token as a query parameter for recording
      // content and never confirms the bearer header works there.
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ access_token: 'at-1', expires_in: 3600 }))
        .mockResolvedValueOnce(binaryResponse(new Uint8Array(), 401))
        .mockResolvedValueOnce(binaryResponse(new Uint8Array([9])));

      await service.downloadContent('conn-1', JWT, CONTENT_URI);

      expect(fetchMock.mock.calls[2][0]).toContain('access_token=at-1');
    });

    it('does not retry a 404 against the query-parameter form', async () => {
      // A recording that does not exist is not an auth problem; retrying only
      // doubles the load and the latency.
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ access_token: 'at-1', expires_in: 3600 }))
        .mockResolvedValueOnce(binaryResponse(new Uint8Array(), 404));

      await expect(
        service.downloadContent('conn-1', JWT, CONTENT_URI),
      ).rejects.toBeInstanceOf(RingCentralApiError);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('redaction', () => {
    it('strips a JWT out of an error message', () => {
      // RingCentral echoes the request back in error bodies. A JWT credential
      // does not expire, so one in a log file is a standing takeover.
      expect(redactRingCentralSecrets(`assertion rejected: ${JWT}`)).not.toContain(
        'c2lnbmF0dXJlLXZhbHVl',
      );
    });

    it('strips bearer, basic and query-string tokens', () => {
      const message = redactRingCentralSecrets(
        'Bearer abcdef1234567890 Basic YWJjOmRlZmdoaWpr access_token=zyxwvu987654',
      );
      expect(message).not.toContain('abcdef1234567890');
      expect(message).not.toContain('YWJjOmRlZmdoaWpr');
      expect(message).not.toContain('zyxwvu987654');
    });

    it('redacts when the error is constructed, not only when logged', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse({ error_description: `bad assertion ${JWT}` }, 400),
      );

      let message = '';
      try {
        await service.getAccessToken('conn-1', JWT);
      } catch (caught) {
        message = (caught as Error).message;
      }

      expect(message).not.toContain('c2lnbmF0dXJlLXZhbHVl');
      expect(message).toContain('[redacted]');
    });
  });
});
