'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { Branch, createBranch, getBranches, updateBranch } from '@/lib/branches';
import { ArrowRight, GitBranch, Loader2, MapPin, Plus, Power, Search } from 'lucide-react';

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({ name: '', location: '' });

  const fetchBranches = async () => {
    setLoading(true);
    try {
      setBranches(await getBranches());
    } catch (err) {
      console.error('Failed to load branches:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await createBranch({
        name: formData.name.trim(),
        location: formData.location.trim(),
        status: 'active',
      });
      setFormData({ name: '', location: '' });
      setShowModal(false);
      fetchBranches();
    } catch (err: any) {
      console.error('Failed to create branch:', err);
      alert(err.response?.data?.message || 'Could not create branch.');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (branch: Branch) => {
    const status = branch.status === 'active' ? 'inactive' : 'active';
    try {
      await updateBranch(branch.id, { status });
      fetchBranches();
    } catch (err: any) {
      console.error('Failed to update branch:', err);
      alert(err.response?.data?.message || 'Could not update branch.');
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Branches</h2>
          <p className="text-slate-400">Manage regions, locations, and branch-level operating access.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3 font-bold text-white shadow-lg transition hover:bg-indigo-500 sm:w-auto"
        >
          <Plus size={20} />
          <span>Create Branch</span>
        </button>
      </div>

      <div className="glass-card overflow-hidden rounded-3xl border border-white/5">
        <div className="border-b border-white/5 bg-white/5 p-4 sm:p-6">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input
              type="text"
              placeholder="Search branches..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
          </div>
        </div>

        <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-3">
          {loading ? (
            <div className="col-span-full py-16 text-center text-slate-400">
              <Loader2 className="mx-auto mb-3 animate-spin text-indigo-300" />
              Loading branches...
            </div>
          ) : branches.filter(branch => !searchQuery || branch.name.toLowerCase().includes(searchQuery.toLowerCase()) || branch.location.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 ? (
            <div className="col-span-full rounded-3xl border border-dashed border-white/10 py-16 text-center text-slate-400">
              No branches match your search.
            </div>
          ) : (
            branches.filter(branch => !searchQuery || branch.name.toLowerCase().includes(searchQuery.toLowerCase()) || branch.location.toLowerCase().includes(searchQuery.toLowerCase())).map((branch) => (
              <div key={branch.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-400/10 text-sky-300">
                      <GitBranch size={20} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-bold text-white">{branch.name}</h3>
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-400">
                        <MapPin size={14} />
                        {branch.location}
                      </p>
                    </div>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${
                    branch.status === 'active'
                      ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'
                      : 'border-slate-400/20 bg-slate-400/10 text-slate-400'
                  }`}>
                    {branch.status}
                  </span>
                </div>

                <div className="mb-5 grid grid-cols-3 gap-2 text-center">
                  <Metric label="Clients" value={branch._count?.clients ?? 0} />
                  <Metric label="Sites" value={branch._count?.sites ?? 0} />
                  <Metric label="Guards" value={branch._count?.guards ?? 0} />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleStatus(branch)}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm font-bold text-slate-200 transition hover:bg-white/10"
                  >
                    <Power size={16} />
                    {branch.status === 'active' ? 'Deactivate' : 'Activate'}
                  </button>
                  <Link
                    href={`/branches/${branch.id}`}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-500/15 px-3 py-2.5 text-sm font-bold text-indigo-200 transition hover:bg-indigo-500/25"
                  >
                    Details
                    <ArrowRight size={16} />
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="glass-card w-full max-w-lg rounded-3xl border-white/10 bg-[#0e0e1a] p-6 shadow-3xl sm:p-8">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-white">Create Branch</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 transition hover:text-white">
                <Plus size={24} className="rotate-45" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-400">Branch Name</span>
                <input
                  value={formData.name}
                  onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-indigo-500/40"
                  placeholder="Tampa Branch"
                  required
                />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-slate-400">Location</span>
                <input
                  value={formData.location}
                  onChange={(event) => setFormData({ ...formData, location: event.target.value })}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-indigo-500/40"
                  placeholder="Tampa, FL"
                  required
                />
              </label>
              <div className="flex flex-col-reverse gap-3 pt-4 sm:flex-row">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 rounded-2xl border border-white/10 bg-white/5 py-3 font-bold text-white transition hover:bg-white/10">
                  Cancel
                </button>
                <button disabled={saving} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary py-3 font-bold text-white transition hover:bg-indigo-500 disabled:opacity-60">
                  {saving && <Loader2 size={18} className="animate-spin" />}
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/5 bg-black/20 px-3 py-2">
      <div className="text-lg font-black text-white">{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</div>
    </div>
  );
}
