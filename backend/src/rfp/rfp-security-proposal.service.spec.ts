import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiService } from '../ai/ai.service';
import { AiGovernanceService } from '../ai-governance/ai-governance.service';
import { AuditService } from '../audit/audit.service';
import { BrandingService } from '../branding/branding.service';
import { EmailService } from '../email/email.service';
import { ProposalsService } from '../proposals/proposals.service';
import { RfpService } from './rfp.service';

const TENANT_A = 'tenant-a';

const RFP_A = {
  id: 'rfp-1',
  tenantId: TENANT_A,
  title: 'Unarmed Guard Services',
  clientName: 'Riverside Logistics',
  companyName: 'Riverside Logistics LLC',
  industry: 'Warehousing',
  securityTypes: ['Unarmed', 'Mobile Patrol'],
  numberOfLocations: 2,
  address: '100 Dock St',
  operatingHours: '24/7',
  guardsRequired: 6,
  startDate: new Date('2026-10-01'),
  endDate: new Date('2027-09-30'),
  dueDate: new Date('2026-09-15'),
  estimatedBudget: null,
  pricingModel: 'Hourly',
  requiredPricingItems: ['Guard Hourly Rate'],
  paymentTerms: 'Net 30',
  additionalRequirements: null,
  pricingNotes: null,
  generatedContent: '<h1>RFP</h1><p>All officers shall be unarmed. Vendor shall carry CGL of $2,000,000.</p>',
  status: 'GENERATED',
};

const ANALYSIS_DRAFT = {
  summary: 'Client needs 24/7 unarmed coverage across 2 sites.',
  requirements: [
    { requirement: 'Armed vs unarmed', category: 'services', sourceContext: 'unarmed', importance: 'mandatory', extractedValue: 'Unarmed', confidence: 95 },
    { requirement: 'General liability limit', category: 'insurance', sourceContext: 'CGL $2,000,000', importance: 'mandatory', extractedValue: '$2,000,000', confidence: 90 },
  ],
  missingInformation: ['Background check standard'],
  fallbackUsed: false,
};

describe('RfpService - Phase 3H security RFP -> proposal', () => {
  let service: RfpService;
  let prisma: {
    rfp: { findFirst: jest.Mock };
    rfpRequirementAnalysis: { create: jest.Mock; findFirst: jest.Mock };
  };
  let ai: { analyzeSecurityRfp: jest.Mock; generateProposalFromRfp: jest.Mock; getModelName: jest.Mock };
  let governance: { evaluateSafety: jest.Mock };
  let proposals: { create: jest.Mock };
  let audit: { log: jest.Mock };

  const user = { sub: 'admin-a' };

  beforeEach(async () => {
    prisma = {
      rfp: { findFirst: jest.fn() },
      rfpRequirementAnalysis: {
        create: jest.fn().mockImplementation(({ data }) => ({ id: 'ana-1', ...data })),
        findFirst: jest.fn(),
      },
    };
    ai = {
      analyzeSecurityRfp: jest.fn().mockResolvedValue(ANALYSIS_DRAFT),
      generateProposalFromRfp: jest.fn().mockResolvedValue(
        '# Proposal in Response to Unarmed Guard Services\n## Licensing, Compliance & Insurance\n[Insert general liability limit]\n## Staffing Plan\n[Confirm number of officers]',
      ),
      getModelName: jest.fn().mockReturnValue('gemini-2.5-flash'),
    };
    governance = {
      evaluateSafety: jest.fn().mockReturnValue({ status: 'passed', findings: [] }),
    };
    proposals = {
      create: jest.fn().mockImplementation((tenantId, dto) => ({
        id: 'prop-1',
        tenantId,
        title: dto.title,
        content: dto.content,
        status: dto.status,
        clientId: dto.clientId ?? null,
      })),
    };
    audit = { log: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RfpService,
        { provide: PrismaService, useValue: prisma },
        { provide: AiService, useValue: ai },
        { provide: AiGovernanceService, useValue: governance },
        { provide: AuditService, useValue: audit },
        {
          provide: BrandingService,
          useValue: { brandingSnapshot: jest.fn().mockResolvedValue({ company_name: 'Acme Security' }) },
        },
        { provide: EmailService, useValue: {} },
        { provide: ProposalsService, useValue: proposals },
      ],
    }).compile();

    service = module.get(RfpService);
  });

  describe('analyzeRequirements', () => {
    it('extracts requirements for an in-tenant RFP and stores the analysis', async () => {
      prisma.rfp.findFirst.mockResolvedValue(RFP_A);

      const result = await service.analyzeRequirements(TENANT_A, user.sub, 'rfp-1');

      expect(ai.analyzeSecurityRfp).toHaveBeenCalledWith(
        expect.objectContaining({
          structured: expect.objectContaining({
            title: 'Unarmed Guard Services',
            securityTypes: ['Unarmed', 'Mobile Patrol'],
            operatingHours: '24/7',
          }),
          sourceText: expect.stringContaining('All officers shall be unarmed'),
        }),
      );
      expect(governance.evaluateSafety).toHaveBeenCalled();
      expect(prisma.rfpRequirementAnalysis.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: TENANT_A,
            rfpId: 'rfp-1',
            summary: ANALYSIS_DRAFT.summary,
            fallbackUsed: false,
            modelUsed: 'gemini-2.5-flash',
            safetyStatus: 'passed',
            createdBy: 'admin-a',
          }),
        }),
      );
      expect(result.id).toBe('ana-1');
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ entityType: 'RfpRequirementAnalysis' }),
      );
    });

    it('records modelUsed=structured-fallback when the AI returned its deterministic fallback', async () => {
      prisma.rfp.findFirst.mockResolvedValue(RFP_A);
      ai.analyzeSecurityRfp.mockResolvedValue({ ...ANALYSIS_DRAFT, fallbackUsed: true });

      await service.analyzeRequirements(TENANT_A, user.sub, 'rfp-1');

      expect(prisma.rfpRequirementAnalysis.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ fallbackUsed: true, modelUsed: 'structured-fallback' }),
        }),
      );
    });

    it('rejects a cross-tenant RFP and never calls the AI or writes a record', async () => {
      prisma.rfp.findFirst.mockResolvedValue(null);

      await expect(
        service.analyzeRequirements('tenant-b', user.sub, 'rfp-1'),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(ai.analyzeSecurityRfp).not.toHaveBeenCalled();
      expect(prisma.rfpRequirementAnalysis.create).not.toHaveBeenCalled();
    });

    it('does not persist an analysis when AI extraction fails', async () => {
      prisma.rfp.findFirst.mockResolvedValue(RFP_A);
      ai.analyzeSecurityRfp.mockRejectedValue(new Error('AI down'));

      await expect(
        service.analyzeRequirements(TENANT_A, user.sub, 'rfp-1'),
      ).rejects.toThrow('AI down');
      expect(prisma.rfpRequirementAnalysis.create).not.toHaveBeenCalled();
    });
  });

  describe('generateProposalFromRfp', () => {
    it('feeds the extracted requirements into proposal generation and creates a DRAFT proposal', async () => {
      prisma.rfp.findFirst.mockResolvedValue(RFP_A);
      prisma.rfpRequirementAnalysis.findFirst.mockResolvedValue({
        id: 'ana-1',
        summary: ANALYSIS_DRAFT.summary,
        requirements: ANALYSIS_DRAFT.requirements,
        missingInformation: ANALYSIS_DRAFT.missingInformation,
        fallbackUsed: false,
      });

      const result = await service.generateProposalFromRfp(TENANT_A, user.sub, 'rfp-1', {});

      expect(ai.generateProposalFromRfp).toHaveBeenCalledWith(
        expect.objectContaining({
          analysis: expect.objectContaining({
            requirements: ANALYSIS_DRAFT.requirements,
            missingInformation: ['Background check standard'],
          }),
          capabilities: expect.stringContaining('Acme Security'),
        }),
      );
      expect(proposals.create).toHaveBeenCalledWith(
        TENANT_A,
        expect.objectContaining({ status: 'draft', title: 'Proposal - Unarmed Guard Services' }),
        'admin-a',
      );
      expect(result.proposal.status).toBe('draft');
      // Phase 1 placeholder protection: the unresolved [placeholders] are surfaced
      expect(result.unresolvedPlaceholders).toEqual(
        expect.arrayContaining(['[Insert general liability limit]', '[Confirm number of officers]']),
      );
    });

    it('runs the analysis first when none exists yet', async () => {
      prisma.rfp.findFirst.mockResolvedValue(RFP_A);
      prisma.rfpRequirementAnalysis.findFirst.mockResolvedValue(null);

      await service.generateProposalFromRfp(TENANT_A, user.sub, 'rfp-1', {});

      expect(ai.analyzeSecurityRfp).toHaveBeenCalled();
      expect(prisma.rfpRequirementAnalysis.create).toHaveBeenCalled();
      expect(proposals.create).toHaveBeenCalled();
    });

    it('rejects cross-tenant proposal generation and never creates a proposal', async () => {
      prisma.rfp.findFirst.mockResolvedValue(null);

      await expect(
        service.generateProposalFromRfp('tenant-b', user.sub, 'rfp-1', {}),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(ai.generateProposalFromRfp).not.toHaveBeenCalled();
      expect(proposals.create).not.toHaveBeenCalled();
    });
  });

  describe('getLatestRequirementAnalysis', () => {
    it('rejects a cross-tenant RFP', async () => {
      prisma.rfp.findFirst.mockResolvedValue(null);
      await expect(
        service.getLatestRequirementAnalysis('tenant-b', 'rfp-1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
