import axios from 'axios';

export function getApiErrorMessage(error: unknown, fallback: string) {
  if (!axios.isAxiosError(error)) {
    return fallback;
  }

  if (!error.response) {
    return 'Backend is not reachable. Start the backend on port 5000 or update NEXT_PUBLIC_API_URL.';
  }

  const message = error.response.data?.message;

  if (Array.isArray(message)) {
    return message.join(', ');
  }

  if (typeof message === 'string' && message.trim()) {
    return message;
  }

  return fallback;
}

export interface InsufficientCreditsDetail {
  required: number;
  available: number;
  message: string;
}

/**
 * Recognises the 402 the backend raises when a tenant has run out of Prospect
 * Search credits. Matching on the `code` rather than the message text keeps the
 * UI working if the wording changes; the status is checked too so an unrelated
 * 402 from anywhere else cannot be mistaken for this.
 */
export function getInsufficientCreditsError(
  error: unknown,
): InsufficientCreditsDetail | null {
  if (!axios.isAxiosError(error) || error.response?.status !== 402) {
    return null;
  }

  const data = error.response.data;
  if (data?.code !== 'INSUFFICIENT_CREDITS') return null;

  return {
    required: Number(data.required) || 0,
    available: Number(data.available) || 0,
    message:
      typeof data.message === 'string'
        ? data.message
        : 'You have run out of Prospect Search credits.',
  };
}
