"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var CallTranscriptionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CallTranscriptionService = void 0;
const common_1 = require("@nestjs/common");
const generative_ai_1 = require("@google/generative-ai");
const openai_1 = __importStar(require("openai"));
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
const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';
const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini-transcribe';
const DEFAULT_GEMINI_MAX_FILE_MB = 12;
const DEFAULT_OPENAI_MAX_FILE_MB = 25;
const TRANSCRIPTION_PROMPT = [
    'Transcribe this audio recording verbatim.',
    'Output ONLY the spoken words.',
    'Do not add a preamble, heading, commentary, summary, or closing remark.',
    'Do not correct grammar, remove filler words, or paraphrase.',
    'If several people speak, start each new speaker on its own line.',
    'If the audio contains no speech, output nothing at all.',
].join(' ');
const PREAMBLE = /^\s*(here(?:'s| is)[^:\n]*:|transcript(?:ion)?\s*:)\s*/i;
const CREDENTIAL_PATTERNS = [
    /AIza[0-9A-Za-z_-]{10,}/g,
    /sk-[A-Za-z0-9_-]{10,}/g,
    /Bearer\s+[A-Za-z0-9._-]{10,}/gi,
];
function redactCredentials(message) {
    return CREDENTIAL_PATTERNS.reduce((text, pattern) => text.replace(pattern, '[redacted]'), message);
}
let CallTranscriptionService = CallTranscriptionService_1 = class CallTranscriptionService {
    logger = new common_1.Logger(CallTranscriptionService_1.name);
    openaiClient = null;
    geminiClient = null;
    provider() {
        if (process.env.OPENAI_API_KEY?.trim())
            return 'openai';
        if (process.env.GEMINI_API_KEY?.trim())
            return 'gemini';
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
    async transcribe(file) {
        if (!file)
            throw new common_1.BadRequestException('No audio file uploaded');
        const provider = this.provider();
        if (!provider) {
            throw new common_1.BadRequestException('Audio transcription is not configured. Set GEMINI_API_KEY (or OPENAI_API_KEY) to enable it.');
        }
        if (!this.isSupported(file)) {
            throw new common_1.BadRequestException('Unsupported audio file type');
        }
        const maxMb = this.maxFileMb(provider);
        if (file.size > maxMb * 1024 * 1024) {
            throw new common_1.BadRequestException(`Audio file must be ${maxMb}MB or smaller`);
        }
        const startedAt = Date.now();
        const transcript = provider === 'gemini'
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
    async transcribeWithGemini(file) {
        const model = this.gemini().getGenerativeModel({
            model: this.model('gemini'),
        });
        let text;
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
        }
        catch (error) {
            this.logger.error(`Gemini transcription failed for "${file.originalname}" (${file.size} bytes): ${redactCredentials(error instanceof Error ? error.message : String(error))}`);
            throw new common_1.BadRequestException('Could not transcribe this recording. Please try again, or try a shorter file.');
        }
        return this.clean(text);
    }
    async transcribeWithOpenAi(file) {
        const upload = await (0, openai_1.toFile)(file.buffer, file.originalname || 'sales-call.webm', { type: file.mimetype || 'audio/webm' });
        const result = await this.openai().audio.transcriptions.create({
            file: upload,
            model: this.model('openai'),
        });
        return this.clean(result.text || '');
    }
    clean(text) {
        const cleaned = (text || '').replace(PREAMBLE, '').trim();
        if (!cleaned) {
            throw new common_1.BadRequestException('No speech could be detected in this recording.');
        }
        return cleaned;
    }
    openai() {
        if (!this.openaiClient) {
            this.openaiClient = new openai_1.default({
                apiKey: process.env.OPENAI_API_KEY?.trim() || '',
            });
        }
        return this.openaiClient;
    }
    gemini() {
        if (!this.geminiClient) {
            this.geminiClient = new generative_ai_1.GoogleGenerativeAI(process.env.GEMINI_API_KEY?.trim() || '');
        }
        return this.geminiClient;
    }
    isSupported(file) {
        if (SUPPORTED_AUDIO_TYPES.has(file.mimetype))
            return true;
        return /\.(mp3|mp4|mpeg|mpga|m4a|wav|webm|ogg|oga|flac)$/i.test(file.originalname || '');
    }
    model(provider) {
        if (provider === 'openai') {
            return (process.env.OPENAI_TRANSCRIPTION_MODEL?.trim() || DEFAULT_OPENAI_MODEL);
        }
        return process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
    }
    maxFileMb(provider) {
        const configured = Number(process.env.TRANSCRIPTION_MAX_FILE_MB);
        if (Number.isFinite(configured) && configured > 0)
            return configured;
        return provider === 'openai'
            ? DEFAULT_OPENAI_MAX_FILE_MB
            : DEFAULT_GEMINI_MAX_FILE_MB;
    }
};
exports.CallTranscriptionService = CallTranscriptionService;
exports.CallTranscriptionService = CallTranscriptionService = CallTranscriptionService_1 = __decorate([
    (0, common_1.Injectable)()
], CallTranscriptionService);
//# sourceMappingURL=call-transcription.service.js.map