import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ActivitiesService } from '../activities/activities.service';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  ActionableRecommendation,
  RecommendationActionDraft,
  RecommendationActionStatus,
  RecommendationActionType,
  RecommendationTargetModule,
  RECOMMENDATION_ACTION_STATUSES,
} from './ai-actions.types';

type RecommendationActionRecord = Awaited<
  ReturnType<PrismaService['recommendationAction']['findFirst']>
>;

@Injectable()
export class AiActionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly activitiesService: ActivitiesService,
  ) {}

  async syncFromRecommendations(
    tenantId: string,
    recommendations: ActionableRecommendation[],
    userId?: string,
  ) {
    const drafts = recommendations.map((recommendation) =>
      this.toActionDraft(recommendation),
    );
    const actions: NonNullable<RecommendationActionRecord>[] = [];

    for (const draft of drafts) {
      const existing = await this.prisma.recommendationAction.findFirst({
        where: {
          tenantId,
          recommendationId: draft.recommendationId,
        },
      });

      if (existing) {
        if (existing.status === 'pending' || existing.status === 'failed') {
          actions.push(
            await this.prisma.recommendationAction.update({
              where: { id: existing.id },
              data: {
                actionType: draft.actionType,
                title: draft.title,
                description: draft.description,
                targetModule: draft.targetModule,
                targetEntityId: draft.targetEntityId ?? null,
                failureReason:
                  existing.status === 'failed' ? existing.failureReason : null,
              },
            }),
          );
        } else {
          actions.push(existing);
        }
        continue;
      }

      const created = await this.prisma.recommendationAction.create({
        data: {
          tenantId,
          recommendationId: draft.recommendationId,
          actionType: draft.actionType,
          title: draft.title,
          description: draft.description,
          targetModule: draft.targetModule,
          targetEntityId: draft.targetEntityId ?? null,
        },
      });
      actions.push(created);

      await this.auditService.log({
        tenantId,
        userId,
        action: 'AI_ACTION_CREATED',
        entityType: 'RecommendationAction',
        entityId: created.id,
        details: `${created.actionType}: ${created.title}`,
      });
    }

    return actions;
  }

  async findAll(tenantId: string, status?: string) {
    const normalizedStatus = this.normalizeStatus(status);
    const actions = await this.prisma.recommendationAction.findMany({
      where: {
        tenantId,
        ...(normalizedStatus ? { status: normalizedStatus } : {}),
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });

    return {
      generatedAt: new Date().toISOString(),
      summary: this.buildSummary(actions),
      actions,
    };
  }

  async findOne(id: string, tenantId: string) {
    const action = await this.findAction(id, tenantId);
    return action;
  }

  async approve(id: string, tenantId: string, userId: string) {
    const action = await this.findAction(id, tenantId);

    if (action.status === 'approved') return action;
    if (!['pending', 'failed'].includes(action.status)) {
      throw new BadRequestException(
        `Only pending or failed actions can be approved. Current status: ${action.status}`,
      );
    }

    const approved = await this.prisma.recommendationAction.update({
      where: { id },
      data: {
        status: 'approved',
        approvedBy: userId,
        approvedAt: new Date(),
        failureReason: null,
      },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'AI_ACTION_APPROVED',
      entityType: 'RecommendationAction',
      entityId: id,
      details: approved.title,
    });

    return approved;
  }

  async reject(id: string, tenantId: string, userId: string) {
    const action = await this.findAction(id, tenantId);

    if (action.status === 'rejected') return action;
    if (action.status === 'executed') {
      throw new BadRequestException('Executed actions cannot be rejected.');
    }

    const rejected = await this.prisma.recommendationAction.update({
      where: { id },
      data: {
        status: 'rejected',
        failureReason: null,
      },
    });

    await this.auditService.log({
      tenantId,
      userId,
      action: 'AI_ACTION_REJECTED',
      entityType: 'RecommendationAction',
      entityId: id,
      details: rejected.title,
    });

    return rejected;
  }

  async execute(id: string, tenantId: string, userId: string) {
    const action = await this.findAction(id, tenantId);

    if (action.status === 'executed') return action;
    if (action.status !== 'approved') {
      throw new BadRequestException(
        `Only approved actions can be executed. Current status: ${action.status}`,
      );
    }

    try {
      await this.ensureTargetBelongsToTenant(action, tenantId);
      const result = await this.executeApprovedAction(action, tenantId, userId);

      const executed = await this.prisma.recommendationAction.update({
        where: { id },
        data: {
          status: 'executed',
          executedAt: new Date(),
          failureReason: null,
        },
      });

      await this.auditService.log({
        tenantId,
        userId,
        action: 'AI_ACTION_EXECUTED',
        entityType: 'RecommendationAction',
        entityId: id,
        details: `${action.actionType}: ${result}`,
      });

      return executed;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Action execution failed';

      const failed = await this.prisma.recommendationAction.update({
        where: { id },
        data: {
          status: 'failed',
          failureReason: message,
        },
      });

      await this.auditService.log({
        tenantId,
        userId,
        action: 'AI_ACTION_FAILED',
        entityType: 'RecommendationAction',
        entityId: id,
        details: message,
      });

      return failed;
    }
  }

  private async findAction(id: string, tenantId: string) {
    const action = await this.prisma.recommendationAction.findFirst({
      where: { id, tenantId },
    });

    if (!action) {
      throw new NotFoundException('AI action not found');
    }

    return action;
  }

  private async executeApprovedAction(
    action: NonNullable<RecommendationActionRecord>,
    tenantId: string,
    userId: string,
  ) {
    const subject = this.executionSubject(action);
    const description = this.executionDescription(action);
    const dueDate = this.dueDateFor(action.actionType);

    const activity = await this.activitiesService.create({
      type: this.activityTypeFor(action.actionType),
      subject,
      description,
      dueDate,
      tenantId,
      userId,
    });

    return `Created activity ${activity.id}`;
  }

  private async ensureTargetBelongsToTenant(
    action: NonNullable<RecommendationActionRecord>,
    tenantId: string,
  ) {
    if (!action.targetEntityId) return;

    const where = { id: action.targetEntityId, tenantId };
    let exists = true;

    switch (action.targetModule) {
      case 'client':
        exists = Boolean(await this.prisma.client.findFirst({ where }));
        break;
      case 'site':
        exists = Boolean(await this.prisma.site.findFirst({ where }));
        break;
      case 'guard':
        exists = Boolean(await this.prisma.guard.findFirst({ where }));
        break;
      case 'shift':
        exists = Boolean(await this.prisma.shift.findFirst({ where }));
        break;
      case 'invoice':
        exists = Boolean(await this.prisma.invoice.findFirst({ where }));
        break;
      default:
        exists = true;
    }

    if (!exists) {
      throw new NotFoundException('Target entity not found for this tenant');
    }
  }

  private toActionDraft(
    recommendation: ActionableRecommendation,
  ): RecommendationActionDraft {
    const actionType =
      recommendation.actionType ?? this.inferActionType(recommendation);
    const targetModule =
      recommendation.targetModule ?? this.inferTargetModule(recommendation);

    return {
      recommendationId: recommendation.id,
      actionType,
      title: recommendation.title,
      description: `${recommendation.action}\n\nReason: ${recommendation.reason}`,
      targetModule,
      targetEntityId: recommendation.targetEntityId ?? null,
    };
  }

  private inferActionType(
    recommendation: ActionableRecommendation,
  ): RecommendationActionType {
    if (recommendation.source === 'ai' && !recommendation.targetEntityId) {
      return 'notify_admin';
    }

    switch (recommendation.category) {
      case 'billing':
      case 'revenue':
        return 'create_invoice_followup';
      case 'clients':
      case 'contracts':
      case 'renewals':
        return 'flag_client_risk';
      case 'sites':
      case 'incidents':
        return 'flag_site_risk';
      case 'guards':
        return 'suggest_guard_reassignment';
      default:
        return 'create_follow_up_task';
    }
  }

  private inferTargetModule(
    recommendation: ActionableRecommendation,
  ): RecommendationTargetModule {
    switch (recommendation.category) {
      case 'clients':
      case 'contracts':
      case 'renewals':
        return 'client';
      case 'sites':
      case 'incidents':
        return 'site';
      case 'guards':
        return 'guard';
      case 'billing':
        return 'billing';
      case 'revenue':
        return 'revenue';
      default:
        return recommendation.source === 'ai' ? 'ai_insights' : 'operations';
    }
  }

  private executionSubject(action: NonNullable<RecommendationActionRecord>) {
    switch (action.actionType) {
      case 'notify_admin':
        return `AI notification: ${action.title}`;
      case 'flag_client_risk':
        return `Client risk flag: ${action.title}`;
      case 'flag_site_risk':
        return `Site risk flag: ${action.title}`;
      case 'suggest_guard_reassignment':
        return `Guard reassignment review: ${action.title}`;
      case 'create_invoice_followup':
        return `Invoice follow-up: ${action.title}`;
      default:
        return `AI follow-up: ${action.title}`;
    }
  }

  private executionDescription(action: NonNullable<RecommendationActionRecord>) {
    return [
      action.description,
      '',
      `AI action type: ${action.actionType}`,
      `Target: ${action.targetModule}${
        action.targetEntityId ? `/${action.targetEntityId}` : ''
      }`,
      'Execution is non-destructive: no guard assignments, invoices, proposals, or records were changed automatically.',
    ].join('\n');
  }

  private activityTypeFor(actionType: string) {
    switch (actionType) {
      case 'notify_admin':
        return 'notification';
      case 'flag_client_risk':
      case 'flag_site_risk':
        return 'risk_flag';
      case 'create_invoice_followup':
        return 'follow_up';
      default:
        return 'task';
    }
  }

  private dueDateFor(actionType: string) {
    if (actionType === 'notify_admin') return undefined;

    const dueDate = new Date();
    dueDate.setUTCDate(
      dueDate.getUTCDate() + (actionType === 'create_invoice_followup' ? 3 : 2),
    );
    return dueDate;
  }

  private normalizeStatus(status?: string): RecommendationActionStatus | null {
    if (!status) return null;
    if (
      RECOMMENDATION_ACTION_STATUSES.includes(
        status as RecommendationActionStatus,
      )
    ) {
      return status as RecommendationActionStatus;
    }

    throw new BadRequestException(`Unsupported AI action status: ${status}`);
  }

  private buildSummary(actions: Array<{ status: string }>) {
    return RECOMMENDATION_ACTION_STATUSES.reduce(
      (summary, status) => ({
        ...summary,
        [status]: actions.filter((action) => action.status === status).length,
      }),
      {} as Record<RecommendationActionStatus, number>,
    );
  }
}
