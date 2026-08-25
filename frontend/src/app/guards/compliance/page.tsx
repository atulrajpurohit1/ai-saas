'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { getApiErrorMessage } from '@/lib/api-error';
import {
  ComplianceStatus,
  GUARD_COMPLIANCE_TYPES,
  GUARD_COMPLIANCE_TYPE_LABELS,
  GuardComplianceRecord,
  createGuardCompliance,
  deleteGuardCompliance,
  downloadGuardComplianceDocument,
  getGuardCompliance,
  updateGuardCompliance,
  uploadGuardComplianceDocument,
} from '@/lib/guard-compliance';
import {
  ShieldCheck,
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
} from 'lucide-react';

interface GuardOption {
  id: string;
  name: string;
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

const emptyForm = {
  guard_id: '',
  type: 'guard_license',
  document_number: '',
  issuing_authority: '',
  issue_date: '',
  expiration_date: '',
  notes: '',
};

export default function GuardCompliancePage() {
  return (
    <Suspense fallback={null}>
      <GuardComplianceView />
    </Suspense>
  );
}

function GuardComplianceView() {
  const { can } = useAuth();
  const canManage = can('guards.manage');
  const searchParams = useSearchParams();

  const [records, setRecords] = useState<GuardComplianceRecord[]>([]);
  const [guards, setGuards] = useState<GuardOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState<'all' | ComplianceStatus>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | string>('all');

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
      const [complianceRes, guardsRes] = await Promise.all([
        getGuardCompliance(),
        api.get<GuardOption[]>('v2/guards'),
      ]);
      setRecords(complianceRes);
      setGuards(guardsRes.data);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to load guard compliance data.'));
    } finally {
      setLoading(false);
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
    if (searchQuery && !r.guardName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const resetForm = () => {
    setFormData(emptyForm);
    setEditingId(null);
    setPendingFile(null);
  };

  const openCreateModal = (prefill?: { guardId: string; type: string }) => {
    resetForm();
    if (prefill) setFormData((f) => ({ ...f, guard_id: prefill.guardId, type: prefill.type }));
    setShowModal(true);
  };

  const openEditModal = (record: GuardComplianceRecord) => {
    if (!record.id) return;
    setFormData({
      guard_id: record.guardId,
      type: record.type,
      document_number: record.documentNumber || '',
      issuing_authority: record.issuingAuthority || '',
      issue_date: record.issueDate ? record.issueDate.slice(0, 10) : '',
      expiration_date: record.expirationDate ? record.expirationDate.slice(0, 10) : '',
      notes: record.notes || '',
    });
    setEditingId(record.id);
    setPendingFile(null);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.guard_id) {
      toast.error('Select a guard.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        type: formData.type,
        document_number: formData.document_number.trim() || undefined,
        issuing_authority: formData.issuing_authority.trim() || undefined,
        issue_date: formData.issue_date ? new Date(formData.issue_date).toISOString() : undefined,
        expiration_date: formData.expiration_date ? new Date(formData.expiration_date).toISOString() : undefined,
        notes: formData.notes.trim() || undefined,
      };

      let record: GuardComplianceRecord;
      if (editingId) {
        record = await updateGuardCompliance(editingId, payload);
      } else {
        record = await createGuardCompliance({ guard_id: formData.guard_id, ...payload });
      }

      if (pendingFile && record.id) {
        await uploadGuardComplianceDocument(record.id, pendingFile);
      }

      setShowModal(false);
      resetForm();
      fetchData();
      toast.success(editingId ? 'Compliance record updated.' : 'Compliance record created.');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to save compliance record.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (record: GuardComplianceRecord) => {
    if (!record.id) return;
    if (!window.confirm(`Remove this ${GUARD_COMPLIANCE_TYPE_LABELS[record.type as keyof typeof GUARD_COMPLIANCE_TYPE_LABELS] || record.type} record for ${record.guardName}?`)) return;
    try {
      await deleteGuardCompliance(record.id);
      fetchData();
      toast.success('Compliance record removed.');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to remove compliance record.'));
    }
  };

  const handleDownload = async (record: GuardComplianceRecord) => {
    if (!record.id) return;
    try {
      await downloadGuardComplianceDocument(record.id, record.fileName || `compliance-${record.id}`);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Failed to download document.'));
    }
  };

  const handleQuickUpload = async (record: GuardComplianceRecord, file: File) => {
    if (!record.id) return;
    setUploadingFor(record.id);
    try {
      await uploadGuardComplianceDocument(record.id, file);
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
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h2 className="text-2xl font-bold sm:text-3xl">Guard Compliance</h2>
          <p className="text-muted-foreground">Track guard licenses, certifications, and COI documents.</p>
        </div>
        {canManage && (
          <button
            onClick={() => openCreateModal()}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3 font-bold text-white shadow-lg transition-all hover:bg-indigo-500 sm:w-auto"
          >
            <Plus size={20} />
            <span>Add Record</span>
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

      <div className="glass-card rounded-3xl overflow-hidden border border-white/5">
        <div className="border-b border-white/5 bg-white/5 p-4 sm:p-6 space-y-4">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-2.5 text-muted-foreground" size={18} />
            <input
              type="text"
              placeholder="Search by guard name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 focus:outline-none focus:ring-1 focus:ring-primary"
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
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-muted-foreground focus:outline-none"
            >
              <option value="all" className="bg-[#0e0e1a]">All Types</option>
              {GUARD_COMPLIANCE_TYPES.map((t) => (
                <option key={t} value={t} className="bg-[#0e0e1a]">{GUARD_COMPLIANCE_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="responsive-table w-full text-left">
            <thead>
              <tr className="text-muted-foreground text-sm uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Guard</th>
                <th className="px-6 py-4 font-semibold">Type</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Expiration</th>
                <th className="px-6 py-4 font-semibold">Identifier</th>
                <th className="px-6 py-4 font-semibold">Document</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-muted-foreground">Loading compliance records...</td></tr>
              ) : filteredRecords.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-10 text-center text-muted-foreground">
                  {records.length === 0 ? 'No compliance data yet.' : 'No records match your filters.'}
                </td></tr>
              ) : (
                filteredRecords.map((record) => {
                  const badge = STATUS_BADGE[record.status];
                  const Icon = badge.icon;
                  const key = record.id || `${record.guardId}-${record.type}`;
                  return (
                    <tr key={key} className="hover:bg-white/5 transition-colors group">
                      <td className="px-6 py-4" data-label="Guard">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 shrink-0 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                            <ShieldCheck size={16} />
                          </div>
                          <span className="font-semibold">{record.guardName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 align-middle text-sm" data-label="Type">
                        {GUARD_COMPLIANCE_TYPE_LABELS[record.type as keyof typeof GUARD_COMPLIANCE_TYPE_LABELS] || record.type}
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
                      <td className="px-6 py-4 align-middle text-sm text-muted-foreground" data-label="Identifier">
                        {record.documentNumber || '—'}
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
                                accept=".pdf,.jpg,.jpeg,.png"
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
                              <button onClick={() => openEditModal(record)} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-indigo-400 hover:text-indigo-300" title="Edit">
                                <Edit2 size={16} />
                              </button>
                              <button onClick={() => handleDelete(record)} className="p-2 hover:bg-white/10 rounded-lg transition-colors text-rose-400 hover:text-rose-300" title="Remove">
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => openCreateModal({ guardId: record.guardId, type: record.type })}
                              className="text-xs font-bold text-indigo-300 hover:text-indigo-200"
                            >
                              Add record
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 text-left">
          <div className="glass-card max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-3xl border-white/10 p-5 shadow-3xl animate-in zoom-in-95 duration-200 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold">{editingId ? 'Edit Compliance Record' : 'Add Compliance Record'}</h3>
              <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-white transition-colors">
                <Plus size={24} className="rotate-45" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">Guard</label>
                  <select
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-60"
                    value={formData.guard_id}
                    onChange={(e) => setFormData({ ...formData, guard_id: e.target.value })}
                    disabled={!!editingId}
                    required
                  >
                    <option value="" disabled className="bg-[#0e0e1a]">Select Guard</option>
                    {guards.map((g) => (
                      <option key={g.id} value={g.id} className="bg-[#0e0e1a]">{g.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">Compliance Type</label>
                  <select
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    required
                  >
                    {GUARD_COMPLIANCE_TYPES.map((t) => (
                      <option key={t} value={t} className="bg-[#0e0e1a]">{GUARD_COMPLIANCE_TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">License / Document Number</label>
                  <input
                    type="text"
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    value={formData.document_number}
                    onChange={(e) => setFormData({ ...formData, document_number: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">Issuing Authority</label>
                  <input
                    type="text"
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    value={formData.issuing_authority}
                    onChange={(e) => setFormData({ ...formData, issuing_authority: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">Issue Date</label>
                  <input
                    type="date"
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    value={formData.issue_date}
                    onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">Expiration Date</label>
                  <input
                    type="date"
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    value={formData.expiration_date}
                    onChange={(e) => setFormData({ ...formData, expiration_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">Notes</label>
                <textarea
                  className="min-h-20 w-full resize-y bg-white/5 border border-white/10 rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-muted-foreground">Supporting Document (PDF, JPG, PNG)</label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-xs file:font-bold file:text-white"
                  onChange={(e) => setPendingFile(e.target.files?.[0] || null)}
                />
              </div>

              <div className="mt-8 flex flex-col-reverse gap-3 pt-4 sm:flex-row sm:gap-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-3 rounded-2xl transition-all border border-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-primary hover:bg-indigo-500 text-white font-bold py-3 rounded-2xl transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-60"
                >
                  {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Add Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
