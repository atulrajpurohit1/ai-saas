import api from '@/lib/api';

export interface CallTranscriptionStatus {
  configured: boolean;
  provider: string;
  model: string;
  max_file_mb: number;
  supported_types: string[];
}

export interface CallTranscriptionResult {
  provider: string;
  model: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  transcript: string;
  elapsed_ms: number;
}

export async function getCallTranscriptionStatus() {
  const res = await api.get<CallTranscriptionStatus>('call-transcription/status');
  return res.data;
}

export async function transcribeCallAudio(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post<CallTranscriptionResult>('call-transcription/transcribe', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}
