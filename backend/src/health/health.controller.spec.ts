import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaService } from '../prisma/prisma.service';

describe('HealthController', () => {
  const buildController = async (
    queryRaw: jest.Mock,
  ): Promise<HealthController> => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: { $queryRaw: queryRaw } },
      ],
    }).compile();

    return moduleRef.get(HealthController);
  };

  it('reports liveness without touching the database', async () => {
    const queryRaw = jest.fn();
    const controller = await buildController(queryRaw);

    expect(controller.liveness().status).toBe('ok');
    // The whole point of a separate liveness probe: a database outage must not
    // make the platform kill a process that is otherwise fine.
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('reports readiness when the database answers', async () => {
    const controller = await buildController(jest.fn().mockResolvedValue([{}]));

    const result = await controller.readiness();

    expect(result.status).toBe('ok');
    expect(result.database.ok).toBe(true);
  });

  it('fails readiness with 503 when the database does not answer', async () => {
    const controller = await buildController(
      jest.fn().mockRejectedValue(new Error('connection refused')),
    );

    // A deploy gate reads the status code, so this must not resolve with a 200.
    await expect(controller.readiness()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
