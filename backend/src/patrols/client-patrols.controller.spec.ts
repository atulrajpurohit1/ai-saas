import { ForbiddenException } from '@nestjs/common';
import { ClientPatrolsController } from './client-patrols.controller';
import { PatrolsService } from './patrols.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';

describe('ClientPatrolsController - identity gate', () => {
  let controller: ClientPatrolsController;
  let patrolsService: { getLiveSiteStatusForClient: jest.Mock };

  beforeEach(() => {
    patrolsService = {
      getLiveSiteStatusForClient: jest.fn().mockResolvedValue([]),
    };
    controller = new ClientPatrolsController(
      patrolsService as unknown as PatrolsService,
    );
  });

  it('rejects a non-client-role token (e.g. an admin JWT reused against the client route)', () => {
    const nonClientUser = {
      sub: 'user-1',
      tenantId: 'tenant-1',
      role: 'admin',
    } as ActiveUser;

    expect(() => controller.liveStatus(nonClientUser)).toThrow(
      ForbiddenException,
    );
    expect(patrolsService.getLiveSiteStatusForClient).not.toHaveBeenCalled();
  });

  it('rejects a client-role token missing a clientId claim', () => {
    const malformedUser = {
      sub: 'user-1',
      tenantId: 'tenant-1',
      role: 'client',
    } as ActiveUser;

    expect(() => controller.liveStatus(malformedUser)).toThrow(
      ForbiddenException,
    );
    expect(patrolsService.getLiveSiteStatusForClient).not.toHaveBeenCalled();
  });

  it('derives clientId/tenantId from the token, never from a request parameter, for a valid client', () => {
    const clientUser = {
      sub: 'user-1',
      tenantId: 'tenant-1',
      role: 'client',
      clientId: 'client-1',
    } as ActiveUser;

    void controller.liveStatus(clientUser);

    expect(patrolsService.getLiveSiteStatusForClient).toHaveBeenCalledWith(
      'tenant-1',
      'client-1',
    );
  });
});
