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
      className="flex animate-in fade-in-0 slide-in-from-top-1 flex-wrap items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-error/25 bg-error-wash px-4 py-3 text-sm font-medium leading-relaxed text-foreground shadow-sm"
    >
      <span className="flex min-w-0 items-center gap-2.5 break-words">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-error/10 text-error ring-1 ring-inset ring-error/20">
          <AlertTriangle size={15} aria-hidden="true" />
        </span>
        {message}
      </span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-error/30 bg-card/80 px-3 py-1 text-xs font-semibold text-error outline-none transition hover:bg-card focus-visible:ring-2 focus-visible:ring-error/40 active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100"
        >
          <RefreshCw size={13} aria-hidden="true" />
          Retry
        </button>
      )}
    </div>
  );
}
