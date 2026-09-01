'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { getApiErrorMessage } from '@/lib/api-error';
import { formatEnumLabel } from '@/lib/format';
import {
  ComplianceStatus,
  CLIENT_INSURANCE_TYPES,
  CLIENT_INSURANCE_TYPE_LABELS,
  ClientInsurancePolicy,
  createClientInsurancePolicy,
  deleteClientInsurancePolicy,
  downloadClientInsuranceDocument,
  getClientInsurancePolicies,
  updateClientInsurancePolicy,
  uploadClientInsuranceDocument,
} from '@/lib/client-compliance';
import {
  Building2,
  Search,
  Plus,
  Edit2,
  Trash2,
  Download,
  Upload,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  FileQuestion,
  MapPin,
} from 'lucide-react';

interface ClientOption {
  id: string;
  name: string;
  companyName?: string | null;
}
interface SiteOption {
  id: string;
  name: string;
  clientId?: string | null;
  client?: { id: string } | null;
}

const STATUS_FILTERS: { key: 'all' | ComplianceStatus; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'VALID', label: 'Valid' },
  { key: 'EXPIRING_SOON', label: 'Expiring Soon' },
  { key: 'EXPIRED', label: 'Expired' },
  { key: 'MISSING', label: 'Missing' },
];

const STATUS_BADGE: Record<ComplianceStatus, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  VALID: { label: 'Valid', className: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: CheckCircle2 },
  EXPIRING_SOON: { label: 'Expiring Soon', className: 'bg-amber-500/10 text-amber-400 border-amber-500/20', icon: AlertTriangle },
  EXPIRED: { label: 'Expired', className: 'bg-rose-500/10 text-rose-400 border-rose-500/20', icon: XCircle },
  MISSING: { label: 'Missing', className: 'bg-white/5 text-muted-foreground border-white/10', icon: FileQuestion },
};

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
}

function formatMoney(value: number | null): string {
  if (value === null || value === undefined) return '—';
  return value.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

const emptyForm = {
  client_id: '',
  site_id: '',
  type: 'general_liability',
  policy_number: '',
  insurer: '',
  coverage_amount: '',
  effective_date: '',
  expiration_date: '',
  notes: '',
};

export default function ClientInsurancePage() {
  return (
    <Suspense fallback={null}>
      <ClientInsuranceView />
    </Suspense>
  );
}

function ClientInsuranceView() {
  const { can } = useAuth();
  const canManage = can('clients.manage');
  const searchParams = useSearchParams();

  const [records, setRecords] = useState<ClientInsurancePolicy[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState<'all' | ComplianceStatus>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | string>('all');
  const [clientFilter, setClientFilter] = useState<'all' | string>(searchParams.get('client_id') || 'all');

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [policiesRes, clientsRes] = await Promise.all([
        getClientInsurancePolicies(),
        api.get<ClientOption[]>('clients'),
      ]);
      setRecords(policiesRes);
      setClients(clientsRes.data);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to load client insurance data.'));
    } finally {
      setLoading(false);
    }
    // Sites are optional (needs sites.view) - degrade to client-wide only if unavailable.
    try {
      const sitesRes = await api.get<SiteOption[]>('sites');
      setSites(sitesRes.data);
    } catch {
      setSites([]);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const summary = useMemo(() => {
    const counts = { total: records.length, VALID: 0, EXPIRING_SOON: 0, EXPIRED: 0, MISSING: 0 };
    records.forEach((r) => { counts[r.status] += 1; });
    return counts;
  }, [records]);

  const filteredRecords = records.filter((r) => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (typeFilter !== 'all' && r.type !== typeFilter) return false;
    if (clientFilter !== 'all' && r.clientId !== clientFilter) return false;
    if (searchQuery && !`${r.clientName} ${r.siteName ?? ''} ${r.insurer ?? ''}`.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const sitesForForm = sites.filter(
    (s) => (s.client?.id || s.clientId) === formData.client_id,
  );

  const resetForm = () => {
    setFormData(emptyForm);
    setEditingId(null);
    setPendingFile(null);
  };

  const openCreateModal = (prefill?: { clientId: string; type: string }) => {
    resetForm();
    if (prefill) setFormData((f) => ({ ...f, client_id: prefill.clientId, type: prefill.type }));
    setShowModal(true);
  };

  const openEditModal = (record: ClientInsurancePolicy) => {
    if (!record.id) return;
    setFormData({
      client_id: record.clientId,
      site_id: record.siteId || '',
      type: record.type,
      policy_number: record.policyNumber || '',
      insurer: record.insurer || '',
      coverage_amount: record.coverageAmount != null ? String(record.coverageAmount) : '',
      effective_date: record.effectiveDate ? record.effectiveDate.slice(0, 10) : '',
      expiration_date: record.expirationDate ? record.expirationDate.slice(0, 10) : '',
      notes: record.notes || '',
    });
    setEditingId(record.id);
    setPendingFile(null);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.client_id) {
      toast.error('Select a client.');
      return;
    }
    const coverage = formData.coverage_amount.trim() ? Number(formData.coverage_amount) : undefined;
    if (coverage !== undefined && (!Number.isFinite(coverage) || coverage < 0)) {
      toast.error('Coverage amount must be a positive number.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        site_id: formData.site_id || null,
        type: formData.type,
        policy_number: formData.policy_number.trim() || undefined,
        insurer: formData.insurer.trim() || undefined,
        coverage_amount: coverage,
        effective_date: formData.effective_date ? new Date(formData.effective_date).toISOString() : undefined,
        expiration_date: formData.expiration_date ? new Date(formData.expiration_date).toISOString() : undefined,
        notes: formData.notes.trim() || undefined,
      };

      let record: ClientInsurancePolicy;
      if (editingId) {
        record = await updateClientInsurancePolicy(editingId, payload);
      } else {
        record = await createClientInsurancePolicy({ client_id: formData.client_id, ...payload });
      }

      if (pendingFile && record.id) {
        await uploadClientInsuranceDocument(record.id, pendingFile);
      }

      setShowModal(false);
      resetForm();
      fetchData();
      toast.success(editingId ? 'Insurance policy updated.' : 'Insurance policy created.');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to save insurance policy.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (record: ClientInsurancePolicy) => {
    if (!record.id) return;
    const label = CLIENT_INSURANCE_TYPE_LABELS[record.type as keyof typeof CLIENT_INSURANCE_TYPE_LABELS] || formatEnumLabel(record.type);
    if (!window.confirm(`Remove this ${label} policy for ${record.clientName}?`)) return;
    try {
      await deleteClientInsurancePolicy(record.id);
      fetchData();
      toast.success('Insurance policy removed.');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to remove insurance policy.'));
    }
  };

  const handleDownload = async (record: ClientInsurancePolicy) => {
    if (!record.id) return;
    try {
      await downloadClientInsuranceDocument(record.id, record.fileName || `insurance-${record.id}`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to download document.'));
    }
  };

  const handleQuickUpload = async (record: ClientInsurancePolicy, file: File) => {
    if (!record.id) return;
    setUploadingFor(record.id);
    try {
      await uploadClientInsuranceDocument(record.id, file);
      fetchData();
      toast.success('Document uploaded.');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to upload document.'));
    } finally {
      setUploadingFor(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <h2 className="text-2xl font-bold sm:text-3xl">Client Insurance & COI</h2>
          <p className="text-muted-foreground">
            Track client and site insurance policies and Certificate-of-Insurance documents.
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => openCreateModal()}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3 font-bold text-white shadow-lg transition-all hover:bg-indigo-500 sm:w-auto"
          >
            <Plus size={20} />
            <span>Add Policy</span>
          </button>
        )}
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-5 py-4 text-sm font-medium text-rose-300">
          {error}
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {([
          ['Total', summary.total, 'text-white'],
          ['Valid', summary.VALID, 'text-emerald-400'],
          ['Expiring Soon', summary.EXPIRING_SOON, 'text-amber-400'],
          ['Expired', summary.EXPIRED, 'text-rose-400'],
          ['Missing', summary.MISSING, 'text-slate-400'],
        ] as const).map(([label, value, colorClass]) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
            <div className={`mt-1 text-2xl font-black ${colorClass}`}>{value}</div>
          </div>
        ))}
      </div>

      <div className="glass-card overflow-hidden rounded-3xl border border-white/5">
        <div className="space-y-4 border-b border-white/5 bg-white/5 p-4 sm:p-6">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-2.5 text-muted-foreground" size={18} />
            <input
              type="text"
              placeholder="Search by client, site, or insurer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-10 pr-4 focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={`rounded-full px-3 py-1.5 text-xs font-bold transition-all ${
                  statusFilter === f.key ? 'bg-primary text-white' : 'bg-white/5 text-muted-foreground hover:bg-white/10'
                }`}
              >
                {f.label}
              </button>
            ))}
            <select
              value={clientFilter}
              onChange={(e) => setClientFilter(e.target.value)}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-muted-foreground focus:outline-none"
            >
              <option value="all" className="bg-[#0e0e1a]">All Clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id} className="bg-[#0e0e1a]">{c.companyName || c.name}</option>
              ))}
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-muted-foreground focus:outline-none"
            >
              <option value="all" className="bg-[#0e0e1a]">All Types</option>
              {CLIENT_INSURANCE_TYPES.map((t) => (
                <option key={t} value={t} className="bg-[#0e0e1a]">{CLIENT_INSURANCE_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="responsive-table w-full text-left">
            <thead>
              <tr className="text-sm uppercase tracking-wider text-muted-foreground">
                <th className="px-6 py-4 font-semibold">Client</th>
                <th className="px-6 py-4 font-semibold">Scope</th>
                <th className="px-6 py-4 font-semibold">Type</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Expiration</th>
                <th className="px-6 py-4 font-semibold">Coverage</th>
                <th className="px-6 py-4 font-semibold">Document</th>
                <th className="px-6 py-4 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr><td colSpan={8} className="px-6 py-10 text-center text-muted-foreground">Loading insurance policies...</td></tr>
              ) : filteredRecords.length === 0 ? (
                <tr><td colSpan={8} className="px-6 py-10 text-center text-muted-foreground">
                  {records.length === 0 ? 'No insurance policies yet.' : 'No policies match your filters.'}
                </td></tr>
              ) : (
                filteredRecords.map((record) => {
                  const badge = STATUS_BADGE[record.status];
                  const Icon = badge.icon;
                  const key = record.id || `${record.clientId}-${record.type}`;
                  return (
                    <tr key={key} className="group transition-colors hover:bg-white/5">
                      <td className="px-6 py-4" data-label="Client">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400">
                            <Building2 size={16} />
                          </div>
                          <span className="font-semibold">{record.clientName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 align-middle text-sm text-muted-foreground" data-label="Scope">
                        {record.siteId ? (
                          <span className="inline-flex items-center gap-1"><MapPin size={12} />{record.siteName || 'Site'}</span>
                        ) : 'Client-wide'}
                      </td>
                      <td className="px-6 py-4 align-middle text-sm" data-label="Type">
                        {CLIENT_INSURANCE_TYPE_LABELS[record.type as keyof typeof CLIENT_INSURANCE_TYPE_LABELS] || formatEnumLabel(record.type)}
                      </td>
                      <td className="px-6 py-4 align-middle" data-label="Status">
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${badge.className}`}>
                          <Icon size={12} />
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 align-middle text-sm text-muted-foreground" data-label="Expiration">
                        {formatDate(record.expirationDate)}
                      </td>
                      <td className="px-6 py-4 align-middle text-sm text-muted-foreground" data-label="Coverage">
                        {formatMoney(record.coverageAmount)}
                      </td>
                      <td className="px-6 py-4 align-middle" data-label="Document">
                        {record.id ? (
                          record.hasDocument ? (
                            <button
                              onClick={() => handleDownload(record)}
                              className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-300 hover:text-indigo-200"
                            >
                              <Download size={13} />
                              {record.fileName ? record.fileName.slice(0, 18) : 'Download'}
                            </button>
                          ) : canManage ? (
                            <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-white">
                              {uploadingFor === record.id ? <Loader2 className="animate-spin" size={13} /> : <Upload size={13} />}
                              Upload
                              <input
                                type="file"
                                accept=".pdf,.jpg,.jpeg,.png,.webp"
                                className="hidden"
                                onChange={(e) => e.target.files?.[0] && handleQuickUpload(record, e.target.files[0])}
                              />
                            </label>
                          ) : (
                            <span className="text-xs text-muted-foreground">None</span>
                          )
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right align-middle" data-label="Actions">
                        {canManage && (
                          record.id ? (
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => openEditModal(record)} className="rounded-lg p-2 text-indigo-400 transition-colors hover:bg-white/10 hover:text-indigo-300" title="Edit">
                                <Edit2 size={16} />
                              </button>
                              <button onClick={() => handleDelete(record)} className="rounded-lg p-2 text-rose-400 transition-colors hover:bg-white/10 hover:text-rose-300" title="Remove">
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => openCreateModal({ clientId: record.clientId, type: record.type })}
                              className="text-xs font-bold text-indigo-300 hover:text-indigo-200"
                            >
                              Add policy
                            </button>
                          )
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 text-left backdrop-blur-sm">
          <div className="glass-card max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-3xl border-white/10 p-5 shadow-3xl animate-in zoom-in-95 duration-200 sm:p-8">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="text-2xl font-bold">{editingId ? 'Edit Insurance Policy' : 'Add Insurance Policy'}</h3>
              <button onClick={() => setShowModal(false)} className="text-muted-foreground transition-colors hover:text-white">
                <Plus size={24} className="rotate-45" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">Client</label>
                  <select
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-60"
                    value={formData.client_id}
                    onChange={(e) => setFormData({ ...formData, client_id: e.target.value, site_id: '' })}
                    disabled={!!editingId}
                    required
                  >
                    <option value="" disabled className="bg-[#0e0e1a]">Select Client</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id} className="bg-[#0e0e1a]">{c.companyName || c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">Scope</label>
                  <select
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-60"
                    value={formData.site_id}
                    onChange={(e) => setFormData({ ...formData, site_id: e.target.value })}
                    disabled={!formData.client_id}
                  >
                    <option value="" className="bg-[#0e0e1a]">Client-wide</option>
                    {sitesForForm.map((s) => (
                      <option key={s.id} value={s.id} className="bg-[#0e0e1a]">{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">Insurance Type</label>
                  <select
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    required
                  >
                    {CLIENT_INSURANCE_TYPES.map((t) => (
                      <option key={t} value={t} className="bg-[#0e0e1a]">{CLIENT_INSURANCE_TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">Policy Number</label>
                  <input
                    type="text"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    value={formData.policy_number}
                    onChange={(e) => setFormData({ ...formData, policy_number: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">Insurer</label>
                  <input
                    type="text"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    value={formData.insurer}
                    onChange={(e) => setFormData({ ...formData, insurer: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">Coverage Amount (USD)</label>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    value={formData.coverage_amount}
                    onChange={(e) => setFormData({ ...formData, coverage_amount: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">Effective Date</label>
                  <input
                    type="date"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    value={formData.effective_date}
                    onChange={(e) => setFormData({ ...formData, effective_date: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">Expiration Date</label>
                  <input
                    type="date"
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    value={formData.expiration_date}
                    onChange={(e) => setFormData({ ...formData, expiration_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">Notes</label>
                <textarea
                  className="min-h-20 w-full resize-y rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">Certificate / Document (PDF, JPG, PNG, WEBP)</label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  className="w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-xs file:font-bold file:text-white"
                  onChange={(e) => setPendingFile(e.target.files?.[0] || null)}
                />
              </div>

              <div className="mt-8 flex flex-col-reverse gap-3 pt-4 sm:flex-row sm:gap-4">
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
                  className="flex-1 rounded-2xl bg-primary py-3 font-bold text-white shadow-lg shadow-indigo-500/20 transition-all hover:bg-indigo-500 disabled:opacity-60"
                >
                  {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Add Policy'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
