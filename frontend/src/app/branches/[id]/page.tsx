'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { Branch, getBranch, updateBranch } from '@/lib/branches';
import { ArrowLeft, Building2, GitBranch, Loader2, MapPin, Save } from 'lucide-react';

export default function BranchDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [branch, setBranch] = useState<Branch | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ name: '', location: '', status: 'active' });

  useEffect(() => {
    if (!params.id) return;
    getBranch(params.id)
      .then((nextBranch) => {
        setBranch(nextBranch);
        setFormData({
          name: nextBranch.name,
          location: nextBranch.location,
          status: nextBranch.status,
        });
      })
      .catch((err) => {
        console.error('Failed to load branch:', err);
        router.push('/branches');
      })
      .finally(() => setLoading(false));
  }, [params.id, router]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!branch) return;

    setSaving(true);
    try {
      const updated = await updateBranch(branch.id, {
        name: formData.name.trim(),
        location: formData.location.trim(),
        status: formData.status,
      });
      setBranch(updated);
      alert('Branch updated.');
    } catch (err: any) {
      console.error('Failed to update branch:', err);
      alert(err.response?.data?.message || 'Could not update branch.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-6">
        <Link href="/branches" className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-slate-400 transition hover:text-white">
          <ArrowLeft size={16} />
          Back to Branches
        </Link>
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Branch Details</h2>
            <p className="text-slate-400">Update branch profile and review assigned operational records.</p>
          </div>
          {branch && (
            <span className={`w-fit rounded-full border px-4 py-2 text-xs font-black uppercase tracking-widest ${
              branch.status === 'active'
                ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
                : 'border-slate-400/20 bg-slate-400/10 text-slate-400'
            }`}>
              {branch.status}
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="glass-card rounded-3xl border border-white/5 py-20 text-center text-slate-400">
          <Loader2 className="mx-auto mb-3 animate-spin text-indigo-300" />
          Loading branch...
        </div>
      ) : branch ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <form onSubmit={handleSubmit} className="glass-card rounded-3xl border border-white/5 p-5 sm:p-6">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-400/10 text-sky-300">
                <GitBranch size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Branch Profile</h3>
                <p className="text-sm text-slate-400">Name, location, and operating status.</p>
              </div>
            </div>

            <div className="space-y-4">
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-400">Branch Name</span>
                <input
                  value={formData.name}
                  onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-indigo-500/40"
                  required
                />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-400">Location</span>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-300" size={16} />
                  <input
                    value={formData.location}
                    onChange={(event) => setFormData({ ...formData, location: event.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/40"
                    required
                  />
                </div>
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-400">Status</span>
                <select
                  value={formData.status}
                  onChange={(event) => setFormData({ ...formData, status: event.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-indigo-500/40"
                >
                  <option value="active" className="bg-[#0e0e1a] text-white">Active</option>
                  <option value="inactive" className="bg-[#0e0e1a] text-white">Inactive</option>
                </select>
              </label>
            </div>

            <button
              disabled={saving}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3 font-bold text-white transition hover:bg-indigo-500 disabled:opacity-60"
            >
              {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
              Save Changes
            </button>
          </form>

          <div className="glass-card rounded-3xl border border-white/5 p-5 sm:p-6">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-400/10 text-indigo-300">
                <Building2 size={20} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Assigned Records</h3>
                <p className="text-sm text-slate-400">Current records linked to this branch.</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric label="Clients" value={branch._count?.clients ?? 0} />
              <Metric label="Sites" value={branch._count?.sites ?? 0} />
              <Metric label="Guards" value={branch._count?.guards ?? 0} />
              <Metric label="Shifts" value={branch._count?.shifts ?? 0} />
              <Metric label="Incidents" value={branch._count?.incidents ?? 0} />
              <Metric label="Reports" value={branch._count?.reports ?? 0} />
              <Metric label="Invoices" value={branch._count?.invoices ?? 0} />
              <Metric label="Users" value={branch._count?.users ?? 0} />
            </div>
          </div>
        </div>
      ) : null}
    </DashboardLayout>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center">
      <div className="text-2xl font-black text-white">{value}</div>
      <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</div>
    </div>
  );
}
