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

describe('AiService.generateProspectSearchFilters', () => {
  it('returns heuristic fallback filters when Gemini is unavailable and fallback is enabled', async () => {
    const service = buildService({ ENABLE_AI_FALLBACK: 'true' });

    const filters = await service.generateProspectSearchFilters(
      'Find security companies in Texas',
    );

    expect(filters.industry).toBeNull();
    expect(filters.keywords).toEqual(
      expect.arrayContaining(['Find', 'security', 'companies', 'Texas']),
    );
  });

  it('throws when Gemini is unavailable and fallback is disabled', async () => {
    const service = buildService({});

    await expect(
      service.generateProspectSearchFilters('Find security companies in Texas'),
    ).rejects.toThrow();
  });

  it('parses structured filters from a valid Gemini JSON response', async () => {
    const service = buildService({ GEMINI_API_KEY: 'test-key' });
    mockGeminiResponse(
      service,
      '```json\n' +
        JSON.stringify({
          industry: 'Security Services',
          city: null,
          state: 'Texas',
          country: 'United States',
          employeeMin: 50,
          employeeMax: 200,
          revenueRange: '$10M-$50M',
          keywords: ['security', 'guard'],
        }) +
        '\n```',
    );

    const filters = await service.generateProspectSearchFilters(
      'Find security companies in Texas with 50-200 employees',
    );

    expect(filters).toEqual({
      industry: 'Security Services',
      city: null,
      state: 'Texas',
      country: 'United States',
      employeeMin: 50,
      employeeMax: 200,
      revenueRange: '$10M-$50M',
      keywords: ['security', 'guard'],
    });
  });

  it('falls back gracefully when Gemini returns malformed JSON and fallback is enabled', async () => {
    const service = buildService({
      GEMINI_API_KEY: 'test-key',
      ENABLE_AI_FALLBACK: 'true',
    });
    mockGeminiResponse(service, 'not valid json');

    const filters = await service.generateProspectSearchFilters(
      'Find security companies',
    );

    expect(filters.industry).toBeNull();
    expect(filters.keywords.length).toBeGreaterThan(0);
  });

  it('throws when Gemini returns malformed JSON and fallback is disabled', async () => {
    const service = buildService({ GEMINI_API_KEY: 'test-key' });
    mockGeminiResponse(service, 'not valid json');

    await expect(
      service.generateProspectSearchFilters('Find security companies'),
    ).rejects.toThrow();
  });
});

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
    matchScore: 80,
  };

  it('returns a static fallback insight when Gemini is unavailable and fallback is enabled', async () => {
    const service = buildService({ ENABLE_AI_FALLBACK: 'true' });

    const insight = await service.generateProspectCompanyInsight(company);

    expect(insight.whyMatch).toContain(company.name);
    expect(insight.nextConversation).toEqual(expect.any(String));
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
        whyMatch: 'Matches industry, size, and location criteria.',
        opportunity: 'Growing security firm may need scalable staffing.',
        outreachStrategy: 'Lead with a risk-reduction conversation.',
        securityNeeds: 'Likely needs guard staffing and patrol coverage.',
        nextConversation: 'Ask about their current security provider.',
      }),
    );

    const insight = await service.generateProspectCompanyInsight(
      company,
      'Find security companies in Texas',
    );

    expect(insight).toEqual({
      whyMatch: 'Matches industry, size, and location criteria.',
      opportunity: 'Growing security firm may need scalable staffing.',
      outreachStrategy: 'Lead with a risk-reduction conversation.',
      securityNeeds: 'Likely needs guard staffing and patrol coverage.',
      nextConversation: 'Ask about their current security provider.',
    });
  });

  it('falls back gracefully when Gemini returns malformed JSON and fallback is enabled', async () => {
    const service = buildService({
      GEMINI_API_KEY: 'test-key',
      ENABLE_AI_FALLBACK: 'true',
    });
    mockGeminiResponse(service, 'not valid json');

    const insight = await service.generateProspectCompanyInsight(company);

    expect(insight.whyMatch).toContain(company.name);
  });

  it('throws when Gemini returns malformed JSON and fallback is disabled', async () => {
    const service = buildService({ GEMINI_API_KEY: 'test-key' });
    mockGeminiResponse(service, 'not valid json');

    await expect(
      service.generateProspectCompanyInsight(company),
    ).rejects.toThrow();
  });
});
