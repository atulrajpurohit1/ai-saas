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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CallTranscriptionService = void 0;
const common_1 = require("@nestjs/common");
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
let CallTranscriptionService = class CallTranscriptionService {
    client = null;
    getStatus() {
        return {
            configured: Boolean(this.apiKey()),
            provider: 'openai',
            model: this.model(),
            max_file_mb: this.maxFileMb(),
            supported_types: Array.from(SUPPORTED_AUDIO_TYPES),
        };
    }
    async transcribe(file) {
        if (!file)
            throw new common_1.BadRequestException('No audio file uploaded');
        if (!this.apiKey()) {
            throw new common_1.BadRequestException('OPENAI_API_KEY is not configured for audio transcription');
        }
        if (!this.isSupported(file)) {
            throw new common_1.BadRequestException('Unsupported audio file type');
        }
        if (file.size > this.maxFileBytes()) {
            throw new common_1.BadRequestException(`Audio file must be ${this.maxFileMb()}MB or smaller`);
        }
        const startedAt = Date.now();
        const upload = await (0, openai_1.toFile)(file.buffer, file.originalname || 'sales-call.webm', {
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
    openai() {
        if (!this.client) {
            this.client = new openai_1.default({ apiKey: this.apiKey() });
        }
        return this.client;
    }
    isSupported(file) {
        if (SUPPORTED_AUDIO_TYPES.has(file.mimetype))
            return true;
        return /\.(mp3|mp4|mpeg|mpga|m4a|wav|webm|ogg|oga|flac)$/i.test(file.originalname || '');
    }
    apiKey() {
        return process.env.OPENAI_API_KEY?.trim() || '';
    }
    model() {
        return process.env.OPENAI_TRANSCRIPTION_MODEL?.trim() || 'gpt-4o-mini-transcribe';
    }
    maxFileMb() {
        const parsed = Number(process.env.TRANSCRIPTION_MAX_FILE_MB || 25);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 25;
    }
    maxFileBytes() {
        return this.maxFileMb() * 1024 * 1024;
    }
};
exports.CallTranscriptionService = CallTranscriptionService;
exports.CallTranscriptionService = CallTranscriptionService = __decorate([
    (0, common_1.Injectable)()
], CallTranscriptionService);
//# sourceMappingURL=call-transcription.service.js.map