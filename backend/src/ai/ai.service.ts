import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GenerateProposalDto } from './dto/generate-proposal.dto';
import { Lead } from '@prisma/client';

export interface AiProposalDraftResponse {
  draft: string | null;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    const modelName = this.configService.get<string>('GEMINI_MODEL') || 'gemini-1.5-flash';

    if (apiKey) {
      this.logger.log(`GEMINI_API_KEY loaded: ${apiKey.substring(0, 4)}...`);
      try {
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.model = this.genAI.getGenerativeModel({ model: modelName });
        this.logger.log(`AI Service initialized with model: ${modelName}`);
      } catch (error) {
        this.logger.error('Failed to initialize Gemini AI:', error.message);
      }
    } else {
      this.logger.warn('GEMINI_API_KEY is missing. AI Service will run in FALLBACK mode.');
    }
  }

  private isAiAvailable(): boolean {
    return !!(this.genAI && this.model);
  }

  private getFallbackEnabled(): boolean {
    return this.configService.get<string>('ENABLE_AI_FALLBACK') === 'true';
  }

  async generateProposalDraft(dto: GenerateProposalDto): Promise<AiProposalDraftResponse> {
    if (!this.isAiAvailable()) {
      if (this.getFallbackEnabled()) return this.fallbackProposalDraft(dto);
      throw new InternalServerErrorException('AI Service is currently unavailable and fallback is disabled.');
    }

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

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return { draft: response.text() };
    } catch (error) {
      this.logger.error('Gemini Generation Error:', error.message);
      if (this.getFallbackEnabled()) return this.fallbackProposalDraft(dto, error.message);
      throw new InternalServerErrorException('Failed to generate AI proposal draft.');
    }
  }

  async generateForLead(lead: Lead & { notes?: any[]; deals?: any[] }): Promise<string> {
    if (!this.isAiAvailable()) {
      if (this.getFallbackEnabled()) return this.fallbackLeadProposal(lead, 'AI Service not initialized');
      throw new InternalServerErrorException('AI Service is currently unavailable.');
    }

    const context = `
      Lead Name: ${lead.name}
      Company: ${lead.company}
      Current Status: ${lead.status}
      Notes: ${lead.notes?.map(n => n.content).join('; ') || 'No notes available'}
      Related Deals: ${lead.deals?.map(d => d.name).join(', ') || 'No specific deals'}
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

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      this.logger.error('Gemini Lead Generation Error:', error.message);
      if (this.getFallbackEnabled()) return this.fallbackLeadProposal(lead, error.message);
      throw new InternalServerErrorException('Failed to generate AI proposal for lead.');
    }
  }

  async generateEmailDraft(subject: string, context: string): Promise<string> {
    if (!this.isAiAvailable()) return this.fallbackEmailDraft(subject, context);

    const prompt = `
      Write a professional follow-up email.
      Subject: ${subject}
      Context/Details: ${context}
      
      The email should be concise, professional, and encourage the client to secure their assets.
    `;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      return this.fallbackEmailDraft(subject, context);
    }
  }

  async summarizeNotes(notes: string[]): Promise<string> {
    if (!this.isAiAvailable()) return this.fallbackSummarizeNotes(notes);

    const prompt = `Summarize these security site visit notes into key takeaways and action items: ${notes.join('\n')}`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      return this.fallbackSummarizeNotes(notes);
    }
  }

  // --- Fallback Methods ---

  private fallbackProposalDraft(dto: GenerateProposalDto, reason?: string): AiProposalDraftResponse {
    return {
      draft: `
# Security Proposal for ${dto.siteName} (Fallback)
**Reason**: ${reason || 'AI Unavailable'}
**Proposed Guards**: ${dto.guardCount}
**Key Requirements**: ${dto.requirements}

## 1. Executive Summary
This proposal outlines a standard security framework for ${dto.siteName}.

## 2. Security Strategy
Deployment focuses on ${dto.requirements}.

## 3. Deployment
Recommended staffing: ${dto.guardCount} personnel.
      `.trim()
    };
  }

  private fallbackLeadProposal(lead: Lead, reason?: string): string {
    return `
# Security Services Proposal - ${lead.company} (Fallback)
For: ${lead.name} · ${lead.company}
**Reason**: ${reason || 'AI Unavailable'}

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

  async extractLeadFromText(text: string): Promise<{ name: string; company: string; email: string }> {
    if (!this.isAiAvailable()) return { name: "Extracted Name", company: "Extracted Company", email: "client@example.com" };
    
    const prompt = `Extract JSON with {name, company, email} from this text: "${text}". Only return JSON.`;
    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return JSON.parse(response.text().replace(/```json|```/g, '').trim());
    } catch (error) {
      return { name: "N/A", company: "N/A", email: "N/A" };
    }
  }
}
