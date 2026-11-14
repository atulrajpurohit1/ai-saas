'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  PLAN_UPGRADE_PARAM,
  SERVICE_MODULE_BLURBS,
  SERVICE_MODULE_LABELS,
  ServiceModuleKey,
} from '@/lib/entitlements';

/**
 * The "choose a plan to unlock this" prompt, shown on the plan page after a
 * locked part of the app sent someone here.
 *
 * Opens off a query flag rather than off `hasPlan`, so it appears when they
 * reached for something -- clicking Leads, or opening a bookmark -- and not
 * every time they simply visit the plan page to read the pricing. The flag is
 * stripped from the URL as soon as the dialog is up, so a refresh or a shared
 * link does not reopen it.
 *
 * It explains; it does not enforce. PlanGuard already refuses the API, and the
 * nav already routes here. Dismissing it leaves them on the plan page, which
 * is exactly where they can act.
 */
function isServiceKey(value: string | null): value is ServiceModuleKey {
  return value === 'LEAD_GEN' || value === 'GUARD_TOUR' || value === 'FINANCE';
}

export default function PlanRequiredDialog() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [feature, setFeature] = useState<string | null>(null);
  const [service, setService] = useState<ServiceModuleKey | null>(null);

  // Read straight from the URL instead of useSearchParams: this renders inside
  // DashboardLayout, which wraps every screen, and useSearchParams would push
  // the nearest Suspense boundary's whole subtree into client rendering on
  // prerendered routes.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    if (!params.get(PLAN_UPGRADE_PARAM)) return;

    const askedFor = params.get('feature');
    const askedService = params.get('service');
    setFeature(askedFor);
    setService(isServiceKey(askedService) ? askedService : null);
    setOpen(true);

    // Drop the flag so the prompt does not come back on refresh or on a link
    // someone pastes to a colleague. replace() keeps it out of history too, so
    // Back does not land on the same prompt.
    params.delete(PLAN_UPGRADE_PARAM);
    params.delete('feature');
    params.delete('service');
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }, [pathname, router]);

  const close = useCallback(() => setOpen(false), []);

  const title = feature
    ? `${feature} needs an active plan`
    : 'Choose a plan to get started';

  const description = service
    ? `${feature ?? 'That screen'} is part of ${SERVICE_MODULE_LABELS[service]}. ${SERVICE_MODULE_BLURBS[service]}`
    : 'Your account does not have an active plan yet. Pick the services you need and everything unlocks right away.';

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <span
            className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15"
            aria-hidden="true"
          >
            <Sparkles className="h-5 w-5" />
          </span>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button onClick={close} size="lg" className="w-full sm:w-auto">
            See plans
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
