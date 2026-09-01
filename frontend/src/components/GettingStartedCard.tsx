'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Rocket, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const DISMISS_KEY = 'ai-saas-getting-started-dismissed';

// Each step is gated on a permission so a user only sees setup tasks they can
// actually complete. The list is a static guide (not auto-checked) - a
// deliberate choice to keep this zero-risk and backend-free; users dismiss it
// once they're oriented.
const STEPS: { label: string; description: string; href: string; permission: string }[] = [
  {
    label: 'Add your first branch',
    description: 'Branches are the top of your org hierarchy - sites, guards and shifts all hang off one.',
    href: '/branches',
    permission: 'branches.view',
  },
  {
    label: 'Add a client site',
    description: 'The physical locations your guards are posted to.',
    href: '/sites',
    permission: 'sites.view',
  },
  {
    label: 'Add guards to your roster',
    description: 'Create guard profiles so you can assign them to shifts and patrols.',
    href: '/guards',
    permission: 'guards.view',
  },
  {
    label: 'Schedule a shift',
    description: 'Put a guard on a site for a time window - switch to the calendar view to see coverage at a glance.',
    href: '/shifts',
    permission: 'shifts.view',
  },
  {
    label: 'Bring in leads',
    description: 'Add a lead by hand, or use Prospect Search to find security buyers with AI.',
    href: '/prospect-search',
    permission: 'prospect_search.view',
  },
];

export default function GettingStartedCard() {
  const { can } = useAuth();
  const [dismissed, setDismissed] = useState(true); // start hidden to avoid a flash before localStorage is read

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === 'true');
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, 'true');
    setDismissed(true);
  };

  const steps = STEPS.filter((step) => can(step.permission));

  if (dismissed || steps.length === 0) return null;

  return (
    <div className="mb-6 rounded-2xl border border-primary/15 bg-primary/[0.04] p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Rocket size={16} />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Getting started</p>
            <p className="text-xs text-muted-foreground">A quick path to a working setup. Dismiss this whenever you&apos;re ready.</p>
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
        {steps.map((step, index) => (
          <li key={step.href}>
            <Link
              href={step.href}
              className="group flex items-start gap-3 rounded-xl border border-border bg-card p-3 transition hover:border-primary/30"
            >
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">{step.label}</span>
                <span className="block text-xs text-muted-foreground">{step.description}</span>
              </span>
              <ArrowRight size={15} className="mt-1 shrink-0 text-muted-foreground group-hover:text-primary" />
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
