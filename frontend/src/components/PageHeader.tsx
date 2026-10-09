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
        <h1 className="flex items-center gap-2.5 text-page-title">
          {Icon && <Icon className="shrink-0 text-primary" size={26} aria-hidden="true" />}
          {title}
        </h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
