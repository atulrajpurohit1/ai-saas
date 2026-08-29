import 'reflect-metadata';
import { IncidentsController } from './incidents.controller';
import { ClientIncidentsController } from './client-incidents.controller';
import { IncidentsService } from './incidents.service';
import { PERMISSIONS_KEY } from '../auth/decorators/permissions.decorator';

// Phase 3F - confirms evidence mutation endpoints require 'incidents.review'
// (not just the class-level 'incidents.view'), that reads inherit only
// 'incidents.view', and that the client-facing evidence endpoints stay
// locked to the 'client' role with no write surface.
describe('IncidentsController - evidence permission gating', () => {
  const perms = (m: keyof IncidentsController): string[] | undefined =>
    Reflect.getMetadata(PERMISSIONS_KEY, IncidentsController.prototype[m]) as
      | string[]
      | undefined;

  it('requires incidents.review to upload evidence', () => {
    expect(perms('uploadEvidence')).toEqual(['incidents.review']);
  });

  it('requires incidents.review to delete evidence', () => {
    expect(perms('deleteEvidence')).toEqual(['incidents.review']);
  });

  it('lets a viewer list evidence (inherits class-level incidents.view)', () => {
    expect(perms('listEvidence')).toBeUndefined();
  });

  it('lets a viewer stream an evidence file (inherits class-level incidents.view)', () => {
    expect(perms('downloadEvidence')).toBeUndefined();
  });

  it('derives tenant/user context from the authenticated user, not the request body', () => {
    const mockService = {
      addEvidenceForAdmin: jest.fn().mockResolvedValue({ id: 'ev-1' }),
    };
    const controller = new IncidentsController(
      mockService as unknown as IncidentsService,
    );
    const user = { sub: 'admin-1', tenantId: 'tenant-1', role: 'admin' } as never;
    const file = { originalname: 'a.jpg' } as Express.Multer.File;

    void controller.uploadEvidence(user, 'inc-1', file);

    expect(mockService.addEvidenceForAdmin).toHaveBeenCalledWith(
      user,
      'inc-1',
      file,
    );
  });
});

describe('ClientIncidentsController - evidence is read-only and role-locked', () => {
  it('is locked to the client role at the class level', () => {
    const roles = Reflect.getMetadata(
      'roles',
      ClientIncidentsController,
    ) as string[];
    expect(roles).toEqual(['client']);
  });

  it('exposes only read methods for evidence (no upload/delete handler)', () => {
    const proto = ClientIncidentsController.prototype as unknown as Record<
      string,
      unknown
    >;
    expect(typeof proto.listEvidence).toBe('function');
    expect(typeof proto.downloadEvidence).toBe('function');
    expect(proto.uploadEvidence).toBeUndefined();
    expect(proto.deleteEvidence).toBeUndefined();
  });
});
