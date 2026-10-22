import { BrandingService } from './branding.service';

/**
 * The company name is the tenant's name, not a display-only overlay. It used
 * to live only on TenantBranding, so renaming the company changed the platform
 * header and nothing else -- billing, the super-admin list and the Stripe
 * customer all kept the signup name. These tests pin the write-through to
 * Tenant.name.
 */
describe('BrandingService.updateBranding', () => {
  let service: BrandingService;
  let prisma: {
    tenant: { findUnique: jest.Mock; update: jest.Mock };
    tenantBranding: { upsert: jest.Mock };
  };
  let audit: { log: jest.Mock };

  const user = { tenantId: 'tenant-1', sub: 'user-1' } as never;

  const tenantWithName = (name: string, brandingName?: string | null) => ({
    name,
    branding: brandingName === undefined ? null : { companyName: brandingName },
  });

  beforeEach(() => {
    prisma = {
      tenant: {
        findUnique: jest
          .fn()
          .mockResolvedValue(tenantWithName('Old Signup Name')),
        update: jest.fn().mockResolvedValue({}),
      },
      tenantBranding: {
        upsert: jest.fn().mockResolvedValue({
          id: 'brand-1',
          logoUrl: null,
          primaryColor: '#6366f1',
          secondaryColor: '#334155',
          accentColor: '#818cf8',
        }),
      },
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };

    service = new BrandingService(prisma as never, audit as never);
  });

  it('writes a new company name through to the tenant', async () => {
    await service.updateBranding(user, { company_name: 'New Brand Co' });

    expect(prisma.tenant.update).toHaveBeenCalledWith({
      where: { id: 'tenant-1' },
      data: { name: 'New Brand Co' },
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'TENANT_RENAMED' }),
    );
  });

  it('does not rewrite the tenant when the name is unchanged', async () => {
    prisma.tenant.findUnique.mockResolvedValue(
      tenantWithName('Old Signup Name', 'Old Signup Name'),
    );

    await service.updateBranding(user, { company_name: 'Old Signup Name' });

    expect(prisma.tenant.update).not.toHaveBeenCalled();
  });

  it('does not touch the tenant name when only colors change', async () => {
    await service.updateBranding(user, { primary_color: '#ff0000' });

    expect(prisma.tenant.update).not.toHaveBeenCalled();
  });

  it('does not erase the tenant name when the branding field is cleared', async () => {
    // Clearing the branding field means "fall back to the tenant name", not
    // "erase it" -- Tenant.name is NOT NULL besides.
    await service.updateBranding(user, { company_name: '   ' });

    expect(prisma.tenant.update).not.toHaveBeenCalled();
  });
});
