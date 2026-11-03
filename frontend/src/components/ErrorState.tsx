import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export default function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-error/20 bg-error-wash px-4 py-3 text-sm text-error shadow-sm"
    >
      <span className="flex items-center gap-2.5">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-error/10 ring-1 ring-inset ring-error/20">
          <AlertTriangle size={15} aria-hidden="true" />
        </span>
        {message}
      </span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-error/30 bg-card/60 px-3 py-1 text-xs font-semibold outline-none transition hover:bg-card focus-visible:ring-2 focus-visible:ring-error/40 active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100"
        >
          <RefreshCw size={13} aria-hidden="true" />
          Retry
        </button>
      )}
    </div>
  );
}
