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
  private model: any;
  private readonly isPlaceholderKey: boolean;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY');
    this.isPlaceholderKey = !apiKey || apiKey === 'your-gemini-api-key-here';

    if (this.isPlaceholderKey) {
      console.warn(
        'GEMINI_API_KEY is missing or set to placeholder. AI features will be disabled until a valid key is provided in .env',
      );
    }
    this.genAI = new GoogleGenerativeAI(apiKey || '');
    // Using gemini-1.5-flash for high-performance generation
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  }

  private checkApiKey() {
    if (this.isPlaceholderKey) {
      throw new BadRequestException(
        'Gemini API Key is missing or invalid. Please update GEMINI_API_KEY in your backend .env file with a key from https://aistudio.google.com/',
      );
    }
  }

  async generateProposalDraft(
    dto: GenerateProposalDto,
  ): Promise<AiProposalDraftResponse> {
    this.checkApiKey();
    const { siteName, guardCount, requirements, additionalNotes } = dto;
    
    // ... rest of the method

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
    } catch (error: any) {
      console.error('Gemini API Error:', error.message || error);
      const isKeyError =
        error.message?.includes('API_KEY_INVALID') ||
        error.message?.includes('400');
      if (isKeyError) {
        throw new BadRequestException(
          'Gemini API Key is invalid or expired. Please check your backend .env file.',
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
    } catch (error: any) {
      console.error('Gemini API Error (Lead):', error.message || error);
      const isKeyError =
        error.message?.includes('API_KEY_INVALID') ||
        error.message?.includes('400');
      if (isKeyError) {
        throw new BadRequestException(
          'Gemini API Key is invalid or expired. Please check your backend .env file.',
        );
      }
      throw new InternalServerErrorException(
        `AI Generation failed: ${error.message || 'Unknown error'}`,
      );
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
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      let rawText = response.text();
      
      // Clean up markdown code blocks if AI included them
      rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      
      return JSON.parse(rawText);
    } catch (error: any) {
      console.error('Gemini extraction error:', error.message);
      return { name: 'Unknown', company: 'Unknown', email: null as any };
    }
  }
}
