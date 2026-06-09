import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GenerateProposalDto } from './dto/generate-proposal.dto';
import { Lead } from '@prisma/client';

export interface AiProposalDraftResponse {
  draft: string | null;
}

export interface AiRevenueRecommendationDraft {
  title: string;
  action: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
}

export interface AiSalesAssessmentDraft {
  leadScore: number;
  priorityTier: 'high' | 'medium' | 'low';
  closeReadinessScore: number;
  discoveryQualityScore: number;
  riskProfile: string;
  proposalAngle: string;
  recommendedNextAction: string;
  missingQuestions: string[];
  objectionRisks: string[];
  summary: string;
}

export interface AiDiscoveryGuideDraft {
  questions: string[];
  talkingPoints: string[];
  followUpAngles: string[];
  qualificationChecklist: string[];
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly fallbackEnabled: boolean;
  private readonly modelName: string;
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;

  constructor(private configService: ConfigService) {
    this.modelName =
      this.configService.get<string>('GEMINI_MODEL')?.trim() ||
      'gemini-2.5-flash';
    this.fallbackEnabled =
      this.configService.get<string>('ENABLE_AI_FALLBACK') === 'true';

    const apiKey = this.configService.get<string>('GEMINI_API_KEY')?.trim();
    if (!apiKey) {
      this.logger.warn(
        'GEMINI_API_KEY is missing. Gemini requests will fail unless fallback is explicitly enabled.',
      );
      return;
    }

    try {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ model: this.modelName });
      this.logger.log(`Gemini model initialized with ${this.modelName}`);
    } catch (error) {
      this.logger.error(
        'Failed to initialize Gemini AI',
        error instanceof Error ? error.stack : String(error),
      );
      this.genAI = null;
      this.model = null;
    }
  }

  private isAiAvailable(): boolean {
    return !!(this.genAI && this.model);
  }

  private getFallbackEnabled(): boolean {
    return this.fallbackEnabled;
  }

  getModelName(): string {
    return this.modelName;
  }

  private getUnavailableMessage(action: string): string {
    if (!this.isAiAvailable()) {
      return `GEMINI_API_KEY is missing or Gemini could not be initialized. ${action} requires a working Gemini configuration.`;
    }

    return `Failed to complete ${action} with Gemini. Check GEMINI_API_KEY and GEMINI_MODEL.`;
  }

  private renderPrompt(
    promptTemplate: string | null | undefined,
    variables: Record<string, string | number | null | undefined>,
  ) {
    if (!promptTemplate?.trim()) return null;

    return promptTemplate.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) =>
      String(variables[key] ?? ''),
    );
  }

  private parseJsonFromText<T>(rawText: string): T {
    const cleaned = rawText.replace(/```json|```/g, '').trim();

    try {
      return JSON.parse(cleaned) as T;
    } catch {
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start >= 0 && end > start) {
        return JSON.parse(cleaned.slice(start, end + 1)) as T;
      }

      throw new Error('AI response did not contain valid JSON.');
    }
  }

  private clampScore(value: unknown, fallback: number) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.max(0, Math.min(100, Math.round(numeric)));
  }

  private normalizeStringArray(value: unknown, fallback: string[] = []) {
    if (!Array.isArray(value)) return fallback;

    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 8);
  }

  private async generateText(
    prompt: string,
    action: string,
    fallbackFactory: () => string,
  ): Promise<string> {
    if (!this.isAiAvailable()) {
      if (this.getFallbackEnabled()) return fallbackFactory();
      throw new InternalServerErrorException(this.getUnavailableMessage(action));
    }

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().trim();

      if (!text) {
        throw new Error('Gemini returned an empty response.');
      }

      return text;
    } catch (error) {
      this.logger.error(
        `${action} failed`,
        error instanceof Error ? error.stack : String(error),
      );

      if (this.getFallbackEnabled()) return fallbackFactory();
      throw new InternalServerErrorException(this.getUnavailableMessage(action));
    }
  }

  async generateSalesAssessment(
    context: string,
  ): Promise<AiSalesAssessmentDraft> {
    const fallback = this.fallbackSalesAssessment();
    const prompt = `
      You are a security guard industry sales execution advisor.
      Analyze this tenant-scoped lead/deal context and return JSON only.

      CONTEXT:
      ${context}

      Return exactly this JSON shape:
      {
        "leadScore": 0,
        "priorityTier": "medium",
        "closeReadinessScore": 0,
        "discoveryQualityScore": 0,
        "riskProfile": "one concise security-risk summary",
        "proposalAngle": "how to frame value around risk reduction",
        "recommendedNextAction": "one concrete next action for the sales rep",
        "missingQuestions": ["question"],
        "objectionRisks": ["risk"],
        "summary": "one concise executive sales assessment"
      }

      Rules:
      - Scores must be 0-100.
      - priorityTier must be high, medium, or low.
      - Do not invent private personal data.
      - Focus on security risk, decision process, scope clarity, and sales momentum.
    `;

    const rawText = await this.generateText(
      prompt,
      'sales assessment generation',
      () => JSON.stringify(fallback),
    );

    try {
      const parsed = this.parseJsonFromText<Partial<AiSalesAssessmentDraft>>(rawText);
      const priorityTier =
        parsed.priorityTier === 'high' ||
        parsed.priorityTier === 'medium' ||
        parsed.priorityTier === 'low'
          ? parsed.priorityTier
          : fallback.priorityTier;

      return {
        leadScore: this.clampScore(parsed.leadScore, fallback.leadScore),
        priorityTier,
        closeReadinessScore: this.clampScore(
          parsed.closeReadinessScore,
          fallback.closeReadinessScore,
        ),
        discoveryQualityScore: this.clampScore(
          parsed.discoveryQualityScore,
          fallback.discoveryQualityScore,
        ),
        riskProfile:
          typeof parsed.riskProfile === 'string' && parsed.riskProfile.trim()
            ? parsed.riskProfile.trim()
            : fallback.riskProfile,
        proposalAngle:
          typeof parsed.proposalAngle === 'string' && parsed.proposalAngle.trim()
            ? parsed.proposalAngle.trim()
            : fallback.proposalAngle,
        recommendedNextAction:
          typeof parsed.recommendedNextAction === 'string' &&
          parsed.recommendedNextAction.trim()
            ? parsed.recommendedNextAction.trim()
            : fallback.recommendedNextAction,
        missingQuestions: this.normalizeStringArray(
          parsed.missingQuestions,
          fallback.missingQuestions,
        ),
        objectionRisks: this.normalizeStringArray(
          parsed.objectionRisks,
          fallback.objectionRisks,
        ),
        summary:
          typeof parsed.summary === 'string' && parsed.summary.trim()
            ? parsed.summary.trim()
            : fallback.summary,
      };
    } catch (error) {
      this.logger.warn(
        `Sales assessment JSON parsing failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return fallback;
    }
  }

  async generateDiscoveryGuide(context: string): Promise<AiDiscoveryGuideDraft> {
    const fallback = this.fallbackDiscoveryGuide();
    const prompt = `
      You are coaching a security guard sales rep before a discovery call.
      Use only this lead/deal context:
      ${context}

      Return JSON only in this exact shape:
      {
        "questions": ["specific discovery question"],
        "talkingPoints": ["security-specific talking point"],
        "followUpAngles": ["follow-up angle"],
        "qualificationChecklist": ["qualification item"]
      }

      Keep the guidance specific to contract security guard services.
      Focus on risk, property exposure, operating hours, incident history, decision makers, timeline, and scope.
    `;

    const rawText = await this.generateText(
      prompt,
      'discovery guide generation',
      () => JSON.stringify(fallback),
    );

    try {
      const parsed = this.parseJsonFromText<Partial<AiDiscoveryGuideDraft>>(rawText);

      return {
        questions: this.normalizeStringArray(parsed.questions, fallback.questions),
        talkingPoints: this.normalizeStringArray(
          parsed.talkingPoints,
          fallback.talkingPoints,
        ),
        followUpAngles: this.normalizeStringArray(
          parsed.followUpAngles,
          fallback.followUpAngles,
        ),
        qualificationChecklist: this.normalizeStringArray(
          parsed.qualificationChecklist,
          fallback.qualificationChecklist,
        ),
      };
    } catch (error) {
      this.logger.warn(
        `Discovery guide JSON parsing failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return fallback;
    }
  }

  async generateDiscoveryProposal(context: string): Promise<string> {
    const prompt = `
      You are a senior security consultant writing a proposal for contract security guard services.
      Use this discovery context:
      ${context}

      Write a professional proposal in Markdown with:
      # Security Services Proposal
      ## Executive Summary
      ## Risk Profile
      ## Recommended Scope
      ## Staffing and Deployment Approach
      ## Operational Controls
      ## Value Justification
      ## Next Steps

      Requirements:
      - Frame the service around risk reduction, continuity, and accountability.
      - Tie recommendations to the discovery details.
      - Avoid invented pricing.
      - Keep it concise and client-ready.
    `;

    return this.generateText(
      prompt,
      'discovery-based proposal generation',
      () => this.fallbackDiscoveryProposal(),
    );
  }

  async generateProposalDraft(
    dto: GenerateProposalDto,
  ): Promise<AiProposalDraftResponse> {
    const prompt = `
      You are a senior security consultant. Generate a professional security services proposal based on these details:
      
      Client/Site Name: ${dto.siteName}
      Required Guards: ${dto.guardCount}
      Core Requirements: ${dto.requirements}
      Additional Context: ${dto.additionalNotes || 'None'}

      The proposal MUST follow this structure:
      # Proposal for ${dto.siteName}
      
      ## 1. Executive Summary
      (Brief overview of the security solution)
      
      ## 2. Scope of Work
      (Detail specific security tasks based on requirements)
      
      ## 3. Staffing & Deployment
      (Explain how ${dto.guardCount} guards will be utilized)
      
      ## 4. Operational Strategy
      (Describe the approach to safety and deterrence)
      
      ## 5. Pricing & Terms
      (Placeholder for pricing assumptions)

      Use professional, persuasive language. Format with Markdown.
    `;

    const draft = await this.generateText(
      prompt,
      'proposal draft generation',
      () => this.fallbackProposalDraft(dto).draft ?? '',
    );

    return { draft };
  }

  async generateForLead(
    lead: Lead & { notes?: any[]; deals?: any[] },
  ): Promise<string> {
    const context = `
      Lead Name: ${lead.name}
      Company: ${lead.company}
      Current Status: ${lead.status}
      Notes: ${lead.notes?.map((n) => n.content).join('; ') || 'No notes available'}
      Related Deals: ${lead.deals?.map((d) => d.name).join(', ') || 'No specific deals'}
    `;

    const prompt = `
      Generate a professional security services proposal for a new lead.
      
      CONTEXT:
      ${context}

      STRUCTURE:
      1. Executive Introduction
      2. Threat Landscape & Risk Analysis (specific to ${lead.company})
      3. Operational Strategy
      4. Recommended Service Tiers
      5. Value Proposition

      Format the output in clean Markdown. Start with a Title: # Security Services Proposal - ${lead.company}
    `;

    return this.generateText(
      prompt,
      `proposal generation for lead ${lead.id}`,
      () => this.fallbackLeadProposal(lead),
    );
  }

  async generateEmailDraft(subject: string, context: string): Promise<string> {
    const prompt = `
      Write a professional follow-up email.
      Subject: ${subject}
      Context/Details: ${context}
      
      The email should be concise, professional, and encourage the client to secure their assets.
    `;

    return this.generateText(
      prompt,
      'email draft generation',
      () => this.fallbackEmailDraft(subject, context),
    );
  }

  async summarizeNotes(notes: string[]): Promise<string> {
    const prompt = `Summarize these security site visit notes into key takeaways and action items: ${notes.join(
      '\n',
    )}`;

    return this.generateText(
      prompt,
      'notes summarization',
      () => this.fallbackSummarizeNotes(notes),
    );
  }

  async generateBusinessInsightRecommendations(
    context: string,
    promptTemplate?: string | null,
  ): Promise<string[] | null> {
    if (!this.isAiAvailable()) {
      return null;
    }

    const prompt = this.renderPrompt(promptTemplate, { context }) || `
      You are analyzing tenant-scoped security operations data for an admin dashboard.
      Use only this aggregated context:
      ${context}

      Return JSON only in this exact shape:
      {"recommendations":["action 1","action 2","action 3"]}

      Keep each action concise, operational, and specific. Do not mention tenant IDs, user IDs, emails, or raw database fields.
    `;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const rawText = response.text().replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(rawText) as { recommendations?: unknown };

      if (!Array.isArray(parsed.recommendations)) {
        return null;
      }

      return parsed.recommendations
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 5);
    } catch (error) {
      this.logger.warn(
        `Business insight recommendation generation failed: ${error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  async generateIncidentRiskSummary(
    context: string,
    promptTemplate?: string | null,
  ): Promise<string | null> {
    if (!this.isAiAvailable()) {
      return null;
    }

    const prompt = this.renderPrompt(promptTemplate, { context }) || `
      You are analyzing tenant-scoped security incident risk for an operations admin.
      Use only this aggregated incident context:
      ${context}

      Return one concise paragraph with the key incident trends, riskiest locations or people, and the most important next action.
      Do not mention tenant IDs, user IDs, emails, phone numbers, raw database fields, or implementation details.
    `;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().replace(/```/g, '').trim();
      return text || null;
    } catch (error) {
      this.logger.warn(
        `Incident risk summary generation failed: ${error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  async generateRevenueIntelligenceSummary(
    context: string,
    promptTemplate?: string | null,
  ): Promise<string | null> {
    if (!this.isAiAvailable()) {
      return null;
    }

    const prompt = this.renderPrompt(promptTemplate, { context }) || `
      You are analyzing tenant-scoped security services revenue, contracts, renewals, invoice collections, and client value.
      Use only this aggregated financial context:
      ${context}

      Return one concise executive paragraph with:
      - next-month revenue forecast
      - expected growth or decline
      - the most important contract or renewal risk
      - the most important finance action

      Do not mention tenant IDs, user IDs, emails, phone numbers, raw database fields, or implementation details.
    `;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().replace(/```/g, '').trim();
      return text || null;
    } catch (error) {
      this.logger.warn(
        `Revenue intelligence summary generation failed: ${error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  async generateRevenueFinancialRecommendations(
    context: string,
    promptTemplate?: string | null,
  ): Promise<AiRevenueRecommendationDraft[] | null> {
    if (!this.isAiAvailable()) {
      return null;
    }

    const prompt = this.renderPrompt(promptTemplate, { context }) || `
      You are a senior finance and operations advisor for a security services SaaS platform.
      Use only this aggregated tenant-scoped financial context:
      ${context}

      Return JSON only in this exact shape:
      {
        "recommendations": [
          {
            "title": "short title",
            "action": "specific action",
            "reason": "brief reason using the aggregate metrics",
            "priority": "high"
          }
        ]
      }

      Priority must be one of: high, medium, low.
      Keep each action concise and specific. Do not mention tenant IDs, user IDs, emails, phone numbers, raw database fields, or implementation details.
    `;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const rawText = response.text().replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(rawText) as {
        recommendations?: Array<Partial<AiRevenueRecommendationDraft>>;
      };

      if (!Array.isArray(parsed.recommendations)) {
        return null;
      }

      return parsed.recommendations
        .map((item) => ({
          title: typeof item.title === 'string' ? item.title.trim() : '',
          action: typeof item.action === 'string' ? item.action.trim() : '',
          reason: typeof item.reason === 'string' ? item.reason.trim() : '',
          priority:
            item.priority === 'high' ||
              item.priority === 'medium' ||
              item.priority === 'low'
              ? item.priority
              : 'medium',
        }))
        .filter((item) => item.title && item.action && item.reason)
        .slice(0, 5);
    } catch (error) {
      this.logger.warn(
        `Revenue recommendation generation failed: ${error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  async explainGuardRecommendation(
    context: string,
    promptTemplate?: string | null,
  ): Promise<string | null> {
    if (!this.isAiAvailable()) {
      return null;
    }

    const prompt = this.renderPrompt(promptTemplate, { context }) || `
      Explain this guard recommendation to a security operations admin.
      Use only this aggregated scheduling context:
      ${context}

      Return one concise sentence. Mention the guard by name. Do not mention tenant IDs, user IDs, emails, or raw database fields.
    `;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().replace(/```/g, '').trim();
      return text || null;
    } catch (error) {
      this.logger.warn(
        `Guard recommendation explanation failed: ${error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  async generateCopilotAnswer(context: string): Promise<string | null> {
    if (!this.isAiAvailable()) {
      return null;
    }

    const prompt = `
      You are an AI copilot for a tenant-scoped security operations SaaS platform.
      Answer the admin or finance user's question using only this structured context:
      ${context}

      Requirements:
      - Be concise and specific.
      - Include concrete names, counts, amounts, and dates when present.
      - Do not invent records or cite data that is not in the context.
      - Do not mention tenant IDs, user IDs, raw database fields, API names, or implementation details.
      - If the structured result already answers the question, preserve its meaning.
    `;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text().replace(/```/g, '').trim();
      return text || null;
    } catch (error) {
      this.logger.warn(
        `Copilot answer generation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  private fallbackProposalDraft(
    dto: GenerateProposalDto,
    reason?: string,
  ): AiProposalDraftResponse {
    return {
      draft: `
# Security Proposal for ${dto.siteName} (Fallback)
${reason ? `**Reason**: ${reason}\n` : ''}**Proposed Guards**: ${dto.guardCount}
**Key Requirements**: ${dto.requirements}

## 1. Executive Summary
This proposal outlines a standard security framework for ${dto.siteName}.

## 2. Security Strategy
Deployment focuses on ${dto.requirements}.

## 3. Deployment
Recommended staffing: ${dto.guardCount} personnel.
      `.trim(),
    };
  }

  private fallbackLeadProposal(lead: Lead, reason?: string): string {
    return `
# Security Services Proposal - ${lead.company} (Fallback)
For: ${lead.name} - ${lead.company}
${reason ? `**Reason**: ${reason}\n` : ''}

## 1. Executive Introduction
Thank you for considering our services for ${lead.company}.

## 2. Risk Analysis
Based on your status (${lead.status}), we recommend a baseline security audit.

## 3. Operational Strategy
Custom deployment tailored for ${lead.company}.
    `.trim();
  }

  private fallbackEmailDraft(subject: string, context: string): string {
    return `Subject: Follow up: ${subject}\n\nHi,\n\nFollowing up on our discussion regarding ${context}.\n\nBest regards.`;
  }

  private fallbackSummarizeNotes(notes: string[]): string {
    return `**Summary:**\n- ${notes.join('\n- ')}`;
  }

  private fallbackSalesAssessment(): AiSalesAssessmentDraft {
    return {
      leadScore: 55,
      priorityTier: 'medium',
      closeReadinessScore: 45,
      discoveryQualityScore: 40,
      riskProfile:
        'Discovery is still incomplete, so the risk profile should be validated before proposal.',
      proposalAngle:
        'Frame the service around reducing site risk and creating accountable coverage rather than selling guard hours.',
      recommendedNextAction:
        'Complete discovery around property risk, decision timeline, current provider, and required coverage.',
      missingQuestions: [
        'What incidents or risks triggered the security review?',
        'Who approves the final service scope and budget?',
        'What coverage hours and guard count are required?',
      ],
      objectionRisks: ['Price pressure may appear if risk and scope are not clearly established.'],
      summary:
        'The opportunity has usable early signals, but needs stronger discovery before a confident proposal.',
    };
  }

  private fallbackDiscoveryGuide(): AiDiscoveryGuideDraft {
    return {
      questions: [
        'What recent incidents, complaints, or liability concerns caused this security review?',
        'Which areas, shifts, or access points create the highest exposure?',
        'Who is involved in approving the final scope and timeline?',
        'What would make this security program successful after the first 90 days?',
      ],
      talkingPoints: [
        'Position coverage as risk reduction, not just guard labor.',
        'Connect staffing recommendations to property exposure and operating hours.',
        'Clarify how reporting and accountability will reduce management workload.',
      ],
      followUpAngles: [
        'Offer a site walkthrough to validate coverage assumptions.',
        'Send a risk-framed proposal tied to the buyer priorities captured on the call.',
      ],
      qualificationChecklist: [
        'Decision maker identified',
        'Coverage hours confirmed',
        'Primary risks documented',
        'Timeline and approval process confirmed',
      ],
    };
  }

  private fallbackDiscoveryProposal(): string {
    return `
# Security Services Proposal

## Executive Summary
This proposal outlines a risk-focused security guard program based on the discovery information captured so far.

## Risk Profile
The current opportunity requires validation of site exposure, operating hours, incident history, and decision timeline.

## Recommended Scope
We recommend confirming post orders, coverage windows, guard count, reporting expectations, and escalation procedures before final pricing.

## Staffing and Deployment Approach
Deployment should match the property's highest-risk hours and locations, with clear accountability for patrols, access control, and incident reporting.

## Operational Controls
The program should include supervisor oversight, daily reporting, incident escalation, and regular client review points.

## Value Justification
The value should be framed around reduced liability, improved visibility, and consistent coverage rather than guard hours alone.

## Next Steps
Complete discovery, confirm scope, and finalize a proposal aligned to the client's risk priorities.
    `.trim();
  }

  async extractLeadFromText(
    text: string,
  ): Promise<{ name: string; company: string; email: string }> {
    const prompt = `Extract JSON with {name, company, email} from this text: "${text}". Only return JSON.`;

    if (!this.isAiAvailable()) {
      if (this.getFallbackEnabled()) {
        return {
          name: 'Extracted Name',
          company: 'Extracted Company',
          email: 'client@example.com',
        };
      }

      throw new InternalServerErrorException(
        this.getUnavailableMessage('lead extraction'),
      );
    }

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const rawText = response.text().replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(rawText) as {
        name?: string;
        company?: string;
        email?: string;
      };

      return {
        name: parsed.name || 'N/A',
        company: parsed.company || 'N/A',
        email: parsed.email || 'N/A',
      };
    } catch (error) {
      this.logger.error(
        'Lead extraction failed',
        error instanceof Error ? error.stack : String(error),
      );

      if (this.getFallbackEnabled()) {
        return { name: 'N/A', company: 'N/A', email: 'N/A' };
      }

      throw new InternalServerErrorException(
        this.getUnavailableMessage('lead extraction'),
      );
    }
  }
}
