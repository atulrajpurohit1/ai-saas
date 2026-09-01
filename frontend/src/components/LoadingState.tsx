import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingStateProps {
  label?: string;
  className?: string;
}

export default function LoadingState({ label = 'Loading...', className }: LoadingStateProps) {
  return (
    <div className={cn('flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground', className)}>
      <Loader2 className="animate-spin" size={18} aria-hidden="true" />
      {label}
    </div>
  );
}
