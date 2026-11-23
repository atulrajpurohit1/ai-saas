import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { ShiftsService } from '../shifts/shifts.service';
import { SitesService } from './sites.service';

describe('SitesService guard auto assignment', () => {
  const user = {
    sub: 'admin-1',
    tenantId: 'tenant-1',
    role: 'admin',
    isSuperAdmin: true,
  } as any;

  let prisma: {
    site: {
      findFirst: jest.Mock;
      update: jest.Mock;
    };
  };
  let auditService: { log: jest.Mock };
  let shiftsService: { autoAssignUpcomingShiftsForSite: jest.Mock };
  let service: SitesService;

  beforeEach(() => {
    prisma = {
      site: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'site-1',
          name: 'Central Mall',
          autoAssignGuards: false,
        }),
        update: jest.fn().mockResolvedValue({
          id: 'site-1',
          name: 'Central Mall',
          autoAssignGuards: true,
          branch: null,
          client: null,
        }),
      },
    };
    auditService = { log: jest.fn().mockResolvedValue(undefined) };
    shiftsService = {
      autoAssignUpcomingShiftsForSite: jest.fn().mockResolvedValue({
        shiftsProcessed: 2,
        guardsAssigned: 3,
        shiftsStillOpen: 0,
        shifts: [],
      }),
    };
    service = new SitesService(
      prisma as unknown as PrismaService,
      auditService as unknown as AuditService,
      shiftsService as unknown as ShiftsService,
    );
  });

  it('enables the setting and immediately fills existing upcoming shifts', async () => {
    const result = await service.setAutoAssignment(user, 'site-1', true);

    expect(prisma.site.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'site-1' },
        data: { autoAssignGuards: true },
      }),
    );
    expect(shiftsService.autoAssignUpcomingShiftsForSite).toHaveBeenCalledWith(
      user,
      'site-1',
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SITE_AUTO_ASSIGNMENT_ENABLED' }),
    );
    expect(result.autoAssignment).toEqual(
      expect.objectContaining({ guardsAssigned: 3 }),
    );
  });

  it('turns the setting off without changing existing assignments', async () => {
    prisma.site.update.mockResolvedValue({
      id: 'site-1',
      name: 'Central Mall',
      autoAssignGuards: false,
    });

    const result = await service.setAutoAssignment(user, 'site-1', false);

    expect(
      shiftsService.autoAssignUpcomingShiftsForSite,
    ).not.toHaveBeenCalled();
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'SITE_AUTO_ASSIGNMENT_DISABLED' }),
    );
    expect(result.autoAssignment).toBeNull();
  });
});
