'use client';

import React from 'react';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Shown on every admin screen when the account has no plan at all.
 *
 * Distinct from ModuleLockedState, which says "you did not buy THIS service".
 * This says "you have not bought anything", so it points at the plan page
 * rather than at one service, and the nav is hidden entirely behind it --
 * there is nothing to navigate to.
 *
 * Like ModuleLockedState, this explains rather than enforces: PlanGuard
 * already refuses the API calls.
 */
export default function PlanRequiredState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground shadow-sm ring-1 ring-inset ring-border">
        <Lock className="h-5 w-5" />
      </span>
      <h2 className="text-lg font-semibold text-foreground">
        Choose a plan to get started
      </h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Your account does not have an active plan yet. Pick the services you
        need and everything unlocks right away.
      </p>
      <Button asChild size="lg" className="mt-6">
        <Link href="/settings/plan">See plan options</Link>
      </Button>
    </div>
  );
}
