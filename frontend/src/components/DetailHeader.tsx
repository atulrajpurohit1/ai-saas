import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import Breadcrumbs, { type Crumb } from '@/components/Breadcrumbs';

interface DetailHeaderProps {
  /** Where the "back" affordance points (usually the parent list). */
  backHref: string;
  backLabel: string;
  title: string;
  /** Optional eyebrow above the title (e.g. "Lead"). */
  eyebrow?: string;
  breadcrumbs?: Crumb[];
  /** Status badge / meta shown next to the title on wide screens. */
  meta?: React.ReactNode;
  actions?: React.ReactNode;
}

/**
 * The single header treatment for record detail pages - replaces the
 * hand-rolled "back link + <h1> + status pill" block each detail page had.
 * Companion to `PageHeader` (used by list pages).
 */
export default function DetailHeader({
  backHref,
  backLabel,
  title,
  eyebrow,
  breadcrumbs,
  meta,
  actions,
}: DetailHeaderProps) {
  return (
    <div className="mb-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft size={16} aria-hidden="true" />
          {backLabel}
        </Link>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <Breadcrumbs items={breadcrumbs} className="hidden sm:block" />
        )}
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          {eyebrow && <p className="text-eyebrow mb-1.5">{eyebrow}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-page-title break-words">{title}</h1>
            {meta}
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
