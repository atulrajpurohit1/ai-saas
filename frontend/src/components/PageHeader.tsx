import React from 'react';
import { LucideIcon } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
}

// Shared page-header pattern used across every Phase 2 list page - title +
// optional subtitle on the left, primary/secondary actions on the right.
//
// `icon` is optional because the finance-side pages (Timesheets, Rate Cards,
// Invoices...) grew their own hand-rolled icon titles while the rest of the
// app used this component without one. Supporting it here lets those pages
// move onto the shared header instead of keeping a second pattern alive.
export default function PageHeader({ title, description, icon: Icon, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h1 className="flex items-center gap-3 text-page-title break-words">
          {Icon && (
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
              <Icon size={20} aria-hidden="true" />
            </span>
          )}
          {title}
        </h1>
        {description && <p className="mt-1 text-sm text-pretty text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
