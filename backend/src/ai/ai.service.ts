import { Injectable } from '@nestjs/common';
import { GenerateProposalDto } from './dto/generate-proposal.dto';
import { Lead } from '@prisma/client';

export interface AiProposalDraftResponse {
  draft: string | null;
}

@Injectable()
export class AiService {
  constructor() {
    console.warn('AI Service is running in MANUAL/MOCK mode because the Gemini API is unavailable.');
  }

  async generateProposalDraft(
    dto: GenerateProposalDto,
  ): Promise<AiProposalDraftResponse> {
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

  async generateForLead(lead: Lead): Promise<string> {
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
  
  async generateEmailDraft(subject: string, context: string): Promise<string> {
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

  async summarizeNotes(notes: string[]): Promise<string> {
    return `
**Summary from Site Visit/Meeting:**
- ${notes.join('\n- ')}

**Key Takeaway:** The client requires a tailored approach focusing heavily on the points above. Our team is fully capable of handling this environment and exceeding expectations.
    `.trim();
  }

  async extractLeadFromText(text: string): Promise<{ name: string; company: string; email: string }> {
    // Simple mock extraction logic to avoid breaking the front end
    return {
      name: "Mocked Client Name",
      company: "Mocked Company Ltd",
      email: "mocked@example.com"
    };
  }
}
