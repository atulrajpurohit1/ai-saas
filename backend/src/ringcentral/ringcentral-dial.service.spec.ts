import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ActiveUser } from '../auth/interfaces/active-user.interface';
import { RingCentralApiError } from './ringcentral-client.service';
import { RingCentralDialService } from './ringcentral-dial.service';

const user = { tenantId: 'tenant-1', sub: 'user-1' } as ActiveUser;

describe('RingCentralDialService', () => {
  let service: RingCentralDialService;
  let prisma: {
    lead: { findFirst: jest.Mock };
    deal: { findFirst: jest.Mock };
    callRecord: { create: jest.Mock };
  };
  let client: { request: jest.Mock };
  let connections: { findForTenant: jest.Mock; credentialOf: jest.Mock };
  let audit: { log: jest.Mock };

  beforeEach(() => {
    process.env.DEFAULT_PHONE_COUNTRY_CODE = '1';

    prisma = {
      lead: { findFirst: jest.fn().mockResolvedValue({ id: 'lead-1' }) },
      deal: { findFirst: jest.fn().mockResolvedValue({ id: 'deal-1' }) },
      callRecord: { create: jest.fn() },
    };
    client = {
      request: jest.fn().mockResolvedValue({
        id: 'ro-1',
        status: { callStatus: 'InProgress' },
      }),
    };
    connections = {
      findForTenant: jest.fn().mockResolvedValue({ id: 'conn-1' }),
      credentialOf: jest.fn().mockReturnValue('jwt'),
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };

    service = new RingCentralDialService(
      prisma as never,
      client as never,
      connections as never,
      audit as never,
    );
  });

  it('places a RingOut with both numbers normalised to E.164', async () => {
    await service.dial(user, {
      toNumber: '(415) 555-1234',
      fromNumber: '415 555 0000',
    });

    const [, , path, init] = client.request.mock.calls[0];
    expect(path).toBe('/restapi/v1.0/account/~/extension/~/ring-out');
    expect(JSON.parse(init.body)).toMatchObject({
      from: { phoneNumber: '+14155550000' },
      to: { phoneNumber: '+14155551234' },
      playPrompt: false,
    });
  });

  it('does not create a call record', async () => {
    // The telephony webhook creates it, keyed on the session id. Writing one
    // here would produce a duplicate nothing can reconcile, because a RingOut
    // id is not a telephonySessionId.
    await service.dial(user, { toNumber: '+14155551234', fromNumber: '+14155550000' });

    expect(prisma.callRecord.create).not.toHaveBeenCalled();
  });

  it('refuses when RingCentral is not connected', async () => {
    connections.findForTenant.mockResolvedValue(null);

    await expect(
      service.dial(user, { toNumber: '+14155551234', fromNumber: '+14155550000' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(client.request).not.toHaveBeenCalled();
  });

  it('rejects an unusable number before dialling anything', async () => {
    await expect(
      service.dial(user, { toNumber: 'not a number', fromNumber: '+14155550000' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(client.request).not.toHaveBeenCalled();
  });

  it('checks lead ownership before dialling', async () => {
    // A leadId from another tenant must not become attachable to this
    // tenant's call record.
    prisma.lead.findFirst.mockResolvedValue(null);

    await expect(
      service.dial(user, {
        toNumber: '+14155551234',
        fromNumber: '+14155550000',
        leadId: '11111111-1111-1111-1111-111111111111',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(client.request).not.toHaveBeenCalled();
  });

  it('names the missing permission rather than blaming the credential', async () => {
    client.request.mockRejectedValue(
      new RingCentralApiError(403, 'forbidden', 'SUB-410'),
    );

    await expect(
      service.dial(user, { toNumber: '+14155551234', fromNumber: '+14155550000' }),
    ).rejects.toThrow(/RingOut permission/i);
  });

  it('tells the user to reconnect when the credential is dead', async () => {
    client.request.mockRejectedValue(new RingCentralApiError(401, 'unauthorized'));

    await expect(
      service.dial(user, { toNumber: '+14155551234', fromNumber: '+14155550000' }),
    ).rejects.toThrow(/reconnect/i);
  });

  it('audits the dial', async () => {
    await service.dial(user, { toNumber: '+14155551234', fromNumber: '+14155550000' });

    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CALL_DIALED', tenantId: 'tenant-1' }),
    );
  });
});
