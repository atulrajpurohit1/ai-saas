'use client';

import React, { Suspense, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import PageHeader from '@/components/PageHeader';
import { useAuth } from '@/context/AuthContext';
import {
  SERVICE_MODULE_LABELS,
  ServiceModuleKey,
  moduleSummary,
} from '@/lib/entitlements';
import { cn } from '@/lib/utils';
import { BrainCircuit, Check, DollarSign, Lock, ShieldCheck } from 'lucide-react';

const MODULE_ICONS: Record<ServiceModuleKey, typeof BrainCircuit> = {
  LEAD_GEN: BrainCircuit,
  GUARD_TOUR: ShieldCheck,
  FINANCE: DollarSign,
};

const MODULE_HIGHLIGHTS: Record<ServiceModuleKey, string[]> = {
  LEAD_GEN: [
    'Prospect search and lead qualification',
    'Deal pipeline and proposals',
    'RFP generation and vendor evaluation',
  ],
  GUARD_TOUR: [
    'Shift scheduling and guard assignment',
    'Patrol routes with checkpoint photo evidence',
    'Live incident reporting and emergency alerts',
  ],
  FINANCE: [
    'Rate cards and automated invoicing',
    'Dispute handling',
    'Revenue and margin reporting',
  ],
};

function PlanContent() {
  const { entitlements } = useAuth();
  const searchParams = useSearchParams();
  const requested = searchParams.get('module') as ServiceModuleKey | null;

  const modules = useMemo(() => moduleSummary(entitlements), [entitlements]);
  const requestedName =
    requested && SERVICE_MODULE_LABELS[requested]
      ? SERVICE_MODULE_LABELS[requested]
      : null;

  return (
    <DashboardLayout>
      <PageHeader
        title="Your plan"
        description="The AegisLead services active on this account."
      />

      {requestedName && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <Lock className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-semibold text-foreground">
              {requestedName} is not part of your plan
            </p>
            <p className="text-sm text-muted-foreground">
              The page you tried to open belongs to {requestedName}. Add it below
              to enable it for your team.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {modules.map((module) => {
          const Icon = MODULE_ICONS[module.key];

          return (
            <div
              key={module.key}
              className={cn(
                'flex flex-col rounded-xl border p-5 transition-colors',
                module.active
                  ? 'border-primary/30 bg-primary/5'
                  : 'border-border bg-card',
                requested === module.key && !module.active && 'ring-2 ring-amber-500/40',
              )}
            >
              <div className="mb-3 flex items-center justify-between">
                <span
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-lg',
                    module.active
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                {module.active ? (
                  <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
                    <Check className="h-3 w-3" /> Active
                  </span>
                ) : (
                  <span className="flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    <Lock className="h-3 w-3" /> Not included
                  </span>
                )}
              </div>

              <h3 className="text-base font-semibold text-foreground">
                {module.name}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">{module.blurb}</p>

              <ul className="mt-4 space-y-2">
                {MODULE_HIGHLIGHTS[module.key].map((highlight) => (
                  <li
                    key={highlight}
                    className="flex items-start gap-2 text-sm text-muted-foreground"
                  >
                    <Check
                      className={cn(
                        'mt-0.5 h-4 w-4 shrink-0',
                        module.active ? 'text-primary' : 'text-muted-foreground/50',
                      )}
                    />
                    {highlight}
                  </li>
                ))}
              </ul>

              {!module.active && (
                <a
                  href={`mailto:sales@aegislead.com?subject=${encodeURIComponent(
                    `Add ${module.name} to our AegisLead plan`,
                  )}`}
                  className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                >
                  Add {module.name}
                </a>
              )}
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        Need to change users, branches or usage limits?{' '}
        <Link href="/settings/billing" className="font-medium text-primary hover:underline">
          View billing and usage
        </Link>
        .
      </p>
    </DashboardLayout>
  );
}

export default function PlanSettingsPage() {
  return (
    <Suspense
      fallback={
        <DashboardLayout>
          <PageHeader title="Your plan" description="Loading plan details." />
        </DashboardLayout>
      }
    >
      <PlanContent />
    </Suspense>
  );
}
