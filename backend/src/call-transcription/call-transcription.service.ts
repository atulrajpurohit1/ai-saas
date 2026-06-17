import { BadRequestException, Injectable } from '@nestjs/common';
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

@Injectable()
export class CallTranscriptionService {
  private client: OpenAI | null = null;

  getStatus() {
    return {
      configured: Boolean(this.apiKey()),
      provider: 'openai',
      model: this.model(),
      max_file_mb: this.maxFileMb(),
      supported_types: Array.from(SUPPORTED_AUDIO_TYPES),
    };
  }

  async transcribe(file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No audio file uploaded');
    if (!this.apiKey()) {
      throw new BadRequestException('OPENAI_API_KEY is not configured for audio transcription');
    }
    if (!this.isSupported(file)) {
      throw new BadRequestException('Unsupported audio file type');
    }
    if (file.size > this.maxFileBytes()) {
      throw new BadRequestException(`Audio file must be ${this.maxFileMb()}MB or smaller`);
    }

    const startedAt = Date.now();
    const upload = await toFile(file.buffer, file.originalname || 'sales-call.webm', {
      type: file.mimetype || 'audio/webm',
    });

    const result = await this.openai().audio.transcriptions.create({
      file: upload,
      model: this.model(),
    });

    return {
      provider: 'openai',
      model: this.model(),
      filename: file.originalname,
      mime_type: file.mimetype,
      size_bytes: file.size,
      transcript: result.text || '',
      elapsed_ms: Date.now() - startedAt,
    };
  }

  private openai() {
    if (!this.client) {
      this.client = new OpenAI({ apiKey: this.apiKey() });
    }
    return this.client;
  }

  private isSupported(file: Express.Multer.File) {
    if (SUPPORTED_AUDIO_TYPES.has(file.mimetype)) return true;
    return /\.(mp3|mp4|mpeg|mpga|m4a|wav|webm|ogg|oga|flac)$/i.test(file.originalname || '');
  }

  private apiKey() {
    return process.env.OPENAI_API_KEY?.trim() || '';
  }

  private model() {
    return process.env.OPENAI_TRANSCRIPTION_MODEL?.trim() || 'gpt-4o-mini-transcribe';
  }

  private maxFileMb() {
    const parsed = Number(process.env.TRANSCRIPTION_MAX_FILE_MB || 25);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 25;
  }

  private maxFileBytes() {
    return this.maxFileMb() * 1024 * 1024;
  }
}
