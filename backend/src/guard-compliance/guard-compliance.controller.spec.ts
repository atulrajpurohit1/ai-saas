import 'reflect-metadata';
import { GuardComplianceController } from './guard-compliance.controller';
import { GuardComplianceService } from './guard-compliance.service';
import { PERMISSIONS_KEY } from '../auth/decorators/permissions.decorator';

// Confirms every mutation endpoint actually requires 'guards.manage' (not
// just the class-level 'guards.view' read permission) - a regression here
// would silently let a view-only user create/edit/delete/upload compliance
// records. Read endpoints (list, download) correctly inherit only the
// class-level 'guards.view' requirement.
describe('GuardComplianceController - permission gating', () => {
  const getPermissions = (
    methodName: keyof GuardComplianceController,
  ): string[] | undefined =>
    Reflect.getMetadata(
      PERMISSIONS_KEY,
      GuardComplianceController.prototype[methodName],
    ) as string[] | undefined;

  it('requires guards.manage to create a record', () => {
    expect(getPermissions('create')).toEqual(['guards.manage']);
  });

  it('requires guards.manage to update a record', () => {
    expect(getPermissions('update')).toEqual(['guards.manage']);
  });

  it('requires guards.manage to delete a record', () => {
    expect(getPermissions('remove')).toEqual(['guards.manage']);
  });

  it('requires guards.manage to upload a document', () => {
    expect(getPermissions('uploadDocument')).toEqual(['guards.manage']);
  });

  it('does not require guards.manage to list records (class-level guards.view applies instead)', () => {
    expect(getPermissions('findAll')).toBeUndefined();
  });

  it('does not require guards.manage to download a document (class-level guards.view applies instead)', () => {
    expect(getPermissions('downloadDocument')).toBeUndefined();
  });

  it('derives guard/tenant context from the authenticated user, never trusting a client-supplied verdict', () => {
    const mockService = {
      create: jest.fn().mockResolvedValue({ id: 'rec-1' }),
    };
    const controller = new GuardComplianceController(
      mockService as unknown as GuardComplianceService,
    );
    const user = {
      sub: 'admin-1',
      tenantId: 'tenant-1',
      role: 'admin',
    } as never;

    void controller.create(user, {
      guard_id: 'guard-1',
      type: 'guard_license',
    });

    expect(mockService.create).toHaveBeenCalledWith(user, {
      guard_id: 'guard-1',
      type: 'guard_license',
    });
  });
});
