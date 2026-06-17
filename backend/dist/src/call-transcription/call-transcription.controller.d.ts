import { CallTranscriptionService } from './call-transcription.service';
export declare class CallTranscriptionController {
    private readonly callTranscriptionService;
    constructor(callTranscriptionService: CallTranscriptionService);
    status(): {
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
}
