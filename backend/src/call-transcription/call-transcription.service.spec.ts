import { BadRequestException } from '@nestjs/common';
import { CallTranscriptionService } from './call-transcription.service';

const generateContent = jest.fn();
const getGenerativeModel = jest.fn(() => ({ generateContent }));

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn(() => ({ getGenerativeModel })),
}));

const openAiTranscribe = jest.fn();
jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    audio: { transcriptions: { create: openAiTranscribe } },
  })),
  toFile: jest.fn(async () => ({ name: 'sales-call.webm' })),
}));

function audioFile(
  overrides: Partial<Express.Multer.File> = {},
): Express.Multer.File {
  return {
    originalname: 'sales-call.webm',
    mimetype: 'audio/webm',
    size: 1024,
    buffer: Buffer.from('fake-audio'),
    ...overrides,
  } as Express.Multer.File;
}

function geminiReturns(text: string) {
  generateContent.mockResolvedValue({ response: { text: () => text } });
}

describe('CallTranscriptionService', () => {
  let service: CallTranscriptionService;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.OPENAI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_MODEL;
    delete process.env.TRANSCRIPTION_MAX_FILE_MB;
    service = new CallTranscriptionService();
  });

  describe('provider selection', () => {
    it('reports unconfigured when neither key is set', () => {
      expect(service.getStatus()).toEqual(
        expect.objectContaining({ configured: false, provider: 'none' }),
      );
    });

    it('uses Gemini when only GEMINI_API_KEY is set', () => {
      process.env.GEMINI_API_KEY = 'g-key';
      expect(service.getStatus()).toEqual(
        expect.objectContaining({
          configured: true,
          provider: 'gemini',
          model: 'gemini-2.5-flash',
        }),
      );
    });

    /**
     * OpenAI is the opt-in override: its speech-to-text is purpose-built, so
     * setting its key must win even though Gemini is configured for everything
     * else.
     */
    it('prefers OpenAI when its key is set, even alongside Gemini', () => {
      process.env.GEMINI_API_KEY = 'g-key';
      process.env.OPENAI_API_KEY = 'o-key';
      expect(service.getStatus()).toEqual(
        expect.objectContaining({ provider: 'openai' }),
      );
    });

    it('shares GEMINI_MODEL with the rest of the AI layer', () => {
      process.env.GEMINI_API_KEY = 'g-key';
      process.env.GEMINI_MODEL = 'gemini-3-pro';
      expect(service.getStatus().model).toBe('gemini-3-pro');
    });
  });

  describe('file limits', () => {
    it('defaults to a smaller cap on Gemini than on OpenAI', () => {
      process.env.GEMINI_API_KEY = 'g-key';
      const geminiMax = service.getStatus().max_file_mb;

      process.env.OPENAI_API_KEY = 'o-key';
      const openAiMax = service.getStatus().max_file_mb;

      // Gemini takes the audio base64-encoded inside the request, which
      // inflates it by about a third, so its ceiling has to be lower.
      expect(geminiMax).toBeLessThan(openAiMax);
    });

    it('rejects an oversized file before calling the provider', async () => {
      process.env.GEMINI_API_KEY = 'g-key';
      const huge = audioFile({ size: 50 * 1024 * 1024 });

      await expect(service.transcribe(huge)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(generateContent).not.toHaveBeenCalled();
    });

    it('honours a configured override', () => {
      process.env.GEMINI_API_KEY = 'g-key';
      process.env.TRANSCRIPTION_MAX_FILE_MB = '40';
      expect(service.getStatus().max_file_mb).toBe(40);
    });
  });

  describe('transcribing with Gemini', () => {
    beforeEach(() => {
      process.env.GEMINI_API_KEY = 'g-key';
    });

    it('returns the transcript and reports the provider used', async () => {
      geminiReturns('So tell me about your current guard coverage.');

      const result = await service.transcribe(audioFile());

      expect(result.provider).toBe('gemini');
      expect(result.transcript).toBe(
        'So tell me about your current guard coverage.',
      );
      expect(result.filename).toBe('sales-call.webm');
    });

    it('sends the audio inline with its mime type', async () => {
      geminiReturns('Hello.');
      await service.transcribe(audioFile({ mimetype: 'audio/mp3' }));

      const [parts] = generateContent.mock.calls[0] as [
        Array<Record<string, unknown>>,
      ];
      expect(parts[1]).toEqual({
        inlineData: {
          mimeType: 'audio/mp3',
          data: Buffer.from('fake-audio').toString('base64'),
        },
      });
    });

    /**
     * A general-purpose model tends to introduce its answer. That preamble
     * would otherwise be fed into the coaching analysis as though the rep had
     * said it out loud.
     */
    it.each([
      ['Here is the transcript: Hello there.', 'Hello there.'],
      ["Here's the transcription:\nHello there.", 'Hello there.'],
      ['Transcript: Hello there.', 'Hello there.'],
      ['  Hello there.  ', 'Hello there.'],
    ])('strips a model preamble from %p', async (raw, expected) => {
      geminiReturns(raw);
      const result = await service.transcribe(audioFile());
      expect(result.transcript).toBe(expected);
    });

    it('does not mangle a transcript that legitimately starts with "here"', async () => {
      geminiReturns('Here at Acme we run three shifts.');
      const result = await service.transcribe(audioFile());
      expect(result.transcript).toBe('Here at Acme we run three shifts.');
    });

    it('reports silence as a clear error rather than an empty transcript', async () => {
      geminiReturns('   ');
      await expect(service.transcribe(audioFile())).rejects.toThrow(
        /No speech could be detected/,
      );
    });

    it('does not leak the provider error message to the caller', async () => {
      generateContent.mockRejectedValue(
        new Error('quota exceeded for project 12345'),
      );

      await expect(service.transcribe(audioFile())).rejects.toThrow(
        /Could not transcribe this recording/,
      );
      await expect(service.transcribe(audioFile())).rejects.not.toThrow(
        /quota exceeded/,
      );
    });

    /**
     * Providers echo the failing request back in their error text, which can
     * include the API key. Writing that to the log puts a live credential in
     * front of anyone with log access -- the same defect that had OTP codes
     * logged in cleartext.
     */
    it.each([
      ['Google key', 'invalid key AIzaSyC7xK9mQ2vRt4NpL8wZa1BcDeFgHiJkLmN'],
      ['OpenAI key', 'auth failed for sk-proj-AbCdEf1234567890XyZ'],
      ['bearer token', 'rejected: Bearer eyJhbGciOiJIUzI1NiJ9.abc123def456'],
    ])('redacts a %s from the error log', async (_label, message) => {
      const logged: string[] = [];
      jest
        .spyOn(
          (service as unknown as { logger: { error: (m: string) => void } })
            .logger,
          'error',
        )
        .mockImplementation((m: string) => {
          logged.push(m);
        });

      generateContent.mockRejectedValue(new Error(message));

      await expect(service.transcribe(audioFile())).rejects.toThrow(
        BadRequestException,
      );

      expect(logged).toHaveLength(1);
      expect(logged[0]).toContain('[redacted]');
      expect(logged[0]).not.toMatch(/AIzaSy|sk-proj-|eyJhbGci/);
    });
  });

  describe('transcribing with OpenAI', () => {
    it('still works when its key is set', async () => {
      process.env.OPENAI_API_KEY = 'o-key';
      openAiTranscribe.mockResolvedValue({ text: 'Hello from OpenAI.' });

      const result = await service.transcribe(audioFile());

      expect(result.provider).toBe('openai');
      expect(result.transcript).toBe('Hello from OpenAI.');
      expect(generateContent).not.toHaveBeenCalled();
    });
  });

  it('rejects an unsupported file type before calling any provider', async () => {
    process.env.GEMINI_API_KEY = 'g-key';
    const pdf = audioFile({
      mimetype: 'application/pdf',
      originalname: 'notes.pdf',
    });

    await expect(service.transcribe(pdf)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(generateContent).not.toHaveBeenCalled();
  });
});
