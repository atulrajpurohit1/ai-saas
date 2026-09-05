'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Rocket, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

const DISMISS_KEY = 'ai-saas-getting-started-dismissed';

// Each step is gated on a permission so a user only sees setup tasks they can
// actually complete, and checked against the same list endpoints those pages
// already call (no new backend calls) so "done" reflects real workspace
// state rather than being a static checklist. A step that can't be checked
// (endpoint error, no permission to read it) just stays unchecked - it never
// blocks the rest of the list or throws.
const STEPS: { label: string; description: string; href: string; permission: string; checkEndpoint: string }[] = [
  {
    label: 'Add your first branch',
    description: 'Branches are the top of your org hierarchy - sites, guards and shifts all hang off one.',
    href: '/branches',
    permission: 'branches.view',
    checkEndpoint: 'branches',
  },
  {
    label: 'Add a client site',
    description: 'The physical locations your guards are posted to.',
    href: '/sites',
    permission: 'sites.view',
    checkEndpoint: 'sites',
  },
  {
    label: 'Add guards to your roster',
    description: 'Create guard profiles so you can assign them to shifts and patrols.',
    href: '/guards',
    permission: 'guards.view',
    checkEndpoint: 'v2/guards',
  },
  {
    label: 'Schedule a shift',
    description: 'Put a guard on a site for a time window - switch to the calendar view to see coverage at a glance.',
    href: '/shifts',
    permission: 'shifts.view',
    checkEndpoint: 'v2/shifts',
  },
  {
    label: 'Bring in leads',
    description: 'Add a lead by hand, or use Prospect Search to find security buyers with AI.',
    href: '/prospect-search',
    permission: 'prospect_search.view',
    checkEndpoint: 'leads',
  },
];

export default function GettingStartedCard() {
  const { can } = useAuth();
  const [dismissed, setDismissed] = useState(true); // start hidden to avoid a flash before localStorage is read
  const [completed, setCompleted] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === 'true');
  }, []);

  const steps = STEPS.filter((step) => can(step.permission));

  useEffect(() => {
    if (dismissed || steps.length === 0) return;
    let cancelled = false;

    Promise.allSettled(steps.map((step) => api.get(step.checkEndpoint))).then((results) => {
      if (cancelled) return;
      const next: Record<string, boolean> = {};
      results.forEach((result, index) => {
        const step = steps[index];
        next[step.href] =
          result.status === 'fulfilled' && Array.isArray(result.value.data) && result.value.data.length > 0;
      });
      setCompleted(next);
    });

    return () => {
      cancelled = true;
    };
    // Re-check only when the visible step set changes (permissions loaded) -
    // not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dismissed, steps.map((s) => s.href).join(',')]);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, 'true');
    setDismissed(true);
  };

  if (dismissed || steps.length === 0) return null;

  const doneCount = steps.filter((step) => completed[step.href]).length;
  const allDone = doneCount === steps.length;

  return (
    <div className="mb-6 rounded-2xl border border-primary/15 bg-primary/[0.04] p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Rocket size={16} />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              Getting started
              <span className="ml-2 font-normal text-muted-foreground">
                {doneCount} of {steps.length} done
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              {allDone
                ? "You're set up. Dismiss this whenever you're ready."
                : "A quick path to a working setup. Dismiss this whenever you're ready."}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss getting started"
          className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <X size={15} />
        </button>
      </div>

      <ol className="space-y-2">
        {steps.map((step, index) => {
          const isDone = Boolean(completed[step.href]);
          return (
            <li key={step.href}>
              <Link
                href={step.href}
                className="group flex items-start gap-3 rounded-xl border border-border bg-card p-3 transition hover:border-primary/30"
              >
                <span
                  className={cn(
                    'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition',
                    isDone
                      ? 'bg-success-wash text-success'
                      : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary',
                  )}
                >
                  {isDone ? <Check size={13} /> : index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      'block text-sm font-semibold',
                      isDone ? 'text-muted-foreground line-through' : 'text-foreground',
                    )}
                  >
                    {step.label}
                  </span>
                  <span className="block text-xs text-muted-foreground">{step.description}</span>
                </span>
                <ArrowRight size={15} className="mt-1 shrink-0 text-muted-foreground group-hover:text-primary" />
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
