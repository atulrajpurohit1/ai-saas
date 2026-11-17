import { Response } from 'express';
import { RingCentralWebhookController } from './ringcentral-webhook.controller';

describe('RingCentralWebhookController', () => {
  let controller: RingCentralWebhookController;
  let sync: { connectionForSecret: jest.Mock; ingestTelephonyEvent: jest.Mock };
  let res: Response & { setHeader: jest.Mock };

  beforeEach(() => {
    sync = {
      connectionForSecret: jest.fn().mockResolvedValue({ id: 'conn-1' }),
      ingestTelephonyEvent: jest.fn().mockResolvedValue({ created: true }),
    };
    res = { setHeader: jest.fn() } as unknown as Response & { setHeader: jest.Mock };
    controller = new RingCentralWebhookController(sync as never);

    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('subscription handshake', () => {
    it('echoes the validation token back in the response header', async () => {
      // RingCentral does not activate the subscription until this is echoed.
      await controller.handle('hook-secret', {}, res, 'token-abc');

      expect(res.setHeader).toHaveBeenCalledWith('Validation-Token', 'token-abc');
    });

    it('answers the handshake without needing a known connection', async () => {
      // The handshake can arrive before anything else; refusing it because the
      // secret did not resolve would stop the subscription ever activating.
      sync.connectionForSecret.mockResolvedValue(null);

      await controller.handle('hook-secret', {}, res, 'token-abc');

      expect(res.setHeader).toHaveBeenCalledWith('Validation-Token', 'token-abc');
      expect(sync.ingestTelephonyEvent).not.toHaveBeenCalled();
    });
  });

  describe('event delivery', () => {
    it('routes the event to the tenant the path secret identifies', async () => {
      const payload = { body: { telephonySessionId: 'session-1' } };

      await controller.handle('hook-secret', payload, res);

      expect(sync.connectionForSecret).toHaveBeenCalledWith('hook-secret');
      expect(sync.ingestTelephonyEvent).toHaveBeenCalledWith(
        { id: 'conn-1' },
        payload,
      );
    });

    it('accepts an unknown secret without erroring', async () => {
      // A rotated secret means stale deliveries are expected for a while.
      // Returning an error would count against the subscription's health.
      sync.connectionForSecret.mockResolvedValue(null);

      await expect(
        controller.handle('stale-secret', {}, res),
      ).resolves.toEqual({ received: true });
      expect(sync.ingestTelephonyEvent).not.toHaveBeenCalled();
    });

    it('never propagates an ingestion failure', async () => {
      // RingCentral suspends a subscription PERMANENTLY after repeated
      // non-200s. One malformed payload must not cost a tenant call capture
      // until somebody notices and reconnects.
      sync.ingestTelephonyEvent.mockRejectedValue(new Error('database is down'));

      await expect(controller.handle('hook-secret', {}, res)).resolves.toEqual({
        received: true,
      });
    });

    it('never propagates a lookup failure either', async () => {
      sync.connectionForSecret.mockRejectedValue(new Error('database is down'));

      await expect(controller.handle('hook-secret', {}, res)).resolves.toEqual({
        received: true,
      });
    });

    it('does not echo a validation header on an ordinary event', async () => {
      await controller.handle('hook-secret', { body: {} }, res);
      expect(res.setHeader).not.toHaveBeenCalled();
    });
  });
});
