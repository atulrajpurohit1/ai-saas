'use client';

import React, { useCallback, useEffect, useState } from 'react';
import ClientLayout from '@/components/ClientLayout';
import Link from 'next/link';
import api from '@/lib/api';
import { FileText, Clock, CheckCircle, XCircle, ArrowRight, Sparkles, AlertTriangle, ShieldCheck, MapPin, ExternalLink, Radar } from 'lucide-react';
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
    return (
      <div className="glass-card mb-8 rounded-[2rem] border border-white/5 p-6 text-center text-sm text-slate-500 sm:mb-10">
        Checking live site status...
      </div>
    );
  }

  if (sites.length === 0) {
    return null; // No sites on this client account - nothing useful to show.
  }

  return (
    <div className="glass-card mb-8 rounded-[2rem] border border-white/5 p-5 sm:mb-10 sm:p-8">
      <div className="mb-5 flex items-center gap-2">
        <Radar className="text-indigo-400" size={20} />
        <h2 className="text-lg font-bold text-white sm:text-xl">Guards On Site Now</h2>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {sites.map(({ site, guardsOnSite }) => (
          <div key={site.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="mb-2">
              <div className="font-bold text-white">{site.name}</div>
              <div className="text-xs text-slate-500">{site.address}</div>
            </div>
            {guardsOnSite.length === 0 ? (
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <MapPin size={12} />
                No guard currently on site
              </div>
            ) : (
              <div className="space-y-2">
                {guardsOnSite.map((guard) => (
                  <div key={guard.guardId} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
                    <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-300">
                      <ShieldCheck size={13} />
                      {guard.guardName}
                    </span>
                    {guard.location ? (
                      <a
                        href={`https://www.google.com/maps?q=${guard.location.latitude},${guard.location.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-300 hover:text-indigo-200"
                      >
                        On patrol - view location
                        <ExternalLink size={10} />
                      </a>
                    ) : (
                      <span className="text-[11px] text-slate-500">Live location unavailable</span>
                    )}
                    {guard.location?.capturedAt && (
                      <span className="text-[11px] text-slate-600">as of {relativeTime(guard.location.capturedAt)}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ClientDashboard() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProposals = async () => {
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
    };
    fetchProposals();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved': return <CheckCircle className="text-emerald-400" size={20} />;
      case 'rejected': return <XCircle className="text-rose-400" size={20} />;
      default: return <Clock className="text-yellow-400" size={20} />;
    }
  };

  return (
    <ClientLayout>
      <div className="mb-8 sm:mb-10">
        <div className="flex items-center gap-3 mb-2">
          <Sparkles className="text-indigo-400" size={20} />
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-400">Client Workspace</span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Your Proposals</h1>
        <p className="mt-2 text-base text-slate-400 sm:text-lg">Review and manage your security service proposals.</p>
      </div>

      <LiveSiteStatusPanel />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-20 text-center text-slate-500 italic">Syncing with portal...</div>
        ) : error ? (
          <div className="col-span-full py-10 px-6 rounded-[2rem] border border-rose-500/20 bg-rose-500/10 text-rose-300 flex items-center gap-3">
            <AlertTriangle size={20} />
            <span className="text-sm font-medium">{error}</span>
          </div>
        ) : proposals.length === 0 ? (
          <div className="col-span-full py-20 text-center glass-card rounded-[2rem] border-dashed border-white/5">
            <p className="text-slate-400">No proposals available at the moment.</p>
          </div>
        ) : proposals.map((p) => (
          <Link key={p.id} href={`/client/proposals/${p.id}`} className="group">
            <div className="glass-card flex h-full flex-col rounded-[2rem] border border-white/5 bg-[#0a0a14]/60 p-5 transition-all duration-300 hover:border-indigo-500/30 hover:bg-[#0a0a14]/80 group-hover:-translate-y-1 sm:p-8">
              <div className="flex items-center justify-between mb-6">
                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                  <FileText size={24} />
                </div>
                <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                  p.status === 'approved' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                  p.status === 'rejected' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' :
                  'bg-yellow-500/10 border-yellow-500/20 text-yellow-400'
                }`}>
                  {p.status}
                </div>
              </div>

              <h3 className="text-xl font-bold text-white mb-2 leading-tight">{p.title}</h3>
              <p className="text-slate-500 text-sm mb-8">
                Created on {new Date(p.createdAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>

              <div className="mt-auto flex items-center justify-between pt-6 border-t border-white/5">
                <div className="flex items-center gap-2">
                  {getStatusIcon(p.status)}
                  <span className="text-xs font-semibold text-slate-300 capitalize">{p.status}</span>
                </div>
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                  <ArrowRight size={16} />
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </ClientLayout>
  );
}
