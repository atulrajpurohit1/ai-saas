'use client';

import React, { useCallback, useEffect, useState } from 'react';
import ClientLayout from '@/components/ClientLayout';
import Link from 'next/link';
import api from '@/lib/api';
import { FileText, ArrowRight, MapPin, ExternalLink, Radar, ShieldCheck } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import LoadingState from '@/components/LoadingState';
import ErrorState from '@/components/ErrorState';
import StatusBadge from '@/components/StatusBadge';
import { ClientSiteLiveStatus, getClientSitesLiveStatus } from '@/lib/client-patrols';
import { CLIENT_LIVE_STATUS_POLL_INTERVAL_MS } from '@/lib/guard-tracking.constants';

interface Proposal {
  id: string;
  title: string;
  status: string;
  createdAt: string;
}

function relativeTime(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function LiveSiteStatusPanel() {
  const [sites, setSites] = useState<ClientSiteLiveStatus[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await getClientSitesLiveStatus();
      setSites(res);
    } catch (err) {
      console.error('Failed to load live site status', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const intervalId = setInterval(fetchStatus, CLIENT_LIVE_STATUS_POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [fetchStatus]);

  if (loading) {
    return <LoadingState label="Checking live site status…" className="mb-6" />;
  }

  if (sites.length === 0) {
    return null; // No sites on this client account - nothing useful to show.
  }

  return (
    <section className="surface-card mb-6 p-5 sm:p-6">
      <div className="mb-4 flex items-center gap-2">
        <Radar className="text-primary" size={18} />
        <h2 className="text-section-title">Guards on site now</h2>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {sites.map(({ site, guardsOnSite }) => (
          <div key={site.id} className="rounded-[var(--radius)] border border-border bg-muted p-4">
            <div className="mb-2">
              <div className="font-semibold text-foreground">{site.name}</div>
              <div className="text-xs text-muted-foreground">{site.address}</div>
            </div>
            {guardsOnSite.length === 0 ? (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin size={12} />
                No guard currently on site
              </div>
            ) : (
              <div className="space-y-2">
                {guardsOnSite.map((guard) => (
                  <div
                    key={guard.guardId}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[var(--radius-sm)] border border-success/20 bg-success-wash px-3 py-2"
                  >
                    <span className="flex items-center gap-1.5 text-xs font-bold text-success">
                      <ShieldCheck size={13} />
                      {guard.guardName}
                    </span>
                    {guard.location ? (
                      <a
                        href={`https://www.google.com/maps?q=${guard.location.latitude},${guard.location.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                      >
                        On patrol — view location
                        <ExternalLink size={10} />
                      </a>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">Live location unavailable</span>
                    )}
                    {guard.location?.capturedAt && (
                      <span className="text-[11px] text-muted-foreground">as of {relativeTime(guard.location.capturedAt)}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

export default function ClientDashboard() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchProposals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('client-portal/proposals');
      setProposals(Array.isArray(res.data) ? res.data : []);
      setError('');
    } catch (err) {
      console.error('Failed to fetch proposals', err);
      setError('Could not load your proposals. Please refresh or sign in again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProposals();
  }, [fetchProposals]);

  return (
    <ClientLayout>
      <PageHeader
        title="Dashboard"
        description="Your security service proposals and live site status."
      />

      <LiveSiteStatusPanel />

      <h2 className="mb-4 text-section-title">Your proposals</h2>

      {loading ? (
        <LoadingState label="Loading your proposals…" />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchProposals} />
      ) : proposals.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No proposals yet"
          description="When your provider shares a security services proposal with you, it will appear here."
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {proposals.map((p) => (
            <Link key={p.id} href={`/client/proposals/${p.id}`} className="group">
              <div className="surface-card flex h-full flex-col p-5 transition hover:border-primary/30 hover:shadow-md sm:p-6">
                <div className="mb-5 flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-[var(--radius)] bg-primary/10 text-primary">
                    <FileText size={22} />
                  </span>
                  <StatusBadge status={p.status} />
                </div>
                <h3 className="mb-1 text-base font-bold leading-tight text-foreground">{p.title}</h3>
                <p className="mb-6 text-sm text-muted-foreground">
                  Created {new Date(p.createdAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
                <div className="mt-auto flex items-center justify-between border-t border-border pt-4 text-sm font-semibold text-primary">
                  View proposal
                  <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </ClientLayout>
  );
}
