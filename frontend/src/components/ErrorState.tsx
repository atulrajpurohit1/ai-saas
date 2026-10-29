import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export default function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-error/20 bg-error-wash px-4 py-3 text-sm text-error shadow-sm">
      <span className="flex items-center gap-2">
        <AlertTriangle size={16} className="shrink-0" aria-hidden="true" />
        {message}
      </span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 rounded-full border border-error/30 bg-card/60 px-3 py-1 text-xs font-semibold transition hover:bg-card"
        >
          Retry
        </button>
      )}
    </div>
  );
}
