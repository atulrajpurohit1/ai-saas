'use client';

import React from 'react';
import Link from 'next/link';
import {
  SERVICE_MODULE_BLURBS,
  SERVICE_MODULE_LABELS,
  ServiceModuleKey,
} from '@/lib/entitlements';
import { Lock } from 'lucide-react';

interface ModuleLockedStateProps {
  module: ServiceModuleKey;
}

/**
 * Shown when someone reaches a page for a service the tenant has not bought --
 * by a stale bookmark, a shared link, or browser history. The nav already hides
 * these, and ModuleGuard already refuses the API calls, so this exists to
 * explain rather than to enforce.
 */
export default function ModuleLockedState({ module }: ModuleLockedStateProps) {
  const name = SERVICE_MODULE_LABELS[module];

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Lock className="h-5 w-5" />
      </span>
      <h2 className="text-lg font-semibold text-foreground">
        {name} is not part of your plan
      </h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {SERVICE_MODULE_BLURBS[module]}
      </p>
      <Link
        href={`/settings/plan?module=${module}`}
        className="mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
      >
        See plan options
      </Link>
    </div>
  );
}
