import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  AiApprovalStatus,
  AiSafetyFinding,
  AiSafetyResult,
  PromptUsageDefinition,
  ResolvedPromptVersion,
} from './ai-governance.types';

const DEFAULT_PROMPT_VERSION = 'v5-phase-7';

export const PROMPT_USAGE_REGISTRY: PromptUsageDefinition[] = [
  {
    moduleName: 'ai_insights.dashboard',
    promptKey: 'business_recommendations',
    label: 'AI Insights',
    description:
      'Operational recommendations for clients, guards, sites, and billing.',
    defaultVersion: DEFAULT_PROMPT_VERSION,
  },
  {
    moduleName: 'ai_insights.incident_risk',
    promptKey: 'incident_risk_summary',
    label: 'Incident Risk Analysis',
    description:
      'Incident trends, high-risk sites, client risk, and guard risk summaries.',
    defaultVersion: DEFAULT_PROMPT_VERSION,
  },
  {
    moduleName: 'ai_insights.revenue',
    promptKey: 'revenue_summary',
    label: 'Revenue Forecasting',
    description:
      'Executive revenue, renewal, collections, and contract-risk summary.',
    defaultVersion: DEFAULT_PROMPT_VERSION,
  },
  {
    moduleName: 'ai_insights.revenue',
    promptKey: 'financial_recommendations',
    label: 'Revenue Recommendations',
    description:
      'Finance actions generated from forecasts, collections, renewals, and contract health.',
    defaultVersion: DEFAULT_PROMPT_VERSION,
  },
  {
    moduleName: 'ai_scheduling.guard_recommendations',
    promptKey: 'guard_recommendation_explanation',
    label: 'AI Smart Scheduling',
    description: 'Guard recommendation explanations for scheduling admins.',
    defaultVersion: DEFAULT_PROMPT_VERSION,
  },
];

/**
 * The prompt-registry admin UI (AI Prompts) and the audit-log admin UI
 * (AI Audit) were removed along with their controllers - out of approved
 * client scope. What's left here is exactly what AiMonitoringService needs
 * for every AI generation it logs (Sales Accelerator, etc.): resolving which
 * prompt version was active, running output safety checks, and deciding
 * whether client-visible output needs approval.
 */
@Injectable()
export class AiGovernanceService {
  constructor(private readonly prisma: PrismaService) {}

  async resolvePromptVersion(input: {
    tenantId: string;
    moduleName: string;
    promptKey?: string;
    fallbackVersion?: string;
  }): Promise<ResolvedPromptVersion> {
    const promptKey =
      input.promptKey ?? this.defaultPromptKeyFor(input.moduleName);
    const active = await this.prisma.promptVersion.findFirst({
      where: {
        tenantId: input.tenantId,
        moduleName: input.moduleName,
        promptKey,
        status: 'active',
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!active) {
      return {
        promptVersion:
          input.fallbackVersion ||
          this.defaultVersionFor(input.moduleName, promptKey),
        promptVersionId: null,
        promptText: null,
      };
    }

    return {
      promptVersion: active.version,
      promptVersionId: active.id,
      promptText: active.promptText,
    };
  }

  evaluateSafety(input: {
    generatedOutput: unknown;
    inputSource?: unknown;
    clientVisible?: boolean;
  }): AiSafetyResult {
    const text = this.stringifyTextValues(input.generatedOutput);
    const findings: AiSafetyFinding[] = [];

    if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(text)) {
      findings.push({
        rule: 'sensitive_data_leakage',
        severity: 'blocked',
        message: 'Output includes an email address.',
      });
    }

    if (/\b\d{3}-\d{2}-\d{4}\b/.test(text)) {
      findings.push({
        rule: 'sensitive_data_leakage',
        severity: 'blocked',
        message: 'Output includes a possible SSN.',
      });
    }

    if (/\b(?:\d[ -]*?){13,16}\b/.test(text)) {
      findings.push({
        rule: 'sensitive_data_leakage',
        severity: 'blocked',
        message: 'Output includes a possible payment card number.',
      });
    }

    if (/\b(?:\+?\d[\s.-]?){10,14}\b/.test(text)) {
      findings.push({
        rule: 'sensitive_data_leakage',
        severity: 'review_required',
        message: 'Output may include a phone number.',
      });
    }

    if (
      /\b(automatically|auto)\b.{0,40}\b(assign|terminate|fire|charge|refund|publish|execute|send)\b/i.test(
        text,
      )
    ) {
      findings.push({
        rule: 'unsafe_automation',
        severity: 'blocked',
        message:
          'Output appears to recommend unsafe automation without approval.',
      });
    }

    if (
      /\b(legal advice|tax advice|investment advice|guarantee(?:d)? returns?|legally binding)\b/i.test(
        text,
      )
    ) {
      findings.push({
        rule: 'unsupported_financial_or_legal_claim',
        severity: 'blocked',
        message:
          'Output includes unsupported legal or financial claim language.',
      });
    }

    if (
      input.clientVisible &&
      this.inputReferencesMultipleClients(input.inputSource)
    ) {
      findings.push({
        rule: 'client_cross_data_exposure',
        severity: 'review_required',
        message:
          'Client-visible output was generated from multiple client contexts.',
      });
    }

    const status = findings.some((item) => item.severity === 'blocked')
      ? 'blocked'
      : findings.length > 0
        ? 'review_required'
        : 'passed';

    return { status, findings };
  }

  approvalStatusFor(input: {
    clientVisible?: boolean;
    safetyStatus: AiSafetyResult['status'];
  }): AiApprovalStatus {
    if (input.safetyStatus === 'blocked') return 'blocked';
    return input.clientVisible ? 'pending' : 'not_required';
  }

  private defaultPromptKeyFor(moduleName: string) {
    return (
      PROMPT_USAGE_REGISTRY.find((item) => item.moduleName === moduleName)
        ?.promptKey ?? 'default'
    );
  }

  private defaultVersionFor(moduleName: string, promptKey: string) {
    return (
      PROMPT_USAGE_REGISTRY.find(
        (item) =>
          item.moduleName === moduleName && item.promptKey === promptKey,
      )?.defaultVersion ?? DEFAULT_PROMPT_VERSION
    );
  }

  private stringifyTextValues(value: unknown): string {
    const values: string[] = [];
    const visit = (item: unknown) => {
      if (typeof item === 'string') {
        values.push(item);
        return;
      }
      if (Array.isArray(item)) {
        item.forEach(visit);
        return;
      }
      if (item && typeof item === 'object') {
        Object.values(item as Record<string, unknown>).forEach(visit);
      }
    };

    visit(value);
    return values.join('\n');
  }

  private inputReferencesMultipleClients(value: unknown): boolean {
    if (!value || typeof value !== 'object') return false;
    const source = value as {
      clientIds?: unknown;
      clientId?: unknown;
      scope?: unknown;
    };

    return (
      (Array.isArray(source.clientIds) &&
        new Set(source.clientIds.filter(Boolean)).size > 1) ||
      source.scope === 'multi_client'
    );
  }
}
