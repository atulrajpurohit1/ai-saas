"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var AiService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const generative_ai_1 = require("@google/generative-ai");
let AiService = AiService_1 = class AiService {
    configService;
    logger = new common_1.Logger(AiService_1.name);
    fallbackEnabled;
    modelName;
    genAI = null;
    model = null;
    constructor(configService) {
        this.configService = configService;
        this.modelName =
            this.configService.get('GEMINI_MODEL')?.trim() ||
                'gemini-2.5-flash';
        this.fallbackEnabled =
            this.configService.get('ENABLE_AI_FALLBACK') === 'true';
        const apiKey = this.configService.get('GEMINI_API_KEY')?.trim();
        if (!apiKey) {
            this.logger.warn('GEMINI_API_KEY is missing. Gemini requests will fail unless fallback is explicitly enabled.');
            return;
        }
        try {
            this.genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
            this.model = this.genAI.getGenerativeModel({ model: this.modelName });
            this.logger.log(`Gemini model initialized with ${this.modelName}`);
        }
        catch (error) {
            this.logger.error('Failed to initialize Gemini AI', error instanceof Error ? error.stack : String(error));
            this.genAI = null;
            this.model = null;
        }
    }
    isAiAvailable() {
        return !!(this.genAI && this.model);
    }
    getFallbackEnabled() {
        return this.fallbackEnabled;
    }
    getModelName() {
        return this.modelName;
    }
    getUnavailableMessage(action) {
        if (!this.isAiAvailable()) {
            return `GEMINI_API_KEY is missing or Gemini could not be initialized. ${action} requires a working Gemini configuration.`;
        }
        return `Failed to complete ${action} with Gemini. Check GEMINI_API_KEY and GEMINI_MODEL.`;
    }
    renderPrompt(promptTemplate, variables) {
        if (!promptTemplate?.trim())
            return null;
        return promptTemplate.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => String(variables[key] ?? ''));
    }
    parseJsonFromText(rawText) {
        const cleaned = rawText.replace(/```json|```/g, '').trim();
        try {
            return JSON.parse(cleaned);
        }
        catch {
            const start = cleaned.indexOf('{');
            const end = cleaned.lastIndexOf('}');
            if (start >= 0 && end > start) {
                return JSON.parse(cleaned.slice(start, end + 1));
            }
            throw new Error('AI response did not contain valid JSON.');
        }
    }
    clampScore(value, fallback) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric))
            return fallback;
        return Math.max(0, Math.min(100, Math.round(numeric)));
    }
    normalizeOptionalString(value, fallback = null) {
        if (typeof value !== 'string')
            return fallback;
        const trimmed = value.trim();
        return trimmed || fallback;
    }
    normalizeOptionalNumber(value, fallback = null) {
        const numeric = Number(value);
        if (!Number.isFinite(numeric) || numeric <= 0)
            return fallback;
        return Math.round(numeric);
    }
    normalizeStringArray(value, fallback = []) {
        if (!Array.isArray(value))
            return fallback;
        return value
            .filter((item) => typeof item === 'string')
            .map((item) => item.trim())
            .filter(Boolean)
            .slice(0, 8);
    }
    async generateText(prompt, action, fallbackFactory) {
        if (!this.isAiAvailable()) {
            if (this.getFallbackEnabled())
                return fallbackFactory();
            throw new common_1.InternalServerErrorException(this.getUnavailableMessage(action));
        }
        try {
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text().trim();
            if (!text) {
                throw new Error('Gemini returned an empty response.');
            }
            return text;
        }
        catch (error) {
            this.logger.error(`${action} failed`, error instanceof Error ? error.stack : String(error));
            if (this.getFallbackEnabled())
                return fallbackFactory();
            throw new common_1.InternalServerErrorException(this.getUnavailableMessage(action));
        }
    }
    async generateSalesAssessment(context) {
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
        const rawText = await this.generateText(prompt, 'sales assessment generation', () => JSON.stringify(fallback));
        try {
            const parsed = this.parseJsonFromText(rawText);
            const priorityTier = parsed.priorityTier === 'high' ||
                parsed.priorityTier === 'medium' ||
                parsed.priorityTier === 'low'
                ? parsed.priorityTier
                : fallback.priorityTier;
            return {
                leadScore: this.clampScore(parsed.leadScore, fallback.leadScore),
                priorityTier,
                closeReadinessScore: this.clampScore(parsed.closeReadinessScore, fallback.closeReadinessScore),
                discoveryQualityScore: this.clampScore(parsed.discoveryQualityScore, fallback.discoveryQualityScore),
                riskProfile: typeof parsed.riskProfile === 'string' && parsed.riskProfile.trim()
                    ? parsed.riskProfile.trim()
                    : fallback.riskProfile,
                proposalAngle: typeof parsed.proposalAngle === 'string' && parsed.proposalAngle.trim()
                    ? parsed.proposalAngle.trim()
                    : fallback.proposalAngle,
                recommendedNextAction: typeof parsed.recommendedNextAction === 'string' &&
                    parsed.recommendedNextAction.trim()
                    ? parsed.recommendedNextAction.trim()
                    : fallback.recommendedNextAction,
                missingQuestions: this.normalizeStringArray(parsed.missingQuestions, fallback.missingQuestions),
                objectionRisks: this.normalizeStringArray(parsed.objectionRisks, fallback.objectionRisks),
                summary: typeof parsed.summary === 'string' && parsed.summary.trim()
                    ? parsed.summary.trim()
                    : fallback.summary,
            };
        }
        catch (error) {
            this.logger.warn(`Sales assessment JSON parsing failed: ${error instanceof Error ? error.message : String(error)}`);
            return fallback;
        }
    }
    async generateDiscoveryGuide(context) {
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
        const rawText = await this.generateText(prompt, 'discovery guide generation', () => JSON.stringify(fallback));
        try {
            const parsed = this.parseJsonFromText(rawText);
            return {
                questions: this.normalizeStringArray(parsed.questions, fallback.questions),
                talkingPoints: this.normalizeStringArray(parsed.talkingPoints, fallback.talkingPoints),
                followUpAngles: this.normalizeStringArray(parsed.followUpAngles, fallback.followUpAngles),
                qualificationChecklist: this.normalizeStringArray(parsed.qualificationChecklist, fallback.qualificationChecklist),
            };
        }
        catch (error) {
            this.logger.warn(`Discovery guide JSON parsing failed: ${error instanceof Error ? error.message : String(error)}`);
            return fallback;
        }
    }
    async generateOutreachPlan(context) {
        const fallback = this.fallbackOutreachPlan();
        const prompt = `
      You are coaching a security guard sales rep before a cold outreach attempt.
      Use only this lead/deal context:
      ${context}

      Return JSON only in this exact shape:
      {
        "callOpener": "one concise phone opener",
        "talkingPoints": ["specific security sales talking point"],
        "voicemailScript": "short voicemail script",
        "emailSubject": "short email subject",
        "emailBody": "plain text email body",
        "gatekeeperStrategy": "how to handle receptionist or office manager screening",
        "bestCallWindow": "recommended timing for first call",
        "followUpPlan": ["specific follow-up step"]
      }

      Requirements:
      - Make the outreach specific to contract security guard services.
      - Lead with property risk, operational exposure, accountability, or current-provider pain.
      - Keep the tone helpful and consultative.
      - Do not suggest robocalls, scraping, spam, or mass automation.
    `;
        const rawText = await this.generateText(prompt, 'outreach plan generation', () => JSON.stringify(fallback));
        try {
            const parsed = this.parseJsonFromText(rawText);
            return {
                callOpener: typeof parsed.callOpener === 'string' && parsed.callOpener.trim()
                    ? parsed.callOpener.trim()
                    : fallback.callOpener,
                talkingPoints: this.normalizeStringArray(parsed.talkingPoints, fallback.talkingPoints),
                voicemailScript: typeof parsed.voicemailScript === 'string' &&
                    parsed.voicemailScript.trim()
                    ? parsed.voicemailScript.trim()
                    : fallback.voicemailScript,
                emailSubject: typeof parsed.emailSubject === 'string' && parsed.emailSubject.trim()
                    ? parsed.emailSubject.trim()
                    : fallback.emailSubject,
                emailBody: typeof parsed.emailBody === 'string' && parsed.emailBody.trim()
                    ? parsed.emailBody.trim()
                    : fallback.emailBody,
                gatekeeperStrategy: typeof parsed.gatekeeperStrategy === 'string' &&
                    parsed.gatekeeperStrategy.trim()
                    ? parsed.gatekeeperStrategy.trim()
                    : fallback.gatekeeperStrategy,
                bestCallWindow: typeof parsed.bestCallWindow === 'string' &&
                    parsed.bestCallWindow.trim()
                    ? parsed.bestCallWindow.trim()
                    : fallback.bestCallWindow,
                followUpPlan: this.normalizeStringArray(parsed.followUpPlan, fallback.followUpPlan),
            };
        }
        catch (error) {
            this.logger.warn(`Outreach plan JSON parsing failed: ${error instanceof Error ? error.message : String(error)}`);
            return fallback;
        }
    }
    async generateDiscoveryCallIntelligence(context, transcript) {
        const fallback = this.fallbackDiscoveryCallIntelligence(transcript);
        const prompt = `
      You are a security guard sales discovery analyst.
      Analyze the call notes or transcript and extract only information supported by the text.

      EXISTING LEAD/DEAL CONTEXT:
      ${context}

      CALL NOTES OR TRANSCRIPT:
      ${transcript}

      Return JSON only in this exact shape:
      {
        "summary": "short call summary",
        "discovery": {
          "propertyType": null,
          "buyerRole": null,
          "currentProvider": null,
          "guardCount": null,
          "serviceHours": null,
          "painPoints": ["captured pain point"],
          "riskConcerns": ["captured risk concern"],
          "decisionTimeline": null,
          "budgetSensitivity": null,
          "objections": ["captured objection"],
          "notes": "short discovery note"
        },
        "buyingSignals": ["signal that buyer may move forward"],
        "riskSignals": ["security or deal risk signal"],
        "unansweredQuestions": ["question the sales rep still needs to ask"],
        "objections": ["sales objection from the call"],
        "decisionMakers": ["person or role involved in decision"],
        "recommendedNextAction": "one concrete next action",
        "confidenceScore": 0
      }

      Rules:
      - confidenceScore must be 0-100.
      - Use null when a field is not supported by the transcript.
      - Do not invent pricing, private personal data, or facts not present.
      - Focus on contract security guard services, property risk, coverage scope, provider pain, approval path, and timeline.
    `;
        const rawText = await this.generateText(prompt, 'discovery call intelligence generation', () => JSON.stringify(fallback));
        try {
            const parsed = this.parseJsonFromText(rawText);
            const parsedDiscovery = parsed.discovery && typeof parsed.discovery === 'object'
                ? parsed.discovery
                : {};
            return {
                summary: typeof parsed.summary === 'string' && parsed.summary.trim()
                    ? parsed.summary.trim()
                    : fallback.summary,
                discovery: {
                    propertyType: this.normalizeOptionalString(parsedDiscovery.propertyType, fallback.discovery.propertyType),
                    buyerRole: this.normalizeOptionalString(parsedDiscovery.buyerRole, fallback.discovery.buyerRole),
                    currentProvider: this.normalizeOptionalString(parsedDiscovery.currentProvider, fallback.discovery.currentProvider),
                    guardCount: this.normalizeOptionalNumber(parsedDiscovery.guardCount, fallback.discovery.guardCount),
                    serviceHours: this.normalizeOptionalString(parsedDiscovery.serviceHours, fallback.discovery.serviceHours),
                    painPoints: this.normalizeStringArray(parsedDiscovery.painPoints, fallback.discovery.painPoints),
                    riskConcerns: this.normalizeStringArray(parsedDiscovery.riskConcerns, fallback.discovery.riskConcerns),
                    decisionTimeline: this.normalizeOptionalString(parsedDiscovery.decisionTimeline, fallback.discovery.decisionTimeline),
                    budgetSensitivity: this.normalizeOptionalString(parsedDiscovery.budgetSensitivity, fallback.discovery.budgetSensitivity),
                    objections: this.normalizeStringArray(parsedDiscovery.objections, fallback.discovery.objections),
                    notes: this.normalizeOptionalString(parsedDiscovery.notes, fallback.discovery.notes),
                },
                buyingSignals: this.normalizeStringArray(parsed.buyingSignals, fallback.buyingSignals),
                riskSignals: this.normalizeStringArray(parsed.riskSignals, fallback.riskSignals),
                unansweredQuestions: this.normalizeStringArray(parsed.unansweredQuestions, fallback.unansweredQuestions),
                objections: this.normalizeStringArray(parsed.objections, fallback.objections),
                decisionMakers: this.normalizeStringArray(parsed.decisionMakers, fallback.decisionMakers),
                recommendedNextAction: typeof parsed.recommendedNextAction === 'string' &&
                    parsed.recommendedNextAction.trim()
                    ? parsed.recommendedNextAction.trim()
                    : fallback.recommendedNextAction,
                confidenceScore: this.clampScore(parsed.confidenceScore, fallback.confidenceScore),
            };
        }
        catch (error) {
            this.logger.warn(`Discovery call intelligence JSON parsing failed: ${error instanceof Error ? error.message : String(error)}`);
            return fallback;
        }
    }
    async generateDiscoveryProposal(context) {
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
        return this.generateText(prompt, 'discovery-based proposal generation', () => this.fallbackDiscoveryProposal());
    }
    async generateProposalDraft(dto) {
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
        const draft = await this.generateText(prompt, 'proposal draft generation', () => this.fallbackProposalDraft(dto).draft ?? '');
        return { draft };
    }
    async generateForLead(lead) {
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
        return this.generateText(prompt, `proposal generation for lead ${lead.id}`, () => this.fallbackLeadProposal(lead));
    }
    async generateEmailDraft(subject, context) {
        const prompt = `
      Write a professional follow-up email.
      Subject: ${subject}
      Context/Details: ${context}
      
      The email should be concise, professional, and encourage the client to secure their assets.
    `;
        return this.generateText(prompt, 'email draft generation', () => this.fallbackEmailDraft(subject, context));
    }
    async summarizeNotes(notes) {
        const prompt = `Summarize these security site visit notes into key takeaways and action items: ${notes.join('\n')}`;
        return this.generateText(prompt, 'notes summarization', () => this.fallbackSummarizeNotes(notes));
    }
    async generateBusinessInsightRecommendations(context, promptTemplate) {
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
            const parsed = JSON.parse(rawText);
            if (!Array.isArray(parsed.recommendations)) {
                return null;
            }
            return parsed.recommendations
                .filter((item) => typeof item === 'string')
                .map((item) => item.trim())
                .filter(Boolean)
                .slice(0, 5);
        }
        catch (error) {
            this.logger.warn(`Business insight recommendation generation failed: ${error instanceof Error ? error.message : String(error)}`);
            return null;
        }
    }
    async generateIncidentRiskSummary(context, promptTemplate) {
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
        }
        catch (error) {
            this.logger.warn(`Incident risk summary generation failed: ${error instanceof Error ? error.message : String(error)}`);
            return null;
        }
    }
    async generateRevenueIntelligenceSummary(context, promptTemplate) {
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
        }
        catch (error) {
            this.logger.warn(`Revenue intelligence summary generation failed: ${error instanceof Error ? error.message : String(error)}`);
            return null;
        }
    }
    async generateRevenueFinancialRecommendations(context, promptTemplate) {
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
            const parsed = JSON.parse(rawText);
            if (!Array.isArray(parsed.recommendations)) {
                return null;
            }
            return parsed.recommendations
                .map((item) => ({
                title: typeof item.title === 'string' ? item.title.trim() : '',
                action: typeof item.action === 'string' ? item.action.trim() : '',
                reason: typeof item.reason === 'string' ? item.reason.trim() : '',
                priority: item.priority === 'high' ||
                    item.priority === 'medium' ||
                    item.priority === 'low'
                    ? item.priority
                    : 'medium',
            }))
                .filter((item) => item.title && item.action && item.reason)
                .slice(0, 5);
        }
        catch (error) {
            this.logger.warn(`Revenue recommendation generation failed: ${error instanceof Error ? error.message : String(error)}`);
            return null;
        }
    }
    async explainGuardRecommendation(context, promptTemplate) {
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
        }
        catch (error) {
            this.logger.warn(`Guard recommendation explanation failed: ${error instanceof Error ? error.message : String(error)}`);
            return null;
        }
    }
    async generateCopilotAnswer(context) {
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
        }
        catch (error) {
            this.logger.warn(`Copilot answer generation failed: ${error instanceof Error ? error.message : String(error)}`);
            return null;
        }
    }
    fallbackProposalDraft(dto, reason) {
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
    fallbackLeadProposal(lead, reason) {
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
    fallbackEmailDraft(subject, context) {
        return `Subject: Follow up: ${subject}\n\nHi,\n\nFollowing up on our discussion regarding ${context}.\n\nBest regards.`;
    }
    fallbackSummarizeNotes(notes) {
        return `**Summary:**\n- ${notes.join('\n- ')}`;
    }
    fallbackSalesAssessment() {
        return {
            leadScore: 55,
            priorityTier: 'medium',
            closeReadinessScore: 45,
            discoveryQualityScore: 40,
            riskProfile: 'Discovery is still incomplete, so the risk profile should be validated before proposal.',
            proposalAngle: 'Frame the service around reducing site risk and creating accountable coverage rather than selling guard hours.',
            recommendedNextAction: 'Complete discovery around property risk, decision timeline, current provider, and required coverage.',
            missingQuestions: [
                'What incidents or risks triggered the security review?',
                'Who approves the final service scope and budget?',
                'What coverage hours and guard count are required?',
            ],
            objectionRisks: ['Price pressure may appear if risk and scope are not clearly established.'],
            summary: 'The opportunity has usable early signals, but needs stronger discovery before a confident proposal.',
        };
    }
    fallbackDiscoveryGuide() {
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
    fallbackOutreachPlan() {
        return {
            callOpener: 'Hi, this is a quick security coverage question. Are you the right person to speak with about guard services and site risk?',
            talkingPoints: [
                'Ask what prompted the current security review before discussing guard hours.',
                'Connect coverage recommendations to risks, access points, incident history, and accountability.',
                'Offer a short site walkthrough or discovery call before proposing a scope.',
            ],
            voicemailScript: 'Hi, I am calling about security coverage and risk at your property. I had a few quick questions about current guard needs and whether a short coverage review would be useful. I will follow up by email as well.',
            emailSubject: 'Security coverage review',
            emailBody: 'Hi,\n\nI wanted to reach out about your security coverage needs. We help properties align guard staffing, reporting, and escalation procedures with real site risk rather than just selling hours.\n\nWould it be worth a short conversation to understand current concerns, coverage windows, and whether a site walkthrough would help?\n\nBest regards,',
            gatekeeperStrategy: 'Ask for the person responsible for facilities, property operations, risk, or vendor management, and frame the call as a coverage review rather than a sales pitch.',
            bestCallWindow: 'Start with mid-morning or early afternoon, then follow with a concise email the same day.',
            followUpPlan: [
                'Call once with the risk-based opener.',
                'Send a short email that references property risk and accountability.',
                'Follow up with a site walkthrough offer if there is no reply.',
            ],
        };
    }
    fallbackDiscoveryCallIntelligence(transcript) {
        const summarySnippet = transcript
            .split(/\r?\n|[.!?]+/)
            .map((item) => item.trim())
            .find((item) => item.length > 20)
            ?.slice(0, 220) ||
            'Call notes captured. Confirm scope, buyer authority, risks, and next step before proposal.';
        const buyingSignals = this.transcriptSnippets(transcript, /(interested|need|start|walkthrough|proposal|quote|approve|timeline|soon|urgent)/i, ['Buyer interest exists, but the rep should confirm urgency and next step.']);
        const riskSignals = this.transcriptSnippets(transcript, /(incident|risk|liability|theft|trespass|complaint|access|parking|after hours|break-in|vandal)/i, ['Risk drivers need to be clarified before final scope.']);
        const objections = this.transcriptSnippets(transcript, /(price|budget|cost|current provider|already have|approval|not now|contract|legal|procurement)/i);
        const decisionMakers = this.transcriptSnippets(transcript, /(owner|board|manager|director|committee|procurement|approval|approver|decision|sign off)/i);
        const guardMatch = transcript.match(/(\d+)\s+(?:armed\s+|unarmed\s+)?guards?/i);
        const propertyMatch = transcript.match(/\b(apartment|warehouse|office|retail|construction|hospital|school|parking|mall|industrial|commercial|residential|hotel)\b/i);
        const roleMatch = transcript.match(/\b(owner|property manager|facilities manager|operations manager|director|procurement|board member|general manager)\b/i);
        const timeline = this.transcriptSnippets(transcript, /(asap|urgent|start|timeline|deadline|next week|next month|quarter|renewal|contract end)/i)[0];
        const budget = this.transcriptSnippets(transcript, /(budget|price|cost|rate|expensive|quote|bid|pricing)/i)[0];
        const serviceHours = this.transcriptSnippets(transcript, /(24\/7|overnight|after hours|business hours|weekend|weekday|shift|hours|evening|night)/i)[0];
        const confidenceScore = transcript.length > 700 ? 55 : transcript.length > 250 ? 45 : 35;
        return {
            summary: summarySnippet,
            discovery: {
                propertyType: propertyMatch?.[0] ?? null,
                buyerRole: roleMatch?.[0] ?? null,
                currentProvider: null,
                guardCount: guardMatch ? Number(guardMatch[1]) : null,
                serviceHours: serviceHours ?? null,
                painPoints: this.transcriptSnippets(transcript, /(problem|pain|issue|missed|no show|turnover|complaint|poor|unreliable|slow)/i),
                riskConcerns: riskSignals,
                decisionTimeline: timeline ?? null,
                budgetSensitivity: budget ?? null,
                objections,
                notes: summarySnippet,
            },
            buyingSignals,
            riskSignals,
            unansweredQuestions: [
                'Who signs off on the final scope and budget?',
                'What coverage hours and guard count are required?',
                'What start date or decision deadline should we plan around?',
            ],
            objections,
            decisionMakers,
            recommendedNextAction: 'Confirm missing scope details, decision authority, and timeline before drafting the proposal.',
            confidenceScore,
        };
    }
    transcriptSnippets(transcript, pattern, fallback = []) {
        const snippets = transcript
            .split(/\r?\n|[.!?]+/)
            .map((item) => item.trim())
            .filter((item) => item.length > 8 && pattern.test(item))
            .map((item) => item.slice(0, 180));
        const unique = Array.from(new Set(snippets)).slice(0, 5);
        return unique.length ? unique : fallback;
    }
    fallbackDiscoveryProposal() {
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
    async extractLeadFromText(text) {
        const prompt = `Extract JSON with {name, company, email} from this text: "${text}". Only return JSON.`;
        if (!this.isAiAvailable()) {
            if (this.getFallbackEnabled()) {
                return {
                    name: 'Extracted Name',
                    company: 'Extracted Company',
                    email: 'client@example.com',
                };
            }
            throw new common_1.InternalServerErrorException(this.getUnavailableMessage('lead extraction'));
        }
        try {
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const rawText = response.text().replace(/```json|```/g, '').trim();
            const parsed = JSON.parse(rawText);
            return {
                name: parsed.name || 'N/A',
                company: parsed.company || 'N/A',
                email: parsed.email || 'N/A',
            };
        }
        catch (error) {
            this.logger.error('Lead extraction failed', error instanceof Error ? error.stack : String(error));
            if (this.getFallbackEnabled()) {
                return { name: 'N/A', company: 'N/A', email: 'N/A' };
            }
            throw new common_1.InternalServerErrorException(this.getUnavailableMessage('lead extraction'));
        }
    }
};
exports.AiService = AiService;
exports.AiService = AiService = AiService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], AiService);
//# sourceMappingURL=ai.service.js.map