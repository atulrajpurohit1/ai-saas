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
    model;
    isPlaceholderKey;
    constructor(configService) {
        this.configService = configService;
        const apiKey = this.configService.get('GEMINI_API_KEY');
        this.isPlaceholderKey = !apiKey || apiKey === 'your-gemini-api-key-here';
        if (this.isPlaceholderKey) {
            console.warn('GEMINI_API_KEY is missing or set to placeholder. AI features will be disabled until a valid key is provided in .env');
        }
        this.genAI = new generative_ai_1.GoogleGenerativeAI(apiKey || '');
        this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    }
    checkApiKey() {
        if (this.isPlaceholderKey) {
            throw new common_1.BadRequestException('Gemini API Key is missing or invalid. Please update GEMINI_API_KEY in your backend .env file with a key from https://aistudio.google.com/');
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
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            return {
                draft: text,
            };
        }
        catch (error) {
            console.error('Gemini API Error:', error.message || error);
            const isKeyError = error.message?.includes('API_KEY_INVALID') ||
                error.message?.includes('400');
            if (isKeyError) {
                throw new common_1.BadRequestException('Gemini API Key is invalid or expired. Please check your backend .env file.');
            }
            throw new common_1.InternalServerErrorException(`AI Generation failed: ${error.message || 'Unknown error'}`);
        }
    }
    async generateForLead(lead) {
        this.checkApiKey();
        const prompt = `
      You are a professional security consultant for a premier security guard company.
      Your task is to draft a structured, persuasive, and professional security proposal for a prospective client.
      
      Client/Lead Information:
      - Contact Name: ${lead.name}
      - Company Name: ${lead.company}
      - Current Status: ${lead.status}
      
      Please write a full proposal tailored for this company. Include these sections:
      1. Executive Summary
      2. Security Strategy
      3. Recommended Services
      4. Why Choose Us
      
      Keep the tone professional, authoritative, and engaging. Do not include placeholders if possible, fabricate realistic professional security standards.
    `;
        try {
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            return text || '';
        }
        catch (error) {
            console.error('Gemini API Error (Lead):', error.message || error);
            const isKeyError = error.message?.includes('API_KEY_INVALID') ||
                error.message?.includes('400');
            if (isKeyError) {
                throw new common_1.BadRequestException('Gemini API Key is invalid or expired. Please check your backend .env file.');
            }
            throw new common_1.InternalServerErrorException(`AI Generation failed: ${error.message || 'Unknown error'}`);
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
            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            let rawText = response.text();
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