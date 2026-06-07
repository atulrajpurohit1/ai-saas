'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { getApiErrorMessage } from '@/lib/api-error';
import { getSessions, revokeSession, UserSession } from '@/lib/sso';
import { Activity, Ban, Loader2, Monitor } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

function format(value?: string | null) {
  return value ? new Date(value).toLocaleString() : '-';
}

export default function SessionsSettingsPage() {
  const { can } = useAuth();
  const canManage = can('sessions.manage');
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setSessions(await getSessions());
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load sessions.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const revoke = async (session: UserSession) => {
    if (!confirm(`Force logout ${session.user.email}?`)) return;
    setSaving(session.id);
    setError('');
    try {
      await revokeSession(session.id);
      await load();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not revoke session.'));
    } finally {
      setSaving('');
    }
  };

  return (
    <DashboardLayout requiredPermissions="sessions.view">
      <div className="mb-8">
        <h2 className="flex items-center gap-3 text-2xl font-bold sm:text-3xl">
          <Activity className="text-indigo-300" size={28} />
          Sessions
        </h2>
        <p className="mt-2 text-muted-foreground">Active login sessions</p>
      </div>

      {error && <div className="mb-6 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-300">{error}</div>}

      {loading ? (
        <div className="py-24 text-center text-muted-foreground">
          <Loader2 className="mx-auto mb-3 animate-spin text-indigo-300" size={28} />
          Loading sessions...
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]">
          <div className="grid gap-3 border-b border-white/10 px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-500 md:grid-cols-[1.5fr_1fr_1fr_1fr_140px]">
            <span>User</span>
            <span>Source</span>
            <span>Last Seen</span>
            <span>Status</span>
            <span></span>
          </div>
          {sessions.map((session) => (
            <div key={session.id} className="grid gap-3 border-b border-white/5 px-4 py-4 text-sm md:grid-cols-[1.5fr_1fr_1fr_1fr_140px] md:items-center">
              <div className="min-w-0">
                <div className="truncate font-bold text-white">{session.user.name || session.user.email}</div>
                <div className="truncate text-xs text-slate-500">{session.user.email}</div>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <Monitor size={16} className="text-indigo-300" />
                {session.provider?.providerName || session.source}
              </div>
              <div className="text-slate-400">{format(session.last_seen_at)}</div>
              <span className={`w-fit rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-widest ${session.status === 'active' ? 'bg-emerald-400/10 text-emerald-300' : 'bg-rose-400/10 text-rose-300'}`}>
                {session.status}
              </span>
              {canManage && (
                <button
                  type="button"
                  onClick={() => revoke(session)}
                  disabled={saving === session.id || session.status !== 'active'}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 text-sm font-bold text-rose-300 transition hover:bg-rose-400/20 disabled:opacity-50"
                >
                  {saving === session.id ? <Loader2 className="animate-spin" size={16} /> : <Ban size={16} />}
                  Logout
                </button>
              )}
            </div>
          ))}
          {sessions.length === 0 && <div className="p-6 text-sm text-slate-400">No sessions found.</div>}
        </div>
      )}
    </DashboardLayout>
  );
}
