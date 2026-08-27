import { ForbiddenException } from '@nestjs/common';
import { GuardEmergencyAlertsController } from './guard-emergency-alerts.controller';
import { EmergencyAlertsService } from './emergency-alerts.service';
import { ActiveUser } from '../auth/interfaces/active-user.interface';

describe('GuardEmergencyAlertsController - identity gate', () => {
  let controller: GuardEmergencyAlertsController;
  let service: { triggerForGuard: jest.Mock; findActiveForGuard: jest.Mock };

  beforeEach(() => {
    service = {
      triggerForGuard: jest.fn().mockResolvedValue({ id: 'alert-1' }),
      findActiveForGuard: jest.fn().mockResolvedValue(null),
    };
    controller = new GuardEmergencyAlertsController(
      service as unknown as EmergencyAlertsService,
    );
  });

  it('rejects a non-guard-role token (e.g. an admin JWT reused against the guard trigger route)', () => {
    const nonGuardUser = {
      sub: 'user-1',
      tenantId: 'tenant-1',
      role: 'admin',
    } as ActiveUser;

    expect(() => controller.trigger(nonGuardUser)).toThrow(ForbiddenException);
    expect(service.triggerForGuard).not.toHaveBeenCalled();
  });

  it('rejects a guard-role token missing a guardId claim', () => {
    const malformedUser = {
      sub: 'user-1',
      tenantId: 'tenant-1',
      role: 'guard',
    } as ActiveUser;

    expect(() => controller.trigger(malformedUser)).toThrow(ForbiddenException);
    expect(service.triggerForGuard).not.toHaveBeenCalled();
  });

  it('derives guardId/tenantId from the token, never from the request body, for a valid guard', () => {
    const guardUser = {
      sub: 'user-1',
      tenantId: 'tenant-1',
      role: 'guard',
      guardId: 'guard-1',
    } as ActiveUser;

    void controller.trigger(guardUser);

    expect(service.triggerForGuard).toHaveBeenCalledWith('tenant-1', 'guard-1');
  });

  it('scopes the active-alert lookup to the authenticated guard', () => {
    const guardUser = {
      sub: 'user-1',
      tenantId: 'tenant-1',
      role: 'guard',
      guardId: 'guard-1',
    } as ActiveUser;

    void controller.active(guardUser);

    expect(service.findActiveForGuard).toHaveBeenCalledWith(
      'tenant-1',
      'guard-1',
    );
  });
});
