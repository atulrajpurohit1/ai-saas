'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  assignVendorsToRfp,
  getAssignedVendors,
  getVendors,
  removeVendorFromRfp,
  Vendor,
  VendorStatus,
} from '@/lib/vendors';
import { AlertTriangle, Building2, Loader2, Mail, Phone, Plus, Search, Trash2, Users, X } from 'lucide-react';

const statusClass: Record<VendorStatus, string> = {
  ACTIVE: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
  INACTIVE: 'border-slate-500/20 bg-slate-500/10 text-slate-400',
};

interface AssignedVendorsPanelProps {
  rfpId: string;
}

export default function AssignedVendorsPanel({ rfpId }: AssignedVendorsPanelProps) {
  const { can } = useAuth();
  const [assigned, setAssigned] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [removingId, setRemovingId] = useState('');

  const [showAssignModal, setShowAssignModal] = useState(false);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Vendor[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [assigning, setAssigning] = useState(false);

  const canManage = can('rfp.update');

  const fetchAssigned = async () => {
    setLoading(true);
    try {
      const data = await getAssignedVendors(rfpId);
      setAssigned(Array.isArray(data) ? data : []);
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load assigned vendors.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssigned();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rfpId]);

  const openAssignModal = async () => {
    setShowAssignModal(true);
    setSelectedIds([]);
    setSearch('');
    setSearching(true);
    try {
      const data = await getVendors();
      setSearchResults(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load vendors.'));
    } finally {
      setSearching(false);
    }
  };

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    setSearching(true);
    try {
      const data = await getVendors(search || undefined);
      setSearchResults(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not search vendors.'));
    } finally {
      setSearching(false);
    }
  };

  const toggleSelected = (vendorId: string) => {
    setSelectedIds((current) =>
      current.includes(vendorId) ? current.filter((id) => id !== vendorId) : [...current, vendorId],
    );
  };

  const handleAssign = async () => {
    if (selectedIds.length === 0) return;
    setAssigning(true);
    try {
      await assignVendorsToRfp(rfpId, selectedIds);
      setShowAssignModal(false);
      fetchAssigned();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not assign vendor(s) to this RFP.'));
    } finally {
      setAssigning(false);
    }
  };

  const handleRemove = async (vendor: Vendor) => {
    if (!confirm(`Remove "${vendor.companyName}" from this RFP?`)) return;
    setRemovingId(vendor.id);
    try {
      await removeVendorFromRfp(rfpId, vendor.id);
      setAssigned((current) => current.filter((item) => item.id !== vendor.id));
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not remove this vendor.'));
    } finally {
      setRemovingId('');
    }
  };

  const assignedIds = new Set(assigned.map((vendor) => vendor.id));
  const selectableResults = searchResults.filter((vendor) => !assignedIds.has(vendor.id));

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-indigo-400">
          <Building2 size={14} />
          Assigned Vendors
        </h3>
        {canManage && (
          <button
            type="button"
            onClick={openAssignModal}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white transition hover:bg-indigo-500"
          >
            <Plus size={14} />
            Assign Vendors
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-xs font-semibold text-rose-300">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center text-sm text-slate-500">
          <Loader2 className="mx-auto mb-2 animate-spin text-indigo-300" size={20} />
          Loading vendors...
        </div>
      ) : assigned.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 py-8 text-center text-sm text-slate-500">
          No vendors assigned to this RFP yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="responsive-table w-full text-left text-sm">
            <thead>
              <tr className="border-b border-white/5 text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 font-semibold">Company</th>
                <th className="px-4 py-3 font-semibold">Contact Person</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Phone</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                {canManage && <th className="px-4 py-3 text-right font-semibold">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {assigned.map((vendor) => (
                <tr key={vendor.id} className="transition hover:bg-white/5">
                  <td className="px-4 py-3 font-semibold text-white" data-label="Company">
                    {vendor.companyName}
                  </td>
                  <td className="px-4 py-3 text-slate-300" data-label="Contact Person">
                    <div className="flex items-center gap-2">
                      <Users size={12} className="text-indigo-300" />
                      {vendor.contactPerson || '—'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-300" data-label="Email">
                    <div className="flex items-center gap-2">
                      <Mail size={12} className="text-indigo-300" />
                      {vendor.email || '—'}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-300" data-label="Phone">
                    <div className="flex items-center gap-2">
                      <Phone size={12} className="text-indigo-300" />
                      {vendor.phone || '—'}
                    </div>
                  </td>
                  <td className="px-4 py-3" data-label="Status">
                    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${statusClass[vendor.status]}`}>
                      {vendor.status}
                    </span>
                  </td>
                  {canManage && (
                    <td className="px-4 py-3 text-right" data-label="Actions">
                      <button
                        type="button"
                        title="Remove"
                        onClick={() => handleRemove(vendor)}
                        disabled={removingId === vendor.id}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-rose-500/10 text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50"
                      >
                        {removingId === vendor.id ? <Loader2 className="animate-spin" size={14} /> : <Trash2 size={14} />}
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAssignModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/80 p-3 text-left backdrop-blur-md sm:items-center sm:p-4">
          <div className="glass-card flex max-h-[calc(100dvh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border-white/10 bg-[#0e0e1a] shadow-3xl sm:max-h-[85vh]">
            <div className="flex items-center justify-between gap-4 border-b border-white/5 p-5 sm:p-6">
              <h3 className="text-lg font-bold text-white sm:text-xl">Assign Vendors</h3>
              <button onClick={() => setShowAssignModal(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                <X size={20} className="text-muted-foreground hover:text-white" />
              </button>
            </div>

            <div className="border-b border-white/5 p-5 sm:p-6">
              <form onSubmit={handleSearch} className="flex gap-3">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    className="min-h-11 w-full rounded-xl border border-white/10 bg-white/5 pl-11 pr-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50"
                    placeholder="Search vendors by company, contact, or email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <button
                  type="submit"
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-5 text-sm font-bold text-white transition hover:bg-white/10"
                >
                  Search
                </button>
              </form>
            </div>

            <div className="flex-1 overflow-y-auto p-5 sm:p-6">
              {searching ? (
                <div className="py-10 text-center text-sm text-slate-500">
                  <Loader2 className="mx-auto mb-2 animate-spin text-indigo-300" size={20} />
                  Searching...
                </div>
              ) : selectableResults.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-500">No vendors available to assign.</div>
              ) : (
                <div className="space-y-2">
                  {selectableResults.map((vendor) => {
                    const selected = selectedIds.includes(vendor.id);
                    return (
                      <button
                        key={vendor.id}
                        type="button"
                        onClick={() => toggleSelected(vendor.id)}
                        className={`flex w-full items-center justify-between gap-4 rounded-2xl border px-4 py-3 text-left transition ${
                          selected ? 'border-indigo-400/40 bg-indigo-500/10' : 'border-white/10 bg-white/5 hover:bg-white/10'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-white">{vendor.companyName}</div>
                          <div className="text-xs text-slate-500">
                            {vendor.contactPerson || 'No contact'} {vendor.email ? `· ${vendor.email}` : ''}
                          </div>
                        </div>
                        <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${statusClass[vendor.status]}`}>
                          {vendor.status}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-white/5 p-5 sm:flex-row sm:justify-end sm:p-6">
              <button
                type="button"
                onClick={() => setShowAssignModal(false)}
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-bold text-white transition hover:bg-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAssign}
                disabled={assigning || selectedIds.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3 font-bold text-white shadow-lg transition hover:bg-indigo-500 disabled:opacity-50"
              >
                {assigning ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
                Assign {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
