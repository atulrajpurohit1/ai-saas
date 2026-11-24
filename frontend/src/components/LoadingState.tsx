import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingStateProps {
  label?: string;
  className?: string;
}

export default function LoadingState({ label = 'Loading…', className }: LoadingStateProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('flex animate-in fade-in-0 items-center justify-center gap-2 rounded-lg py-12 text-sm font-medium text-muted-foreground sm:py-16', className)}
    >
      <Loader2 className="animate-spin text-primary motion-reduce:animate-none" size={20} aria-hidden="true" />
      {label}
    </div>
  );
}
