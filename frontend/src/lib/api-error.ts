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
