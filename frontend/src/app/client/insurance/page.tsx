'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import ClientLayout from '@/components/ClientLayout';
import { getApiErrorMessage } from '@/lib/api-error';
import { formatEnumLabel } from '@/lib/format';
import {
  ComplianceStatus,
  CLIENT_INSURANCE_TYPE_LABELS,
  ClientInsurancePolicy,
  downloadClientInsuranceDocument,
  getMyInsurancePolicies,
} from '@/lib/client-compliance';
import { Download, Loader2, MapPin, Umbrella } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import LoadingState from '@/components/LoadingState';
import ErrorState from '@/components/ErrorState';
import StatusBadge, { type StatusTone } from '@/components/StatusBadge';

const STATUS_META: Record<ComplianceStatus, { label: string; tone: StatusTone }> = {
  VALID: { label: 'Valid', tone: 'success' },
  EXPIRING_SOON: { label: 'Expiring Soon', tone: 'warning' },
  EXPIRED: { label: 'Expired', tone: 'error' },
  MISSING: { label: 'Not On File', tone: 'neutral' },
};

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
}

function formatMoney(value: number | null): string {
  if (value === null || value === undefined) return '—';
  return value.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

export default function ClientInsurancePortalPage() {
  const [policies, setPolicies] = useState<ClientInsurancePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const fetchPolicies = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMyInsurancePolicies();
      setPolicies(Array.isArray(data) ? data : []);
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load your insurance records.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPolicies();
  }, [fetchPolicies]);

  const summary = useMemo(() => {
    const counts = { VALID: 0, EXPIRING_SOON: 0, EXPIRED: 0, MISSING: 0 };
    policies.forEach((p) => { counts[p.status] += 1; });
    return counts;
  }, [policies]);

  const handleDownload = async (policy: ClientInsurancePolicy) => {
    if (!policy.id) return;
    setDownloadingId(policy.id);
    try {
      await downloadClientInsuranceDocument(
        policy.id,
        policy.fileName || `insurance-${policy.id}`,
        'client/insurance',
      );
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to download document.'));
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <ClientLayout>
      <PageHeader
        title="Insurance & Certificates"
        description="Insurance policies and Certificate-of-Insurance documents on file for your account."
      />

      {!loading && !error && policies.length > 0 && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {([
            ['Valid', summary.VALID, 'text-success'],
            ['Expiring Soon', summary.EXPIRING_SOON, 'text-warning'],
            ['Expired', summary.EXPIRED, 'text-error'],
            ['Not On File', summary.MISSING, 'text-muted-foreground'],
          ] as const).map(([label, value, colorClass]) => (
            <div key={label} className="surface-muted p-4">
              <div className="text-eyebrow">{label}</div>
              <div className={`mt-1 text-2xl font-extrabold ${colorClass}`}>{value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="surface-card overflow-hidden">
        <div className="p-3 sm:p-4">
          {loading ? (
            <LoadingState label="Loading insurance records…" />
          ) : error ? (
            <ErrorState message={error} onRetry={fetchPolicies} />
          ) : policies.length === 0 ? (
            <EmptyState
              icon={Umbrella}
              title="No insurance records on file"
              description="Insurance policies and certificates your provider records for your account will appear here."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {policies.map((policy) => {
                const meta = STATUS_META[policy.status];
                return (
                  <article
                    key={policy.id || `${policy.type}-${policy.siteId ?? 'wide'}`}
                    className="rounded-[var(--radius)] border border-border bg-card p-5 sm:p-6"
                  >
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <h3 className="break-words text-base font-bold text-foreground">
                        {CLIENT_INSURANCE_TYPE_LABELS[policy.type as keyof typeof CLIENT_INSURANCE_TYPE_LABELS] || formatEnumLabel(policy.type)}
                      </h3>
                      <StatusBadge label={meta.label} tone={meta.tone} status={policy.status} />
                    </div>

                    <dl className="space-y-2 text-sm">
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted-foreground">Scope</dt>
                        <dd className="text-right font-medium text-foreground">
                          {policy.siteId ? (
                            <span className="inline-flex items-center gap-1"><MapPin size={12} />{policy.siteName || 'Site'}</span>
                          ) : 'Account-wide'}
                        </dd>
                      </div>
                      {policy.insurer && (
                        <div className="flex justify-between gap-3">
                          <dt className="text-muted-foreground">Insurer</dt>
                          <dd className="text-right font-medium text-foreground">{policy.insurer}</dd>
                        </div>
                      )}
                      {policy.policyNumber && (
                        <div className="flex justify-between gap-3">
                          <dt className="text-muted-foreground">Policy #</dt>
                          <dd className="text-right font-medium text-foreground">{policy.policyNumber}</dd>
                        </div>
                      )}
                      {policy.coverageAmount != null && (
                        <div className="flex justify-between gap-3">
                          <dt className="text-muted-foreground">Coverage</dt>
                          <dd className="text-right font-medium text-foreground">{formatMoney(policy.coverageAmount)}</dd>
                        </div>
                      )}
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted-foreground">Effective</dt>
                        <dd className="text-right font-medium text-foreground">{formatDate(policy.effectiveDate)}</dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-muted-foreground">Expires</dt>
                        <dd className="text-right font-medium text-foreground">{formatDate(policy.expirationDate)}</dd>
                      </div>
                    </dl>

                    <div className="mt-5 border-t border-border pt-4">
                      {policy.id && policy.hasDocument ? (
                        <button
                          type="button"
                          onClick={() => handleDownload(policy)}
                          disabled={downloadingId === policy.id}
                          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-muted px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-primary hover:text-primary-foreground disabled:opacity-60 sm:w-auto"
                        >
                          {downloadingId === policy.id ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
                          {policy.fileName ? 'Download Certificate' : 'Download Document'}
                        </button>
                      ) : (
                        <span className="text-xs font-semibold text-muted-foreground">No document available</span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </ClientLayout>
  );
}
