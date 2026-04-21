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
let AiService = class AiService {
    constructor() {
        console.warn('AI Service is running in MANUAL/MOCK mode because the Gemini API is unavailable.');
    }
    async generateProposalDraft(dto) {
        const { siteName, guardCount, requirements, additionalNotes } = dto;
        return {
            draft: `
# Security Proposal for ${siteName}
**Proposed Guards**: ${guardCount}
**Key Requirements**: ${requirements}
**Additional Notes**: ${additionalNotes || 'N/A'}

## 1. Executive Summary
This is a comprehensive security framework customized specifically for ${siteName}. We deploy highly trained personnel equipped with the latest technology to ensure optimal safety.

## 2. Security Strategy
To directly address your needs (${requirements}), our tailored plan integrates vigilant physical guarding with robust reporting procedures.

## 3. Manpower and Deployment
We recommend **${guardCount} security personnel** to ensure complete coverage, deterrence, and rapid response times.

## 4. Technology and Equipment
Standard deployment includes two-way radios, body cameras, mobile reporting tools, and high-visibility uniforms.

## 5. Why Choose Us
We provide professional, reliable, and premium protection services. Let us handle the security so you can focus entirely on your core business operations.
      `.trim(),
        };
    }
    async generateForLead(lead) {
        return `
# Security Services Proposal - ${lead.company}
For: ${lead.name} · ${lead.company}

---

## 1. Executive Introduction
Thank you for considering our firm as the primary security provider for ${lead.company}. We are excited to present this customized security solution.

## 2. Threat Landscape & Risk Analysis
Based on your current status (${lead.status}), we have identified key operational risks that our specialized guarding protocols will mitigate effectively.

## 3. Operational Strategy
Our operational strategy includes a custom deployment of guards uniquely trained for your specific operational challenges and site layout.

## 4. Recommended Service Tiers
- Uniformed Guard Presence (Deterrence)
- Specialized Access Control
- 24/7 Incident Response and Reporting

## 5. Value Proposition
As a premier security provider, we guarantee a secure environment. Our guards undergo rigorous training to ensure ${lead.company} receives only the highest quality service.
    `.trim();
    }
    async generateEmailDraft(subject, context) {
        return `
Subject: Following up regarding ${subject}

Hi,

I hope this email finds you well. I wanted to follow up based on our recent discussions and outline the key points:

${context}

Please let me know a good time this week to connect and solidify our next steps. Our team is ready to deploy and secure your assets.

Best regards,
Security Consultation Team
    `.trim();
    }
    async summarizeNotes(notes) {
        return `
**Summary from Site Visit/Meeting:**
- ${notes.join('\n- ')}

**Key Takeaway:** The client requires a tailored approach focusing heavily on the points above. Our team is fully capable of handling this environment and exceeding expectations.
    `.trim();
    }
    async extractLeadFromText(text) {
        return {
            name: "Mocked Client Name",
            company: "Mocked Company Ltd",
            email: "mocked@example.com"
        };
    }
};
exports.AiService = AiService;
exports.AiService = AiService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], AiService);
//# sourceMappingURL=ai.service.js.map