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
        'flex flex-col items-center justify-center gap-3 rounded-[var(--radius-lg)] border border-dashed border-border bg-card px-6 py-16 text-center',
        className,
      )}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <Icon size={22} aria-hidden="true" />
      </span>
      <div className="max-w-sm space-y-1">
        <p className="text-section-title">{title}</p>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
