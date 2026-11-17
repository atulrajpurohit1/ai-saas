import {
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { decryptSecret } from '../common/secret-box.util';
import { RingCentralApiError } from './ringcentral-client.service';
import { RingCentralConnectionService } from './ringcentral-connection.service';

const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJlLXZhbHVl';
const SECRET = 'test-telephony-secret';

const user = { tenantId: 'tenant-1', sub: 'user-1' } as ActiveUser;

function connectionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'conn-1',
    tenantId: 'tenant-1',
    provider: 'ringcentral',
    status: 'connected',
    credential: 'encrypted',
    externalAccountId: '400100',
    externalAccountName: 'Acme Security',
    subscriptionId: null,
    subscriptionExpiresAt: null,
    webhookSecret: 'hook-secret',
    scopes: [],
    lastSyncAt: null,
    lastError: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('RingCentralConnectionService', () => {
  let service: RingCentralConnectionService;
  let prisma: {
    telephonyConnection: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      upsert: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };
  let client: { request: jest.Mock; invalidate: jest.Mock };
  let subscriptions: { create: jest.Mock; remove: jest.Mock };
  let audit: { log: jest.Mock };

  beforeEach(() => {
    process.env.TELEPHONY_TOKEN_SECRET = SECRET;
    process.env.RINGCENTRAL_CLIENT_ID = 'client-id';
    process.env.RINGCENTRAL_CLIENT_SECRET = 'client-secret';
    process.env.RINGCENTRAL_WEBHOOK_BASE_URL = 'https://api.example.com';

    prisma = {
      telephonyConnection: {
        findUnique: jest.fn().mockResolvedValue(null),
        findFirst: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue(connectionRow()),
        update: jest.fn().mockResolvedValue(connectionRow()),
        delete: jest.fn().mockResolvedValue(connectionRow()),
      },
    };
    client = {
      request: jest.fn().mockResolvedValue({ id: 400100, companyName: 'Acme Security' }),
      invalidate: jest.fn(),
    };
    subscriptions = {
      create: jest.fn().mockResolvedValue(connectionRow({ subscriptionId: 'sub-1' })),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };

    service = new RingCentralConnectionService(
      prisma as never,
      client as never,
      subscriptions as never,
      audit as never,
    );
  });

  describe('connect', () => {
    it('stores the credential encrypted, never in plaintext', async () => {
      await service.connect(user, { credential: JWT });

      const stored = prisma.telephonyConnection.upsert.mock.calls[0][0].create
        .credential as string;
      expect(stored).not.toContain('c2lnbmF0dXJlLXZhbHVl');
      expect(decryptSecret(stored, SECRET)).toBe(JWT);
    });

    it('resolves and stores the RingCentral account id', async () => {
      // Webhook payloads carry accountId, not our tenant id. Without this the
      // delivery could not be routed back to a tenant at all.
      await service.connect(user, { credential: JWT });

      expect(client.request).toHaveBeenCalledWith(
        'verify:tenant-1',
        JWT,
        '/restapi/v1.0/account/~',
      );
      expect(prisma.telephonyConnection.upsert.mock.calls[0][0].create).toMatchObject({
        externalAccountId: '400100',
        externalAccountName: 'Acme Security',
      });
    });

    it('generates a per-tenant webhook secret', async () => {
      await service.connect(user, { credential: JWT });

      const secret = prisma.telephonyConnection.upsert.mock.calls[0][0].create
        .webhookSecret as string;
      expect(secret).toEqual(expect.any(String));
      expect(secret.length).toBeGreaterThan(20);
    });

    it('verifies the credential BEFORE writing anything', async () => {
      client.request.mockRejectedValueOnce(
        new RingCentralApiError(400, 'Invalid assertion'),
      );

      await expect(service.connect(user, { credential: JWT })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.telephonyConnection.upsert).not.toHaveBeenCalled();
    });

    it('tells the user to fix scopes, not the credential, on a permission failure', async () => {
      // A valid JWT with a missing scope is the single likeliest setup error.
      // Saying "check your credential" would send them down the wrong path.
      client.request.mockRejectedValueOnce(
        new RingCentralApiError(403, 'missing', 'SUB-410'),
      );

      await expect(
        service.connect(user, { credential: JWT }),
      ).rejects.toThrow(/permissions/i);
    });

    it('drops the temporary verification token from the cache', async () => {
      // Keyed on the tenant because no connection row exists yet; left behind
      // it would strand a cache entry nothing ever reads again.
      await service.connect(user, { credential: JWT });
      expect(client.invalidate).toHaveBeenCalledWith('verify:tenant-1');
    });

    it('refuses a RingCentral account already connected to another tenant', async () => {
      // Otherwise both tenants receive each other's calls -- a cross-tenant
      // leak through an integration rather than through a query.
      prisma.telephonyConnection.upsert.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('unique', {
          code: 'P2002',
          clientVersion: '6',
        }),
      );

      await expect(service.connect(user, { credential: JWT })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('keeps the stored credential when the subscription fails', async () => {
      // The tenant should not have to paste the JWT again to retry something
      // that was not their fault.
      subscriptions.create.mockRejectedValueOnce(new Error('RingCentral is down'));

      await expect(service.connect(user, { credential: JWT })).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      expect(prisma.telephonyConnection.delete).not.toHaveBeenCalled();
      expect(prisma.telephonyConnection.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'degraded' }) }),
      );
    });

    it('refuses to connect when the server is not configured', async () => {
      // Accepting a JWT with no webhook URL would show "connected" and then
      // deliver nothing, forever.
      delete process.env.RINGCENTRAL_WEBHOOK_BASE_URL;

      await expect(service.connect(user, { credential: JWT })).rejects.toThrow(
        /not configured/i,
      );
      expect(client.request).not.toHaveBeenCalled();
    });

    it('writes an audit entry', async () => {
      await service.connect(user, { credential: JWT });
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          action: 'TELEPHONY_CONNECTED',
        }),
      );
    });
  });

  describe('disconnect', () => {
    beforeEach(() => {
      const row = connectionRow({
        credential: require('../common/secret-box.util').encryptSecret(JWT, SECRET),
        subscriptionId: 'sub-1',
      });
      prisma.telephonyConnection.findUnique.mockResolvedValue(row);
    });

    it('removes the subscription and the row', async () => {
      await service.disconnect(user);

      expect(subscriptions.remove).toHaveBeenCalled();
      expect(prisma.telephonyConnection.delete).toHaveBeenCalledWith({
        where: { id: 'conn-1' },
      });
    });

    it('still disconnects when the subscription cannot be deleted', async () => {
      // A revoked credential must not trap the tenant in a connected state.
      // RingCentral expires the subscription once nothing renews it.
      subscriptions.remove.mockRejectedValueOnce(
        new RingCentralApiError(401, 'Token revoked'),
      );

      await expect(service.disconnect(user)).resolves.toMatchObject({
        disconnected: true,
      });
      expect(prisma.telephonyConnection.delete).toHaveBeenCalled();
    });

    it('clears the cached access token', async () => {
      await service.disconnect(user);
      expect(client.invalidate).toHaveBeenCalledWith('conn-1');
    });
  });

  describe('getStatus', () => {
    it('reports what is missing when the server is unconfigured', async () => {
      delete process.env.RINGCENTRAL_CLIENT_ID;
      delete process.env.RINGCENTRAL_WEBHOOK_BASE_URL;

      const status = await service.getStatus(user);

      expect(status.configured).toBe(false);
      expect(status.configuration_gaps).toEqual([
        'RINGCENTRAL_CLIENT_ID',
        'RINGCENTRAL_WEBHOOK_BASE_URL',
      ]);
    });

    it('never returns the stored credential', async () => {
      prisma.telephonyConnection.findUnique.mockResolvedValue(
        connectionRow({ credential: 'encrypted-value' }),
      );

      const status = await service.getStatus(user);

      expect(JSON.stringify(status)).not.toContain('encrypted-value');
    });

    it('defaults to sandbox so a stray call cannot hit production', async () => {
      delete process.env.RINGCENTRAL_SERVER_URL;
      await expect(service.getStatus(user)).resolves.toMatchObject({
        environment: 'sandbox',
      });
    });
  });
});
