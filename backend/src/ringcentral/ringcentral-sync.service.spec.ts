import { TelephonyConnection } from '@prisma/client';
import { RingCentralSyncService } from './ringcentral-sync.service';

const connection = {
  id: 'conn-1',
  tenantId: 'tenant-1',
  provider: 'ringcentral',
} as TelephonyConnection;

/** A telephony session event in the shape RingCentral delivers. */
function event(parties: unknown[], telephonySessionId = 'session-1') {
  return {
    uuid: 'evt-1',
    event: '/restapi/v1.0/account/~/telephony/sessions',
    timestamp: '2026-11-17T10:00:00.000Z',
    body: { telephonySessionId, accountId: '400100', parties },
  };
}

const outboundEnded = {
  id: 'p-1',
  direction: 'Outbound',
  from: { phoneNumber: '+14155550000', extensionId: '101' },
  to: { phoneNumber: '+14155551234' },
  status: { code: 'Disconnected' },
  missedCall: false,
};

const inboundEnded = {
  id: 'p-2',
  direction: 'Inbound',
  from: { phoneNumber: '+14155559999' },
  to: { phoneNumber: '+14155550000', extensionId: '101' },
  status: { code: 'Disconnected' },
  missedCall: false,
};

describe('RingCentralSyncService', () => {
  let service: RingCentralSyncService;
  let prisma: {
    callRecord: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    telephonyConnection: { update: jest.Mock };
    deal: { findFirst: jest.Mock };
    $queryRaw: jest.Mock;
  };
  let client: { request: jest.Mock };
  let connections: { credentialOf: jest.Mock; findByWebhookSecret: jest.Mock };

  beforeEach(() => {
    prisma = {
      callRecord: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({ id: 'call-1' }),
        update: jest.fn().mockResolvedValue({ id: 'call-1' }),
      },
      telephonyConnection: { update: jest.fn().mockResolvedValue({}) },
      deal: { findFirst: jest.fn().mockResolvedValue(null) },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    client = { request: jest.fn().mockResolvedValue({ records: [] }) };
    connections = {
      credentialOf: jest.fn().mockReturnValue('jwt'),
      findByWebhookSecret: jest.fn().mockResolvedValue(connection),
    };

    service = new RingCentralSyncService(
      prisma as never,
      client as never,
      connections as never,
    );
  });

  describe('ingestTelephonyEvent', () => {
    it('ignores a call still in progress', async () => {
      // Mid-call events carry no duration and no result, and the call log has
      // nothing to say about a call that has not ended.
      const result = await service.ingestTelephonyEvent(
        connection,
        event([{ ...outboundEnded, status: { code: 'Proceeding' } }]),
      );

      expect(result).toEqual({ ignored: 'call-in-progress' });
      expect(prisma.callRecord.create).not.toHaveBeenCalled();
    });

    it('records a completed outbound call against the dialled number', async () => {
      await service.ingestTelephonyEvent(connection, event([outboundEnded]));

      expect(prisma.callRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: 'tenant-1',
            externalSessionId: 'session-1',
            source: 'ringcentral',
            direction: 'outbound',
            phoneNumber: '+14155551234',
          }),
        }),
      );
    });

    it('takes the caller, not the callee, as the number on an inbound call', async () => {
      // Getting this backwards files every inbound call against the company's
      // own main number.
      await service.ingestTelephonyEvent(connection, event([inboundEnded]));

      expect(prisma.callRecord.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            direction: 'inbound',
            phoneNumber: '+14155559999',
          }),
        }),
      );
    });

    it('does not claim a call connected when the event cannot know', async () => {
      // A telephony event says a call ended, never whether anyone answered.
      // Reconciliation settles the outcome from the call log.
      await service.ingestTelephonyEvent(connection, event([outboundEnded]));

      expect(prisma.callRecord.create.mock.calls[0][0].data.outcome).toBe('dialed');
    });

    it('marks a missed call as no_answer immediately', async () => {
      await service.ingestTelephonyEvent(
        connection,
        event([{ ...inboundEnded, missedCall: true }]),
      );

      expect(prisma.callRecord.create.mock.calls[0][0].data.outcome).toBe('no_answer');
    });

    it('is idempotent: the same session never creates two rows', async () => {
      // RingCentral sends one event per party and retries on failure, so
      // duplicates are the normal case, not an edge case.
      prisma.callRecord.findFirst.mockResolvedValueOnce({ id: 'call-existing' });

      const result = await service.ingestTelephonyEvent(
        connection,
        event([outboundEnded]),
      );

      expect(result).toMatchObject({ ignored: 'already-recorded' });
      expect(prisma.callRecord.create).not.toHaveBeenCalled();
    });

    it('ignores an event with no session id rather than throwing', async () => {
      const result = await service.ingestTelephonyEvent(connection, { body: {} });
      expect(result).toEqual({ ignored: 'no-session-id' });
    });

    it('ignores a call with no counterparty number (blocked caller)', async () => {
      const result = await service.ingestTelephonyEvent(
        connection,
        event([{ ...inboundEnded, from: {} }]),
      );
      expect(result).toEqual({ ignored: 'no-counterparty-number' });
    });

    it('attaches the call to a matching lead', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([{ id: 'lead-7' }]);
      prisma.deal.findFirst.mockResolvedValueOnce({ id: 'deal-3' });

      await service.ingestTelephonyEvent(connection, event([outboundEnded]));

      expect(prisma.callRecord.create.mock.calls[0][0].data).toMatchObject({
        leadId: 'lead-7',
        dealId: 'deal-3',
      });
    });

    it('still records a call from an unknown number', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([]);

      await service.ingestTelephonyEvent(connection, event([outboundEnded]));

      expect(prisma.callRecord.create.mock.calls[0][0].data).toMatchObject({
        leadId: null,
        dealId: null,
      });
    });

    it('does not attempt a lead match on a number too short to be one', async () => {
      // An internal extension-to-extension call would otherwise suffix-match
      // an arbitrary customer.
      await service.ingestTelephonyEvent(
        connection,
        event([{ ...outboundEnded, to: { phoneNumber: '101' } }]),
      );

      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });
  });

  describe('reconcileTenant', () => {
    const now = new Date('2026-11-17T12:00:00.000Z');
    const pendingRow = {
      id: 'call-1',
      externalSessionId: 'session-1',
      createdAt: new Date('2026-11-17T11:00:00.000Z'),
    };

    it('does no API work when nothing is pending', async () => {
      await expect(service.reconcileTenant(connection, now)).resolves.toEqual({
        reconciled: 0,
        pending: 0,
      });
      expect(client.request).not.toHaveBeenCalled();
    });

    it('fills in duration and outcome from the call log', async () => {
      prisma.callRecord.findMany.mockResolvedValueOnce([pendingRow]);
      client.request.mockResolvedValueOnce({
        records: [
          {
            id: 'cl-1',
            telephonySessionId: 'session-1',
            duration: 143,
            result: 'Accepted',
          },
        ],
      });

      const outcome = await service.reconcileTenant(connection, now);

      expect(outcome).toEqual({ reconciled: 1, pending: 0 });
      expect(prisma.callRecord.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'call-1' },
          data: expect.objectContaining({ durationSec: 143, outcome: 'connected' }),
        }),
      );
    });

    it('records the recording id when one exists', async () => {
      prisma.callRecord.findMany.mockResolvedValueOnce([pendingRow]);
      client.request.mockResolvedValueOnce({
        records: [
          {
            telephonySessionId: 'session-1',
            duration: 60,
            result: 'Accepted',
            recording: { id: 'rec-9', contentUri: 'https://media/x/content' },
          },
        ],
      });

      await service.reconcileTenant(connection, now);

      expect(prisma.callRecord.update.mock.calls[0][0].data.externalRecordingId).toBe(
        'rec-9',
      );
    });

    it('leaves a call pending when the log has not caught up yet', async () => {
      // RingCentral populates the call log with "a small latency". A call that
      // is not there yet must stay pending for the next sweep, not be written
      // off as a zero-duration call.
      prisma.callRecord.findMany.mockResolvedValueOnce([pendingRow]);
      client.request.mockResolvedValueOnce({ records: [] });

      const outcome = await service.reconcileTenant(connection, now);

      expect(outcome).toEqual({ reconciled: 0, pending: 1 });
      expect(prisma.callRecord.update).not.toHaveBeenCalled();
    });

    it('reads the call log once for many pending calls', async () => {
      // One request per call would burn the rate-limit budget on a busy
      // afternoon for near-identical reads.
      prisma.callRecord.findMany.mockResolvedValueOnce([
        pendingRow,
        { ...pendingRow, id: 'call-2', externalSessionId: 'session-2' },
        { ...pendingRow, id: 'call-3', externalSessionId: 'session-3' },
      ]);
      client.request.mockResolvedValueOnce({ records: [] });

      await service.reconcileTenant(connection, now);

      expect(client.request).toHaveBeenCalledTimes(1);
    });

    it('maps an unrecognised result to dialed rather than guessing', async () => {
      // RingCentral does not publish the full result enumeration. A call
      // wrongly marked "connected" corrupts the rep's follow-up list.
      prisma.callRecord.findMany.mockResolvedValueOnce([pendingRow]);
      client.request.mockResolvedValueOnce({
        records: [
          { telephonySessionId: 'session-1', duration: 5, result: 'SomethingNew' },
        ],
      });

      await service.reconcileTenant(connection, now);

      expect(prisma.callRecord.update.mock.calls[0][0].data.outcome).toBe('dialed');
    });

    it('maps voicemail and busy to their existing outcomes', async () => {
      prisma.callRecord.findMany.mockResolvedValueOnce([
        pendingRow,
        { ...pendingRow, id: 'call-2', externalSessionId: 'session-2' },
      ]);
      client.request.mockResolvedValueOnce({
        records: [
          { telephonySessionId: 'session-1', duration: 12, result: 'Voicemail' },
          { telephonySessionId: 'session-2', duration: 0, result: 'Busy' },
        ],
      });

      await service.reconcileTenant(connection, now);

      const outcomes = prisma.callRecord.update.mock.calls.map(
        (call) => call[0].data.outcome,
      );
      expect(outcomes).toEqual(['voicemail', 'failed']);
    });
  });
});
