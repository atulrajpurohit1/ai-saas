import { BadRequestException } from '@nestjs/common';
import { ActivitiesService } from '../activities/activities.service';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { AiActionsService } from './ai-actions.service';

describe('AiActionsService', () => {
  let service: AiActionsService;
  let actions: any[];
  let prisma: any;
  let auditService: { log: jest.Mock };
  let activitiesService: { create: jest.Mock };

  const tenantId = 'tenant-1';
  const userId = 'admin-1';

  beforeEach(() => {
    actions = [];
    prisma = {
      recommendationAction: {
        findFirst: jest.fn(async ({ where }: any) =>
          actions.find((action) =>
            Object.entries(where).every(([key, value]) => action[key] === value),
          ) ?? null,
        ),
        findMany: jest.fn(async ({ where }: any) =>
          actions.filter((action) =>
            Object.entries(where).every(([key, value]) => action[key] === value),
          ),
        ),
        create: jest.fn(async ({ data }: any) => {
          const action = {
            id: `action-${actions.length + 1}`,
            status: 'pending',
            createdAt: new Date('2026-06-01T00:00:00.000Z'),
            approvedBy: null,
            approvedAt: null,
            executedAt: null,
            failureReason: null,
            ...data,
          };
          actions.push(action);
          return action;
        }),
        update: jest.fn(async ({ where, data }: any) => {
          const action = actions.find((item) => item.id === where.id);
          Object.assign(action, data);
          return action;
        }),
      },
      client: { findFirst: jest.fn().mockResolvedValue({ id: 'client-1' }) },
      site: { findFirst: jest.fn().mockResolvedValue({ id: 'site-1' }) },
      guard: { findFirst: jest.fn().mockResolvedValue({ id: 'guard-1' }) },
      shift: { findFirst: jest.fn().mockResolvedValue({ id: 'shift-1' }) },
      invoice: { findFirst: jest.fn().mockResolvedValue({ id: 'invoice-1' }) },
    };
    auditService = { log: jest.fn().mockResolvedValue(undefined) };
    activitiesService = {
      create: jest.fn().mockResolvedValue({ id: 'activity-1' }),
    };

    service = new AiActionsService(
      prisma as PrismaService,
      auditService as unknown as AuditService,
      activitiesService as unknown as ActivitiesService,
    );
  });

  it('creates tenant-scoped pending actions from rule-based recommendations', async () => {
    await service.syncFromRecommendations(
      tenantId,
      [
        {
          id: 'rule-billing-follow-up',
          category: 'billing',
          priority: 'high',
          title: 'Follow up unpaid invoices',
          action: 'Follow up with Client A on unpaid invoices.',
          reason: 'Client A has $1,000 outstanding.',
          source: 'rule',
          targetModule: 'client',
          targetEntityId: 'client-1',
        },
      ],
      userId,
    );

    expect(actions[0]).toEqual(
      expect.objectContaining({
        tenantId,
        recommendationId: 'rule-billing-follow-up',
        actionType: 'create_invoice_followup',
        status: 'pending',
        targetModule: 'client',
        targetEntityId: 'client-1',
      }),
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        userId,
        action: 'AI_ACTION_CREATED',
      }),
    );
  });

  it('approves and executes a safe action by creating an activity and audit log', async () => {
    const [action] = await service.syncFromRecommendations(
      tenantId,
      [
        {
          id: 'rule-client-risk',
          category: 'clients',
          priority: 'medium',
          title: 'Review client risk',
          action: 'Review contract coverage with Client A.',
          reason: 'Client A has incident reports.',
          source: 'rule',
          actionType: 'flag_client_risk',
          targetModule: 'client',
          targetEntityId: 'client-1',
        },
      ],
      userId,
    );

    await service.approve(action.id, tenantId, userId);
    const executed = await service.execute(action.id, tenantId, userId);

    expect(executed.status).toBe('executed');
    expect(activitiesService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId,
        userId,
        type: 'risk_flag',
        subject: 'Client risk flag: Review client risk',
      }),
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'AI_ACTION_EXECUTED',
        entityId: action.id,
      }),
    );
  });

  it('does not execute rejected actions', async () => {
    const [action] = await service.syncFromRecommendations(
      tenantId,
      [
        {
          id: 'rule-guard-review',
          category: 'guards',
          priority: 'medium',
          title: 'Review guard assignment',
          action: 'Review attendance with Guard A.',
          reason: 'Guard A missed shifts.',
          source: 'rule',
        },
      ],
      userId,
    );

    await service.reject(action.id, tenantId, userId);

    await expect(service.execute(action.id, tenantId, userId)).rejects.toThrow(
      BadRequestException,
    );
    expect(activitiesService.create).not.toHaveBeenCalled();
  });
});
