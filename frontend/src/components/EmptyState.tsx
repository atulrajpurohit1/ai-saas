import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  /** Only pass an action the current user is actually allowed to perform. */
  action?: React.ReactNode;
  className?: string;
}

/**
 * The single shared empty-state treatment across Admin / Client / Guard.
 * Companions: `@/components/LoadingState`, `@/components/ErrorState`.
 */
export default function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex animate-in fade-in-0 zoom-in-95 flex-col items-center justify-center gap-3 rounded-[var(--radius-lg)] border border-dashed border-border bg-card px-6 py-16 text-center',
        className,
      )}
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/8 text-primary shadow-sm ring-1 ring-inset ring-primary/15">
        <Icon size={24} aria-hidden="true" />
      </span>
      <div className="max-w-sm space-y-1">
        <p className="text-section-title text-balance">{title}</p>
        {description && <p className="text-sm text-balance text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
