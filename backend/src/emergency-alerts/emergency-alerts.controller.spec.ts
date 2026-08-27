import 'reflect-metadata';
import { EmergencyAlertsController } from './emergency-alerts.controller';
import { EmergencyAlertsService } from './emergency-alerts.service';
import { PERMISSIONS_KEY } from '../auth/decorators/permissions.decorator';

// Confirms the admin/dispatcher endpoints require the right permissions -
// in particular that acknowledge/resolve require 'incidents.review', not
// just the class-level 'incidents.view' read permission. The "Guard" system
// role only has 'incidents.create' (never 'incidents.review'), so this is
// what actually prevents a guard from acknowledging/resolving their own (or
// anyone else's) alert through the admin endpoints.
describe('EmergencyAlertsController - permission gating', () => {
  const getPermissions = (
    methodName: keyof EmergencyAlertsController,
  ): string[] | undefined =>
    Reflect.getMetadata(
      PERMISSIONS_KEY,
      EmergencyAlertsController.prototype[methodName],
    ) as string[] | undefined;

  it('does not require incidents.review to list alerts (class-level incidents.view applies instead)', () => {
    expect(getPermissions('findAll')).toBeUndefined();
  });

  it('requires incidents.review to acknowledge an alert', () => {
    expect(getPermissions('acknowledge')).toEqual(['incidents.review']);
  });

  it('requires incidents.review to resolve an alert', () => {
    expect(getPermissions('resolve')).toEqual(['incidents.review']);
  });

  it('derives admin identity from the authenticated user, never a client-supplied value', () => {
    const mockService = {
      acknowledge: jest.fn().mockResolvedValue({ id: 'alert-1' }),
    };
    const controller = new EmergencyAlertsController(
      mockService as unknown as EmergencyAlertsService,
    );
    const user = {
      sub: 'admin-1',
      tenantId: 'tenant-1',
      role: 'admin',
    } as never;

    void controller.acknowledge(user, 'alert-1', {});

    expect(mockService.acknowledge).toHaveBeenCalledWith(user, 'alert-1', {});
  });
});
