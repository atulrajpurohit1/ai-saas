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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const generative_ai_1 = require("@google/generative-ai");
let AiService = class AiService {
    configService;
    genAI;
    isPlaceholderKey;
    constructor(configService) {
        this.configService = configService;
        const apiKey = this.configService.get('GEMINI_API_KEY');
        this.isPlaceholderKey = !apiKey || apiKey === 'your-gemini-api-key-here';
        if (this.isPlaceholderKey) {
            console.warn('GEMINI_API_KEY is missing or set to placeholder. AI features will be disabled until a valid key is provided in .env');
        }
        this.genAI = new generative_ai_1.GoogleGenerativeAI(apiKey || '');
    }
    checkApiKey() {
        if (this.isPlaceholderKey) {
            throw new common_1.BadRequestException('Gemini API Key is missing or set to placeholder. Please update GEMINI_API_KEY in your backend .env file with a valid key from https://aistudio.google.com/');
        }
    }
    async generateProposalDraft(dto) {
        this.checkApiKey();
        const { siteName, guardCount, requirements, additionalNotes } = dto;
        const prompt = `
      You are a professional security consultant for a premier security guard company.
      Your task is to draft a professional, persuasive, and structured security proposal for a client.
      
      Client/Site Information:
      - Site Name: ${siteName}
      - Proposed Guard Count: ${guardCount}
      - Key Requirements: ${requirements}
      - Additional Notes: ${additionalNotes || 'N/A'}
      
      The proposal should include the following sections:
      1. Executive Summary
      2. Security Strategy (Address the specific requirements)
      3. Manpower and Deployment (Explain the guard count of ${guardCount})
      4. Technology and Equipment (Mention standard security tools plus anything relevant to requirements)
      5. Why Choose Us (General professional closing)
      
      Keep the tone professional, authoritative, and reliable.
    `;
        try {
            const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            return {
                draft: text || '',
            };
        }
        catch (error) {
            console.error('Gemini API Error:', error.message || error);
            const isKeyError = error.message?.includes('API_KEY_INVALID') ||
                error.message?.includes('400') || error.message?.includes('403');
            if (isKeyError) {
                throw new common_1.BadRequestException('Gemini API Key is invalid or expired. Please check your backend .env file and ensure the key has access to the Generative Language API.');
            }
            throw new common_1.InternalServerErrorException(`AI Generation failed: ${error.message || 'Unknown error'}`);
        }
    }
    async generateForLead(lead) {
        this.checkApiKey();
        const prompt = `
      Context: Security Services Sales Proposal
      Role: Expert Security Solutions Architect
      
      Objective: Create a highly customized, professional, and persuasive security proposal based on the following Lead intelligence:
      
      Lead Intelligence:
      - Customer Name: ${lead.name}
      - Organization: ${lead.company}
      - Current Lifecycle Status: ${lead.status}
      - Primary Vertical: To be inferred from company name (${lead.company})
      
      Structure:
      1. Executive Introduction: Address ${lead.name} and the specific security needs of ${lead.company}.
      2. Threat Landscape: Analyze risks specific to their ${lead.status} status and industry.
      3. Operational Strategy: Outline a custom deployment of security personnel and technology.
      4. Service Tiers: Recommend specific security services (Armed/Unarmed Guards, Video Surveillance, Mobile Patrol).
      5. Value Proposition: Why our firm is the best fit for ${lead.company}.
      
      Constraints:
      - Tone: Professional, authoritative, yet approachable.
      - Detail: Be specific and avoid generic filler.
      - Formatting: Use Markdown for headers and lists.
    `;
        try {
            const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            return text || '';
        }
        catch (error) {
            console.error('Gemini API Error (Lead):', error.message || error);
            const isKeyError = error.message?.includes('API_KEY_INVALID') ||
                error.message?.includes('400') || error.message?.includes('403');
            if (isKeyError) {
                throw new common_1.BadRequestException('Gemini API Key is invalid or expired. The request failed because the key in your .env was rejected by Google.');
            }
            throw new common_1.InternalServerErrorException(`AI Generation failed: ${error.message || 'Unknown error'}`);
        }
    }
    async generateEmailDraft(subject, context) {
        this.checkApiKey();
        const prompt = `
      You are a professional security consultant for a premier security guard company.
      Your task is to write a professional follow-up email based on the following:
      
      Original Subject: ${subject}
      Context/Points to cover: ${context}
      
      The email should be professional, polite, persuasive, and encourage the client to take the next step.
      Do not include placeholders like [Your Name], just write the body.
    `;
        try {
            const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            return text || '';
        }
        catch (error) {
            console.error('Gemini Email Draft Error:', error.message || error);
            throw new common_1.InternalServerErrorException(`AI Email generation failed: ${error.message || 'Unknown error'}`);
        }
    }
    async summarizeNotes(notes) {
        this.checkApiKey();
        const prompt = `
      You are a professional security consultant. Summarize the following site visit/meeting notes into a concise, professional summary suitable for a business proposal.
      
      Notes:
      ${notes.join('\n- ')}
      
      Focus on key security concerns, client requirements, and specific site challenges identified.
    `;
        try {
            const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            return text || '';
        }
        catch (error) {
            console.error('Gemini Summarization Error:', error.message || error);
            throw new common_1.InternalServerErrorException(`AI Summarization failed: ${error.message || 'Unknown error'}`);
        }
    }
    async extractLeadFromText(text) {
        this.checkApiKey();
        const prompt = `
      Extract the following contact information from this text into a JSON format:
      - name (The full name of the contact person)
      - company (The name of the company/business)
      - email (The email address, if present, otherwise null)
      
      If you cannot find a specific field, use "Unknown" for name/company and null for email.
      
      Text to analyze:
      ${text}
      
      Respond only with a valid JSON object.
    `;
        try {
            const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            let rawText = text || '';
            rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(rawText);
        }
        catch (error) {
            console.error('Gemini extraction error:', error.message);
            return { name: 'Unknown', company: 'Unknown', email: null };
        }
    }
};
exports.AiService = AiService;
exports.AiService = AiService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], AiService);
//# sourceMappingURL=ai.service.js.map