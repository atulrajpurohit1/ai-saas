'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldAlert, ArrowRight } from 'lucide-react';
import {
  ClientInsuranceSummary,
  getClientInsuranceSummary,
} from '@/lib/client-compliance';

interface Props {
  // When set, the advisory is scoped to a single client (used on the invoice
  // generation flow). Omit for the tenant-wide view (Finance / Clients).
  clientId?: string;
  className?: string;
}

// Phase 3G: READ-ONLY advisory. Never blocks any action - it only surfaces
// expiring / expired / missing client insurance where it is naturally
// visible. Renders nothing when there is nothing to flag, or when the caller
// lacks permission to read the summary (the request 403s and is swallowed).
export default function InsuranceAdvisoryBanner({ clientId, className = '' }: Props) {
  const [summary, setSummary] = useState<ClientInsuranceSummary | null>(null);

  useEffect(() => {
    let active = true;
    getClientInsuranceSummary(clientId)
      .then((data) => {
        if (active) setSummary(data);
      })
      .catch(() => {
        if (active) setSummary(null);
      });
    return () => {
      active = false;
    };
  }, [clientId]);

  if (!summary) return null;
  const flagged = summary.expired + summary.expiringSoon + summary.missing;
  if (flagged === 0) return null;

  const parts: string[] = [];
  if (summary.expired > 0) parts.push(`${summary.expired} expired`);
  if (summary.expiringSoon > 0) parts.push(`${summary.expiringSoon} expiring soon`);
  if (summary.missing > 0) parts.push(`${summary.missing} missing`);

  const severe = summary.expired > 0;

  return (
    <Link
      href={clientId ? `/clients/insurance?client_id=${clientId}` : '/clients/insurance'}
      className={`mb-6 flex items-center justify-between gap-3 rounded-2xl border px-5 py-4 text-sm font-semibold transition hover:brightness-110 ${
        severe
          ? 'border-rose-500/20 bg-rose-500/10 text-rose-300'
          : 'border-amber-500/20 bg-amber-500/10 text-amber-300'
      } ${className}`}
    >
      <span className="flex items-center gap-3">
        <ShieldAlert size={18} />
        <span>
          Client insurance: {parts.join(' · ')}
          <span className="ml-1 font-normal opacity-80">(advisory only — does not block invoicing)</span>
        </span>
      </span>
      <ArrowRight size={16} className="shrink-0" />
    </Link>
  );
}
