type TranscriptionProvider = 'gemini' | 'openai';
export declare class CallTranscriptionService {
    private readonly logger;
    private openaiClient;
    private geminiClient;
    private provider;
    getStatus(): {
        configured: boolean;
        provider: string;
        model: string;
        max_file_mb: number;
        supported_types: string[];
    };
    transcribe(file: Express.Multer.File): Promise<{
        provider: TranscriptionProvider;
        model: string;
        filename: string;
        mime_type: string;
        size_bytes: number;
        transcript: string;
        elapsed_ms: number;
    }>;
    private transcribeWithGemini;
    private transcribeWithOpenAi;
    private clean;
    private openai;
    private gemini;
    private isSupported;
    private model;
    private maxFileMb;
}
export {};
