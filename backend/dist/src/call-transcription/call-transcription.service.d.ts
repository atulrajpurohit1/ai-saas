export declare class CallTranscriptionService {
    private client;
    getStatus(): {
        configured: boolean;
        provider: string;
        model: string;
        max_file_mb: number;
        supported_types: string[];
    };
    transcribe(file: Express.Multer.File): Promise<{
        provider: string;
        model: string;
        filename: string;
        mime_type: string;
        size_bytes: number;
        transcript: string;
        elapsed_ms: number;
    }>;
    private openai;
    private isSupported;
    private apiKey;
    private model;
    private maxFileMb;
    private maxFileBytes;
}
