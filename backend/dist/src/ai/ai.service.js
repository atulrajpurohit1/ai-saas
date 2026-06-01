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
    getUnavailableMessage(action) {
        if (!this.isAiAvailable()) {
            return `GEMINI_API_KEY is missing or Gemini could not be initialized. ${action} requires a working Gemini configuration.`;
        }
        return `Failed to complete ${action} with Gemini. Check GEMINI_API_KEY and GEMINI_MODEL.`;
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
    async generateBusinessInsightRecommendations(context) {
        if (!this.isAiAvailable()) {
            return null;
        }
        const prompt = `
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
    async generateIncidentRiskSummary(context) {
        if (!this.isAiAvailable()) {
            return null;
        }
        const prompt = `
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
    async generateRevenueIntelligenceSummary(context) {
        if (!this.isAiAvailable()) {
            return null;
        }
        const prompt = `
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
    async generateRevenueFinancialRecommendations(context) {
        if (!this.isAiAvailable()) {
            return null;
        }
        const prompt = `
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
    async explainGuardRecommendation(context) {
        if (!this.isAiAvailable()) {
            return null;
        }
        const prompt = `
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