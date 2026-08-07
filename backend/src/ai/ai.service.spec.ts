import { ConfigService } from '@nestjs/config';
import { AiService, ProspectCompanySummary } from './ai.service';

function buildService(
  configOverrides: Record<string, string | undefined> = {},
) {
  const configService = {
    get: jest.fn((key: string) => configOverrides[key]),
  };
  return new AiService(configService as unknown as ConfigService);
}

function mockGeminiResponse(service: AiService, text: string) {
  (service as unknown as { model: unknown }).model = {
    generateContent: jest.fn().mockResolvedValue({
      response: Promise.resolve({ text: () => text }),
    }),
  };
  (service as unknown as { genAI: unknown }).genAI = {};
}

describe('AiService.generateProspectCompanyInsight', () => {
  const company: ProspectCompanySummary = {
    name: 'Lone Star Guard Services',
    industry: 'Security Services',
    website: 'https://lonestarguard.example.com',
    city: 'Austin',
    state: 'Texas',
    country: 'United States',
    employeeCount: 120,
    revenueRange: '$10M-$50M',
    description: 'Provides commercial security guard services across Texas.',
  };

  it('returns a static fallback insight when Gemini is unavailable and fallback is enabled', async () => {
    const service = buildService({ ENABLE_AI_FALLBACK: 'true' });

    const insight = await service.generateProspectCompanyInsight(company);

    expect(insight.companyName).toBe(company.name);
    expect(insight.businessSummary).toContain(company.name);
    expect(insight.keyPersonas).toEqual([]);
    expect(insight.potentialObjections).toEqual([]);
  });

  it('throws when Gemini is unavailable and fallback is disabled', async () => {
    const service = buildService({});

    await expect(
      service.generateProspectCompanyInsight(company),
    ).rejects.toThrow();
  });

  it('parses a structured insight from a valid Gemini JSON response', async () => {
    const service = buildService({ GEMINI_API_KEY: 'test-key' });
    mockGeminiResponse(
      service,
      JSON.stringify({
        businessSummary: 'Growing security firm expanding regional coverage.',
        businessObjective: 'Needs scalable guard staffing to support growth.',
        valueProps: ['Risk-reduction assessment before pricing.'],
        salesAngles: ['Lead with a risk-reduction conversation.'],
        meetingNoteExample: 'Ask about their current security provider.',
        readinessLevel: 'warm',
      }),
    );

    const insight = await service.generateProspectCompanyInsight(
      company,
      'Find security companies in Texas',
    );

    expect(insight).toEqual({
      companyName: company.name,
      website: company.website,
      businessSummary: 'Growing security firm expanding regional coverage.',
      businessObjective: 'Needs scalable guard staffing to support growth.',
      valueProps: ['Risk-reduction assessment before pricing.'],
      salesAngles: ['Lead with a risk-reduction conversation.'],
      keyPersonas: [],
      potentialObjections: [],
      meetingNoteExample: 'Ask about their current security provider.',
      readinessLevel: 'warm',
    });
  });

  it('falls back gracefully when Gemini returns malformed JSON and fallback is enabled', async () => {
    const service = buildService({
      GEMINI_API_KEY: 'test-key',
      ENABLE_AI_FALLBACK: 'true',
    });
    mockGeminiResponse(service, 'not valid json');

    const insight = await service.generateProspectCompanyInsight(company);

    expect(insight.businessSummary).toContain(company.name);
  });

  it('throws when Gemini returns malformed JSON and fallback is disabled', async () => {
    const service = buildService({ GEMINI_API_KEY: 'test-key' });
    mockGeminiResponse(service, 'not valid json');

    await expect(
      service.generateProspectCompanyInsight(company),
    ).rejects.toThrow();
  });
});
