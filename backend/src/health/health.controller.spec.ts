import { HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { HealthController } from './health.controller';
import { PrismaService } from '../prisma/prisma.service';

// Only $queryRaw is exercised, so the rest of PrismaClient is not worth
// standing up.
const prismaWith = (queryRaw: jest.Mock) =>
  ({ $queryRaw: queryRaw }) as unknown as PrismaService;

const mockResponse = () => {
  const res = { status: jest.fn() } as unknown as Response;
  return res;
};

describe('HealthController', () => {
  describe('GET /health/live', () => {
    it('reports ok without touching the database', () => {
      const queryRaw = jest.fn();
      const controller = new HealthController(prismaWith(queryRaw));

      expect(controller.live()).toEqual({
        status: 'ok',
        uptimeSeconds: expect.any(Number),
      });
      // The whole point of the liveness probe: a database outage must not make
      // it fail, or Docker restarts every container over a brief blip.
      expect(queryRaw).not.toHaveBeenCalled();
    });
  });

  describe('GET /health', () => {
    it('reports ok and leaves the status code alone when the database answers', async () => {
      const controller = new HealthController(
        prismaWith(jest.fn().mockResolvedValue([{ 1: 1 }])),
      );
      const res = mockResponse();

      const body = await controller.ready(res);

      expect(body).toMatchObject({ status: 'ok', database: 'ok' });
      expect(res.status).not.toHaveBeenCalled();
    });

    it('returns 503 when the database is unreachable', async () => {
      const failure = new Error('connect ECONNREFUSED 10.0.0.5:5432');
      failure.name = 'PrismaClientInitializationError';
      const controller = new HealthController(
        prismaWith(jest.fn().mockRejectedValue(failure)),
      );
      const res = mockResponse();

      const body = await controller.ready(res);

      expect(res.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
      expect(body).toEqual({
        status: 'error',
        database: 'unreachable',
        reason: 'PrismaClientInitializationError',
      });
      // The driver message carries the database host; it must not be served to
      // an unauthenticated caller.
      expect(JSON.stringify(body)).not.toContain('10.0.0.5');
    });
  });
});
