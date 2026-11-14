'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Rocket } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { ServiceModuleKey } from '@/lib/entitlements';

/**
 * The one-time "you've taken the first step" welcome for each service.
 *
 * Three in the whole product -- one per service, the first time someone opens
 * it -- and never again on that browser. Deliberately not a tour: a popup on
 * every screen trains people to dismiss popups without reading them, which
 * costs us the three that actually matter.
 */
const MODULE_WELCOME: Record<
  ServiceModuleKey,
  { title: string; lead: string; points: string[]; href: string; cta: string }
> = {
  LEAD_GEN: {
    title: "You've taken the first step in winning new contracts",
    lead: 'Lead Generation is where your pipeline lives — from the first prospect to a signed contract.',
    points: [
      'Find security buyers with Prospect Search, or add leads by hand',
      'Move each one through your deal stages so nothing goes quiet',
      'Send proposals and run RFPs without leaving the app',
    ],
    href: '/leads',
    cta: 'Go to Leads',
  },
  GUARD_TOUR: {
    title: "You've taken the first step towards accountable patrols",
    lead: 'Guard Tour turns what happens on site into a record you can show a client.',
    points: [
      'Put QR checkpoints on site and have guards scan them on their rounds',
      'Capture incidents with photos and location as they happen',
      'Hand clients a patrol report that proves the work was done',
    ],
    href: '/patrols',
    cta: 'Go to Patrols',
  },
  FINANCE: {
    title: "You've taken the first step towards running a tighter operation",
    lead: 'Operations connects your rota to your invoices, so scheduled hours and billed hours finally agree.',
    points: [
      'Roster guards onto shifts and see coverage gaps before they bite',
      'Approve timesheets that carry straight through to invoicing',
      'Watch margin per client instead of guessing at it',
    ],
    href: '/shifts',
    cta: 'Go to Shifts',
  },
};

export default function ModuleWelcomeDialog({
  module,
}: {
  module: ServiceModuleKey | null;
}) {
  const { welcomeSeen, markWelcomeSeen } = useAuth();
  const [open, setOpen] = useState(false);
  // Which module this open dialog is for. Held separately from `module` so the
  // content cannot change mid-dismissal if the user navigates while it is up.
  const [shown, setShown] = useState<ServiceModuleKey | null>(null);

  useEffect(() => {
    if (!module || welcomeSeen(module)) return;

    setShown(module);
    setOpen(true);
    // welcomeSeen is intentionally not a dependency: it flips to true the
    // moment this is dismissed, and re-running then would immediately null out
    // the dialog mid-close animation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [module]);

  // Recorded on dismissal rather than on display, so a welcome closed by a
  // crash or a hard refresh is shown once more instead of being silently lost.
  const dismiss = () => {
    if (shown) markWelcomeSeen(shown);
    setOpen(false);
  };

  if (!shown) return null;
  const copy = MODULE_WELCOME[shown];

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : dismiss())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <span className="mb-1 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/15">
            <Rocket className="h-5 w-5" aria-hidden="true" />
          </span>
          <DialogTitle className="text-left">{copy.title}</DialogTitle>
          <DialogDescription className="text-left">{copy.lead}</DialogDescription>
        </DialogHeader>

        <ul className="mt-1 space-y-2.5">
          {copy.points.map((point) => (
            <li key={point} className="flex gap-2.5 text-sm text-foreground">
              <span
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                aria-hidden="true"
              />
              <span>{point}</span>
            </li>
          ))}
        </ul>

        <DialogFooter className="mt-3">
          <Button type="button" variant="outline" onClick={dismiss}>
            Explore on my own
          </Button>
          <Button asChild onClick={dismiss}>
            <Link href={copy.href}>{copy.cta}</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
