import { ForbiddenException } from '@nestjs/common';
import { GuardPatrolsController } from './guard-patrols.controller';
import { PatrolsService } from './patrols.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';

describe('GuardPatrolsController - identity gate', () => {
  let controller: GuardPatrolsController;
  let patrolsService: { updateLocation: jest.Mock };

  beforeEach(() => {
    patrolsService = {
      updateLocation: jest.fn().mockResolvedValue({ id: 'run-1' }),
    };
    controller = new GuardPatrolsController(
      patrolsService as unknown as PatrolsService,
    );
  });

  it('rejects a request with no guard role (e.g. an admin JWT reused against a guard route)', () => {
    const nonGuardUser = {
      sub: 'user-1',
      tenantId: 'tenant-1',
      role: 'admin',
    } as ActiveUser;

    expect(() =>
      controller.updateLocation(nonGuardUser, 'run-1', {
        latitude: 1,
        longitude: 1,
      }),
    ).toThrow(ForbiddenException);
    expect(patrolsService.updateLocation).not.toHaveBeenCalled();
  });

  it('rejects a guard-role token missing a guardId claim', () => {
    const malformedUser = {
      sub: 'user-1',
      tenantId: 'tenant-1',
      role: 'guard',
    } as ActiveUser;

    expect(() =>
      controller.updateLocation(malformedUser, 'run-1', {
        latitude: 1,
        longitude: 1,
      }),
    ).toThrow(ForbiddenException);
  });

  it('derives guardId/tenantId from the token, never from the request body, for a valid guard', () => {
    const guardUser = {
      sub: 'user-1',
      tenantId: 'tenant-1',
      role: 'guard',
      guardId: 'guard-1',
    } as ActiveUser;

    void controller.updateLocation(guardUser, 'run-1', {
      latitude: 1,
      longitude: 1,
    });

    expect(patrolsService.updateLocation).toHaveBeenCalledWith(
      'tenant-1',
      'guard-1',
      'run-1',
      { latitude: 1, longitude: 1 },
    );
  });
});
