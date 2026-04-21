import {
  Injectable,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GenerateProposalDto } from './dto/generate-proposal.dto';
import { Lead } from '@prisma/client';

export interface AiProposalDraftResponse {
  draft: string | null;
}

@Injectable()
export class AiService {
  private genAI: GoogleGenerativeAI;
  private readonly isPlaceholderKey: boolean;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    this.isPlaceholderKey = !apiKey || apiKey === 'your-gemini-api-key-here';

    if (this.isPlaceholderKey) {
      console.warn(
        'GEMINI_API_KEY is missing or set to placeholder. AI features will be disabled until a valid key is provided in .env',
      );
    }
    // Using the OFFICIAL Google Generative AI SDK
    this.genAI = new GoogleGenerativeAI(apiKey || '');
  }

  private checkApiKey() {
    if (this.isPlaceholderKey) {
      throw new BadRequestException(
        'Gemini API Key is missing or set to placeholder. Please update GEMINI_API_KEY in your backend .env file with a valid key from https://aistudio.google.com/',
      );
    }
  }

  async generateProposalDraft(
    dto: GenerateProposalDto,
  ): Promise<AiProposalDraftResponse> {
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
    } catch (error: any) {
      console.error('Gemini API Error:', error.message || error);
      const isKeyError =
        error.message?.includes('API_KEY_INVALID') ||
        error.message?.includes('400') || error.message?.includes('403');
      if (isKeyError) {
        throw new BadRequestException(
          'Gemini API Key is invalid or expired. Please check your backend .env file and ensure the key has access to the Generative Language API.',
        );
      }
      throw new InternalServerErrorException(
        `AI Generation failed: ${error.message || 'Unknown error'}`,
      );
    }
  }

  async generateForLead(lead: Lead): Promise<string> {
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
    } catch (error: any) {
      console.error('Gemini API Error (Lead):', error.message || error);
      const isKeyError =
        error.message?.includes('API_KEY_INVALID') ||
        error.message?.includes('400') || error.message?.includes('403');
      if (isKeyError) {
        throw new BadRequestException(
          'Gemini API Key is invalid or expired. The request failed because the key in your .env was rejected by Google.',
        );
      }
      throw new InternalServerErrorException(
        `AI Generation failed: ${error.message || 'Unknown error'}`,
      );
    }
  }
  
  async generateEmailDraft(subject: string, context: string): Promise<string> {
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
    } catch (error: any) {
      console.error('Gemini Email Draft Error:', error.message || error);
      throw new InternalServerErrorException(`AI Email generation failed: ${error.message || 'Unknown error'}`);
    }
  }

  async summarizeNotes(notes: string[]): Promise<string> {
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
    } catch (error: any) {
      console.error('Gemini Summarization Error:', error.message || error);
      throw new InternalServerErrorException(`AI Summarization failed: ${error.message || 'Unknown error'}`);
    }
  }

  async extractLeadFromText(text: string): Promise<{ name: string; company: string; email: string }> {
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
      
      // Clean up markdown code blocks if AI included them
      rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      
      return JSON.parse(rawText);
    } catch (error: any) {
      console.error('Gemini extraction error:', error.message);
      return { name: 'Unknown', company: 'Unknown', email: null as any };
    }
  }
}
