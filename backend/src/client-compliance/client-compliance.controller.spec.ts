import 'reflect-metadata';
import { ClientComplianceController } from './client-compliance.controller';
import { ClientPortalInsuranceController } from './client-portal-insurance.controller';
import { ClientComplianceService } from './client-compliance.service';
import {
  ANY_PERMISSIONS_KEY,
  PERMISSIONS_KEY,
} from '../auth/decorators/permissions.decorator';

// Phase 3G - confirms every mutation endpoint requires 'clients.manage', that
// policy reads/documents require 'clients.view', that the advisory summary is
// deliberately broadened to finance/invoice roles, and that the client-portal
// controller is role-locked with no write surface.
describe('ClientComplianceController - permission gating', () => {
  const perms = (m: keyof ClientComplianceController): string[] | undefined =>
    Reflect.getMetadata(
      PERMISSIONS_KEY,
      ClientComplianceController.prototype[m],
    ) as string[] | undefined;
  const anyPerms = (m: keyof ClientComplianceController): string[] | undefined =>
    Reflect.getMetadata(
      ANY_PERMISSIONS_KEY,
      ClientComplianceController.prototype[m],
    ) as string[] | undefined;

  it('requires clients.manage to create / update / delete / upload', () => {
    expect(perms('create')).toEqual(['clients.manage']);
    expect(perms('update')).toEqual(['clients.manage']);
    expect(perms('remove')).toEqual(['clients.manage']);
    expect(perms('uploadDocument')).toEqual(['clients.manage']);
  });

  it('requires clients.view to list policies and to download a document', () => {
    expect(perms('findAll')).toEqual(['clients.view']);
    expect(perms('downloadDocument')).toEqual(['clients.view']);
  });

  it('lets finance / invoice-preparer roles read the advisory summary', () => {
    expect(anyPerms('getSummary')).toEqual([
      'clients.view',
      'finance.view',
      'invoices.generate',
    ]);
    // summary exposes only counts, so it does not also demand clients.view
    expect(perms('getSummary')).toBeUndefined();
  });

  it('derives tenant/user context from the authenticated user, not the body', () => {
    const mockService = {
      create: jest.fn().mockResolvedValue({ id: 'pol-1' }),
    };
    const controller = new ClientComplianceController(
      mockService as unknown as ClientComplianceService,
    );
    const user = { sub: 'admin-1', tenantId: 'tenant-1', role: 'admin' } as never;
    const dto = { client_id: 'client-1', type: 'general_liability' };

    void controller.create(user, dto as never);

    expect(mockService.create).toHaveBeenCalledWith(user, dto);
  });
});

describe('ClientPortalInsuranceController - read-only + role-locked', () => {
  it('is locked to the client role at the class level', () => {
    const roles = Reflect.getMetadata(
      'roles',
      ClientPortalInsuranceController,
    ) as string[];
    expect(roles).toEqual(['client']);
  });

  it('exposes only read handlers (no create/update/delete/upload)', () => {
    const proto = ClientPortalInsuranceController.prototype as unknown as Record<
      string,
      unknown
    >;
    expect(typeof proto.findAll).toBe('function');
    expect(typeof proto.downloadDocument).toBe('function');
    expect(proto.create).toBeUndefined();
    expect(proto.update).toBeUndefined();
    expect(proto.remove).toBeUndefined();
    expect(proto.uploadDocument).toBeUndefined();
  });

  it('rejects a non-client principal via the context guard', () => {
    const controller = new ClientPortalInsuranceController(
      { findAllForClient: jest.fn() } as unknown as ClientComplianceService,
    );
    const adminUser = { sub: 'a', tenantId: 't', role: 'admin' } as never;
    expect(() => controller.findAll(adminUser)).toThrow('Client access required');
  });
});
