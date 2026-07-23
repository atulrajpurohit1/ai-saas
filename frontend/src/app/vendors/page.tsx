'use client';

import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { getApiErrorMessage } from '@/lib/api-error';
import { SECURITY_TYPE_OPTIONS } from '@/lib/rfp';
import { createVendor, deleteVendor, getVendors, updateVendor, Vendor, VendorInput, VendorStatus } from '@/lib/vendors';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  FilePenLine,
  Loader2,
  Mail,
  Phone,
  Plus,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react';

const statusClass: Record<VendorStatus, string> = {
  ACTIVE: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
  INACTIVE: 'border-slate-500/20 bg-slate-500/10 text-slate-400',
};

const inputClass =
  'min-h-11 w-full rounded-xl border border-white/10 bg-white/5 px-4 text-white outline-none focus:ring-2 focus:ring-indigo-500/50';
const labelClass = 'text-sm font-semibold text-slate-300';

const emptyForm: VendorInput = {
  companyName: '',
  contactPerson: '',
  email: '',
  phone: '',
  address: '',
  services: [],
  notes: '',
  status: 'ACTIVE',
};

export default function VendorsPage() {
  const { can } = useAuth();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [form, setForm] = useState<VendorInput>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState('');

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchData = async (searchTerm?: string) => {
    setLoading(true);
    try {
      const data = await getVendors(searchTerm || undefined);
      setVendors(Array.isArray(data) ? data : []);
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load vendors.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSearchSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    fetchData(search);
  };

  const openCreateModal = () => {
    setEditingVendor(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEditModal = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setForm({
      companyName: vendor.companyName,
      contactPerson: vendor.contactPerson || '',
      email: vendor.email || '',
      phone: vendor.phone || '',
      address: vendor.address || '',
      services: vendor.services,
      notes: vendor.notes || '',
      status: vendor.status,
    });
    setShowModal(true);
  };

  const toggleService = (service: string) => {
    setForm((current) => ({
      ...current,
      services: current.services?.includes(service)
        ? current.services.filter((item) => item !== service)
        : [...(current.services || []), service],
    }));
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.companyName.trim()) {
      showToast('Company name is required.', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload: VendorInput = {
        ...form,
        contactPerson: form.contactPerson?.trim() || undefined,
        email: form.email?.trim() || undefined,
        phone: form.phone?.trim() || undefined,
        address: form.address?.trim() || undefined,
        notes: form.notes?.trim() || undefined,
      };

      if (editingVendor) {
        await updateVendor(editingVendor.id, payload);
        showToast('Vendor updated.', 'success');
      } else {
        await createVendor(payload);
        showToast('Vendor created.', 'success');
      }

      setShowModal(false);
      fetchData(search);
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Could not save vendor.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (vendor: Vendor) => {
    if (!confirm(`Delete "${vendor.companyName}"? This cannot be undone.`)) return;
    setActionId(vendor.id);
    try {
      await deleteVendor(vendor.id);
      setVendors((current) => current.filter((item) => item.id !== vendor.id));
      showToast('Vendor deleted.', 'success');
    } catch (err) {
      showToast(getApiErrorMessage(err, 'Could not delete vendor.'), 'error');
    } finally {
      setActionId('');
    }
  };

  return (
    <DashboardLayout requiredPermissions="vendors.view">
      {toast && (
        <div
          className={`fixed left-4 right-4 top-4 z-[200] flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-2xl transition-all sm:left-auto sm:right-6 sm:top-6 sm:max-w-md sm:px-5 sm:py-4 ${
            toast.type === 'success'
              ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
              : 'border-red-500/20 bg-red-500/10 text-red-400'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="flex items-center gap-3 text-2xl font-bold sm:text-3xl">
            <Building2 className="text-indigo-300" size={28} />
            Vendors
          </h2>
          <p className="mt-2 text-muted-foreground">Manage security service vendors and assign them to RFPs.</p>
        </div>
        {can('vendors.create') && (
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3 font-bold text-white shadow-lg transition-all hover:bg-indigo-500"
          >
            <Plus size={20} />
            Add Vendor
          </button>
        )}
      </div>

      <form onSubmit={handleSearchSubmit} className="mb-6 flex gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            className={`${inputClass} pl-11`}
            placeholder="Search by company, contact, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          type="submit"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-white/10"
        >
          Search
        </button>
      </form>

      {error && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-5 py-4 text-sm font-semibold text-rose-300">
          <AlertTriangle size={18} />
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-3xl border border-white/5 bg-white/[0.04]">
        {loading ? (
          <div className="py-20 text-center text-muted-foreground">
            <Loader2 className="mx-auto mb-3 animate-spin text-indigo-300" size={26} />
            Loading vendors...
          </div>
        ) : vendors.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground">
            <Building2 className="mx-auto mb-4 text-indigo-400" size={40} />
            <p className="mb-2 text-lg font-semibold">No vendors found</p>
            <p className="text-sm">Use the &quot;Add Vendor&quot; button to create your first vendor.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="responsive-table w-full text-left">
              <thead>
                <tr className="border-b border-white/5 text-sm uppercase tracking-wider text-muted-foreground">
                  <th className="px-6 py-4 font-semibold">Company</th>
                  <th className="px-6 py-4 font-semibold">Contact Person</th>
                  <th className="px-6 py-4 font-semibold">Email</th>
                  <th className="px-6 py-4 font-semibold">Phone</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {vendors.map((vendor) => (
                  <tr key={vendor.id} className="transition hover:bg-white/5">
                    <td className="px-6 py-4" data-label="Company">
                      <div className="font-semibold text-white">{vendor.companyName}</div>
                      {vendor.services.length > 0 && (
                        <div className="mt-1 text-sm text-slate-500">{vendor.services.join(', ')}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-300" data-label="Contact Person">
                      <div className="flex items-center gap-2">
                        <Users size={14} className="text-indigo-300" />
                        {vendor.contactPerson || '—'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-300" data-label="Email">
                      <div className="flex items-center gap-2">
                        <Mail size={14} className="text-indigo-300" />
                        {vendor.email || '—'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-300" data-label="Phone">
                      <div className="flex items-center gap-2">
                        <Phone size={14} className="text-indigo-300" />
                        {vendor.phone || '—'}
                      </div>
                    </td>
                    <td className="px-6 py-4" data-label="Status">
                      <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-widest ${statusClass[vendor.status]}`}>
                        {vendor.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right" data-label="Actions">
                      <div className="flex flex-wrap justify-end gap-2">
                        {can('vendors.update') && (
                          <button
                            type="button"
                            title="Edit"
                            onClick={() => openEditModal(vendor)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white/5 text-slate-200 transition hover:bg-white/10"
                          >
                            <FilePenLine size={16} />
                          </button>
                        )}
                        {can('vendors.delete') && (
                          <button
                            type="button"
                            title="Delete"
                            onClick={() => handleDelete(vendor)}
                            disabled={actionId === vendor.id}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/10 text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50"
                          >
                            {actionId === vendor.id ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/80 p-3 text-left backdrop-blur-md sm:items-center sm:p-4">
          <div className="glass-card max-h-[calc(100dvh-1.5rem)] w-full max-w-lg overflow-y-auto rounded-3xl border-white/10 bg-[#0e0e1a] p-5 shadow-3xl sm:max-h-[calc(100dvh-2rem)] sm:p-8">
            <div className="mb-6 flex items-start justify-between gap-4">
              <h3 className="text-xl font-bold text-white sm:text-2xl">
                {editingVendor ? 'Edit Vendor' : 'Add Vendor'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                <X size={20} className="text-muted-foreground hover:text-white" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <label className={labelClass}>Company Name *</label>
                <input
                  className={inputClass}
                  value={form.companyName}
                  onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className={labelClass}>Contact Person</label>
                <input
                  className={inputClass}
                  value={form.contactPerson}
                  onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className={labelClass}>Email</label>
                  <input
                    type="email"
                    className={inputClass}
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <label className={labelClass}>Phone</label>
                  <input
                    className={inputClass}
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className={labelClass}>Address</label>
                <input
                  className={inputClass}
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className={labelClass}>Services Offered</label>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {SECURITY_TYPE_OPTIONS.map((service) => {
                    const active = form.services?.includes(service);
                    return (
                      <button
                        key={service}
                        type="button"
                        onClick={() => toggleService(service)}
                        className={`min-h-10 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                          active
                            ? 'border-indigo-400/40 bg-indigo-500 text-white'
                            : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        {service}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2">
                <label className={labelClass}>Notes</label>
                <textarea
                  rows={3}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none focus:ring-2 focus:ring-indigo-500/50"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className={labelClass}>Status</label>
                <select
                  className={inputClass}
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as VendorStatus })}
                >
                  <option value="ACTIVE" className="bg-[#0e0e1a]">Active</option>
                  <option value="INACTIVE" className="bg-[#0e0e1a]">Inactive</option>
                </select>
              </div>

              <div className="mt-6 flex flex-col-reverse gap-3 border-t border-white/5 pt-6 sm:flex-row sm:gap-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 rounded-2xl border border-white/10 bg-white/5 py-3 font-bold text-white transition-all hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary py-3 font-bold text-white shadow-lg transition-all hover:bg-indigo-500 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="animate-spin" size={20} /> : null}
                  {saving ? 'Saving...' : editingVendor ? 'Save Changes' : 'Create Vendor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
