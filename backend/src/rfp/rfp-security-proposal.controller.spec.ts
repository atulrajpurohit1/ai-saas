import 'reflect-metadata';
import { RfpController } from './rfp.controller';
import { RfpService } from './rfp.service';
import { PERMISSIONS_KEY } from '../auth/decorators/permissions.decorator';

// Phase 3H - confirms the new RFP endpoints inherit the class-level 'rfp.view'
// and add the correct mutation permission, and that tenant/user come from the
// authenticated principal, not the request body.
describe('RfpController - Phase 3H permission gating', () => {
  const methodPerms = (m: keyof RfpController): string[] | undefined =>
    Reflect.getMetadata(PERMISSIONS_KEY, RfpController.prototype[m]) as
      | string[]
      | undefined;

  it('class is guarded by rfp.view', () => {
    const classPerms = Reflect.getMetadata(PERMISSIONS_KEY, RfpController) as
      | string[]
      | undefined;
    expect(classPerms).toEqual(['rfp.view']);
  });

  it('requirement analysis (read) inherits only the class-level rfp.view', () => {
    expect(methodPerms('getRequirementAnalysis')).toBeUndefined();
  });

  it('running the analysis requires rfp.evaluate', () => {
    expect(methodPerms('analyzeRequirements')).toEqual(['rfp.evaluate']);
  });

  it('generating a proposal from an RFP requires proposals.create', () => {
    expect(methodPerms('generateProposalFromRfp')).toEqual(['proposals.create']);
  });

  it('derives tenantId/userId from the JWT principal, not the body', () => {
    const mockService = {
      analyzeRequirements: jest.fn().mockResolvedValue({ id: 'ana-1' }),
      generateProposalFromRfp: jest.fn().mockResolvedValue({ proposal: { id: 'p-1' } }),
    };
    const controller = new RfpController(
      mockService as unknown as RfpService,
    );
    const user = { tenantId: 'tenant-1', sub: 'user-1' } as never;

    void controller.analyzeRequirements(user, 'rfp-1');
    expect(mockService.analyzeRequirements).toHaveBeenCalledWith(
      'tenant-1',
      'user-1',
      'rfp-1',
    );

    void controller.generateProposalFromRfp(user, 'rfp-1', {
      clientId: 'c-1',
    } as never);
    expect(mockService.generateProposalFromRfp).toHaveBeenCalledWith(
      'tenant-1',
      'user-1',
      'rfp-1',
      { clientId: 'c-1' },
    );
  });
});
