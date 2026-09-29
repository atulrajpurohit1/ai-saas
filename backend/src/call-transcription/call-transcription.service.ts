import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI, { toFile } from 'openai';

const SUPPORTED_AUDIO_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/wav',
  'audio/x-wav',
  'audio/webm',
  'audio/ogg',
  'audio/flac',
  'video/mp4',
  'video/webm',
]);

type TranscriptionProvider = 'gemini' | 'openai';

const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini-transcribe';

/**
 * Gemini takes the audio inline in the request body, base64-encoded, and the
 * whole request has a size ceiling. Base64 inflates a payload by roughly a
 * third, so the file limit has to sit well under that ceiling -- a 15MB file
 * is ~20MB on the wire.
 *
 * 12MB is deliberately conservative. The exact current limit could not be
 * verified against Google's docs when this was written, and a request that is
 * rejected for size fails AFTER the upload, which is a slow and confusing way
 * for a user to find out. Raise TRANSCRIPTION_MAX_FILE_MB if larger files are
 * confirmed to work. At typical voice bitrates 12MB is roughly 25 minutes of
 * call audio.
 */
const DEFAULT_GEMINI_MAX_FILE_MB = 12;

/** OpenAI accepts a genuine file upload, so it tolerates a larger file. */
const DEFAULT_OPENAI_MAX_FILE_MB = 25;

/**
 * Instruction kept blunt on purpose: a general-purpose model will otherwise
 * introduce the transcript ("Here is the transcription:"), summarise, or tidy
 * up the speech. The output is fed to downstream coaching analysis, so filler
 * and false starts are signal, not noise.
 */
const TRANSCRIPTION_PROMPT = [
  'Transcribe this audio recording verbatim.',
  'Output ONLY the spoken words.',
  'Do not add a preamble, heading, commentary, summary, or closing remark.',
  'Do not correct grammar, remove filler words, or paraphrase.',
  'If several people speak, start each new speaker on its own line.',
  'If the audio contains no speech, output nothing at all.',
].join(' ');

/** Strips a lead-in the model was asked not to produce but sometimes does. */
const PREAMBLE = /^\s*(here(?:'s| is)[^:\n]*:|transcript(?:ion)?\s*:)\s*/i;

/**
 * Provider error messages quote back the request, which can include the API
 * key itself. Logging them verbatim writes a live credential into the
 * application log, where anyone with log access can read it -- the same defect
 * that put OTP codes in these logs in cleartext.
 */
const CREDENTIAL_PATTERNS: RegExp[] = [
  /AIza[0-9A-Za-z_-]{10,}/g, // Google API key
  /sk-[A-Za-z0-9_-]{10,}/g, // OpenAI secret key
  /Bearer\s+[A-Za-z0-9._-]{10,}/gi,
];

function redactCredentials(message: string): string {
  return CREDENTIAL_PATTERNS.reduce(
    (text, pattern) => text.replace(pattern, '[redacted]'),
    message,
  );
}

@Injectable()
export class CallTranscriptionService {
  private readonly logger = new Logger(CallTranscriptionService.name);
  private openaiClient: OpenAI | null = null;
  private geminiClient: GoogleGenerativeAI | null = null;

  /**
   * Which provider handles transcription.
   *
   * Gemini is the default because the same GEMINI_API_KEY already powers the
   * rest of the AI features -- one vendor, one bill, and no second account to
   * set up. OpenAI is a deliberate opt-in: its speech-to-text is purpose-built
   * and should be more accurate on difficult audio, so setting OPENAI_API_KEY
   * switches to it without any code change.
   */
  private provider(): TranscriptionProvider | null {
    if (process.env.OPENAI_API_KEY?.trim()) return 'openai';
    if (process.env.GEMINI_API_KEY?.trim()) return 'gemini';
    return null;
  }

  getStatus() {
    const provider = this.provider();
    return {
      configured: provider !== null,
      provider: provider ?? 'none',
      model: provider ? this.model(provider) : '',
      max_file_mb: this.maxFileMb(provider),
      supported_types: Array.from(SUPPORTED_AUDIO_TYPES),
    };
  }

  async transcribe(file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No audio file uploaded');

    const provider = this.provider();
    if (!provider) {
      throw new BadRequestException(
        'Audio transcription is not configured. Set GEMINI_API_KEY (or OPENAI_API_KEY) to enable it.',
      );
    }

    if (!this.isSupported(file)) {
      throw new BadRequestException('Unsupported audio file type');
    }

    const maxMb = this.maxFileMb(provider);
    if (file.size > maxMb * 1024 * 1024) {
      throw new BadRequestException(
        `Audio file must be ${maxMb}MB or smaller`,
      );
    }

    const startedAt = Date.now();
    const transcript =
      provider === 'gemini'
        ? await this.transcribeWithGemini(file)
        : await this.transcribeWithOpenAi(file);

    return {
      provider,
      model: this.model(provider),
      filename: file.originalname,
      mime_type: file.mimetype,
      size_bytes: file.size,
      transcript,
      elapsed_ms: Date.now() - startedAt,
    };
  }

  private async transcribeWithGemini(
    file: Express.Multer.File,
  ): Promise<string> {
    const model = this.gemini().getGenerativeModel({
      model: this.model('gemini'),
    });

    let text: string;
    try {
      const result = await model.generateContent([
        { text: TRANSCRIPTION_PROMPT },
        {
          inlineData: {
            mimeType: file.mimetype || 'audio/webm',
            data: file.buffer.toString('base64'),
          },
        },
      ]);
      text = result.response.text();
    } catch (error) {
      // The provider's own message can name the file, the model, or quota
      // detail we should not hand back to a browser -- so the caller gets a
      // generic message. The log keeps the detail, with any credential the
      // provider echoed back stripped out first.
      this.logger.error(
        `Gemini transcription failed for "${file.originalname}" (${file.size} bytes): ${redactCredentials(
          error instanceof Error ? error.message : String(error),
        )}`,
      );
      throw new BadRequestException(
        'Could not transcribe this recording. Please try again, or try a shorter file.',
      );
    }

    return this.clean(text);
  }

  private async transcribeWithOpenAi(
    file: Express.Multer.File,
  ): Promise<string> {
    const upload = await toFile(
      file.buffer,
      file.originalname || 'sales-call.webm',
      { type: file.mimetype || 'audio/webm' },
    );

    const result = await this.openai().audio.transcriptions.create({
      file: upload,
      model: this.model('openai'),
    });

    return this.clean(result.text || '');
  }

  /**
   * An empty transcript is reported as an error rather than returned as an
   * empty string: silently handing back nothing looks like a broken feature,
   * where "no speech detected" tells the user what to do next.
   */
  private clean(text: string): string {
    const cleaned = (text || '').replace(PREAMBLE, '').trim();
    if (!cleaned) {
      throw new BadRequestException(
        'No speech could be detected in this recording.',
      );
    }
    return cleaned;
  }

  private openai() {
    if (!this.openaiClient) {
      this.openaiClient = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY?.trim() || '',
      });
    }
    return this.openaiClient;
  }

  private gemini() {
    if (!this.geminiClient) {
      this.geminiClient = new GoogleGenerativeAI(
        process.env.GEMINI_API_KEY?.trim() || '',
      );
    }
    return this.geminiClient;
  }

  private isSupported(file: Express.Multer.File) {
    if (SUPPORTED_AUDIO_TYPES.has(file.mimetype)) return true;
    return /\.(mp3|mp4|mpeg|mpga|m4a|wav|webm|ogg|oga|flac)$/i.test(
      file.originalname || '',
    );
  }

  private model(provider: TranscriptionProvider) {
    if (provider === 'openai') {
      return (
        process.env.OPENAI_TRANSCRIPTION_MODEL?.trim() || DEFAULT_OPENAI_MODEL
      );
    }
    // Shares GEMINI_MODEL with the rest of the AI layer, so the whole product
    // moves models together rather than drifting apart.
    return process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  }

  private maxFileMb(provider: TranscriptionProvider | null) {
    const configured = Number(process.env.TRANSCRIPTION_MAX_FILE_MB);
    if (Number.isFinite(configured) && configured > 0) return configured;
    return provider === 'openai'
      ? DEFAULT_OPENAI_MAX_FILE_MB
      : DEFAULT_GEMINI_MAX_FILE_MB;
  }
}
