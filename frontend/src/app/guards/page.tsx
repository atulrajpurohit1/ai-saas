'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import PageHeader from '@/components/PageHeader';
import LoadingState from '@/components/LoadingState';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import BranchSelect, { BranchBadge } from '@/components/BranchSelect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { branchParams, BranchSummary } from '@/lib/branches';
import { FieldAccessMap, getEffectiveFieldPermissions } from '@/lib/field-permissions';
import { Plus, Search, ShieldCheck, Edit2, Phone, Mail, KeyRound, FileCheck2 } from 'lucide-react';

interface Guard {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  salary?: number | null;
  bankDetails?: string | null;
  documents?: string | null;
  personalNotes?: string | null;
  branchId?: string | null;
  branch?: BranchSummary | null;
  createdAt: string;
  availability?: {
    status: string;
  };
}

interface ApiError {
  response?: {
    status?: number;
    data?: {
      message?: string;
    };
  };
}

const fieldInputClass =
  'min-h-24 w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60';

export default function GuardsPage() {
  const [guards, setGuards] = useState<Guard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [fieldAccess, setFieldAccess] = useState<FieldAccessMap>({});
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
    branch_id: '',
    salary: '',
    bank_details: '',
    documents: '',
    personal_notes: '',
  });

  const fetchGuards = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await api.get('v2/guards', { params: branchParams(selectedBranchId) });
      setGuards(res.data);
    } catch (err: unknown) {
      console.error('Fetch Guards Error:', err);
      const status = (err as ApiError).response?.status;
      if (status === 401) {
        setError('Session expired. Please log in again.');
      } else if (status === 403) {
        setError('You do not have permission to view guards.');
      } else if (status === 500) {
        setError('Server error: the database may be temporarily unavailable. Please try again later.');
      } else {
        setError('Failed to load guards. Please check your connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGuards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranchId]);

  useEffect(() => {
    getEffectiveFieldPermissions('guard')
      .then(setFieldAccess)
      .catch((err) => console.error('Failed to load guard field permissions', err));
  }, []);

  const canViewField = (field: string) => fieldAccess[field]?.canView !== false;
  const canEditField = (field: string) => fieldAccess[field]?.canEdit !== false;
  const showSalary = canViewField('salary');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: formData.name.trim(),
        phone: formData.phone.trim() || undefined,
        email: formData.email.trim() || undefined,
        ...(formData.password ? { password: formData.password } : {}),
        branch_id: formData.branch_id || null,
        ...(canEditField('salary') && formData.salary.trim() !== ''
          ? { salary: Number(formData.salary) }
          : {}),
        ...(canEditField('bank_details')
          ? { bank_details: formData.bank_details.trim() || null }
          : {}),
        ...(canEditField('documents')
          ? { documents: formData.documents.trim() || null }
          : {}),
        ...(canEditField('personal_notes')
          ? { personal_notes: formData.personal_notes.trim() || null }
          : {}),
      };

      if (isEditing) {
        await api.put(`v2/guards/${isEditing}`, payload);
      } else {
        await api.post('v2/guards', payload);
      }
      setShowModal(false);
      resetForm();
      fetchGuards();
    } catch (err) {
      console.error(err);
      alert('An error occurred while saving the guard.');
    }
  };

  const handleEdit = (guard: Guard) => {
    setFormData({
      name: guard.name,
      phone: guard.phone || '',
      email: guard.email || '',
      password: '',
      branch_id: guard.branchId || '',
      salary: guard.salary === null || guard.salary === undefined ? '' : String(guard.salary),
      bank_details: guard.bankDetails || '',
      documents: guard.documents || '',
      personal_notes: guard.personalNotes || '',
    });
    setIsEditing(guard.id);
    setShowModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      email: '',
      password: '',
      branch_id: selectedBranchId,
      salary: '',
      bank_details: '',
      documents: '',
      personal_notes: '',
    });
    setIsEditing(null);
  };

  const toggleAvailability = async (guardId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'available' ? 'unavailable' : 'available';
    try {
      await api.put(`v2/guards/${guardId}/availability`, { status: newStatus });
      fetchGuards();
    } catch (err) {
      console.error('Toggle Availability Error:', err);
      alert('Failed to update availability.');
    }
  };

  const filteredGuards = guards.filter(
    (guard) => !searchQuery || guard.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <DashboardLayout>
      <PageHeader
        title="Guards"
        description="Manage your security personnel and assignments."
        actions={
          <Button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
          >
            <Plus size={16} />
            Add New Guard
          </Button>
        }
      />

      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card shadow-sm">
        <div className="border-b border-border p-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_240px]">
            <div className="relative w-full sm:max-w-sm">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                size={16}
              />
              <Input
                type="text"
                placeholder="Search guards..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <BranchSelect value={selectedBranchId} onChange={setSelectedBranchId} label="Filter Branch" />
          </div>
        </div>

        {loading ? (
          <LoadingState label="Loading guards..." />
        ) : error ? (
          <div className="p-4">
            <ErrorState message={error} onRetry={fetchGuards} />
          </div>
        ) : guards.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="No guards yet"
            description="Add your security personnel so you can assign them to sites and shifts."
            action={
              <Button
                onClick={() => {
                  resetForm();
                  setShowModal(true);
                }}
              >
                <Plus size={16} />
                Add New Guard
              </Button>
            }
          />
        ) : filteredGuards.length === 0 ? (
          <EmptyState icon={Search} title="No matching guards" description="Try a different search term." />
        ) : (
          <div className="overflow-x-auto">
            <Table className="responsive-table">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground">Guard</TableHead>
                  <TableHead className="px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground">Contact</TableHead>
                  {showSalary && (
                    <TableHead className="px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground">Salary</TableHead>
                  )}
                  <TableHead className="px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground">Branch</TableHead>
                  <TableHead className="px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground">Availability</TableHead>
                  <TableHead className="px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground">Date Added</TableHead>
                  <TableHead className="px-6 py-3" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGuards.map((guard) => {
                  const availability = guard.availability?.status || 'available';
                  return (
                    <TableRow key={guard.id}>
                      <TableCell className="px-6 py-3.5 whitespace-normal" data-label="Guard">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
                            <ShieldCheck size={16} />
                          </div>
                          <span className="font-semibold text-foreground">{guard.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-3.5 whitespace-normal" data-label="Contact">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Phone size={14} aria-hidden="true" />
                          <span>{guard.phone || 'No phone'}</span>
                        </div>
                        {guard.email && (
                          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                            <Mail size={14} aria-hidden="true" />
                            <span>{guard.email}</span>
                          </div>
                        )}
                      </TableCell>
                      {showSalary && (
                        <TableCell className="px-6 py-3.5 text-sm font-semibold text-foreground whitespace-normal" data-label="Salary">
                          {guard.salary === null || guard.salary === undefined
                            ? 'Not set'
                            : new Intl.NumberFormat(undefined, {
                                style: 'currency',
                                currency: 'USD',
                                maximumFractionDigits: 0,
                              }).format(guard.salary)}
                        </TableCell>
                      )}
                      <TableCell className="px-6 py-3.5 whitespace-normal" data-label="Branch">
                        <BranchBadge branch={guard.branch} />
                      </TableCell>
                      <TableCell className="px-6 py-3.5 whitespace-normal" data-label="Availability">
                        <button
                          type="button"
                          onClick={() => toggleAvailability(guard.id, availability)}
                          className={cn(
                            'inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ring',
                            availability === 'available'
                              ? 'bg-success-wash text-success'
                              : 'bg-error-wash text-error',
                          )}
                        >
                          {availability === 'available' ? 'Available' : 'Unavailable'}
                        </button>
                      </TableCell>
                      <TableCell className="px-6 py-3.5 text-sm text-muted-foreground whitespace-normal" data-label="Date Added">
                        {new Date(guard.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="px-6 py-3.5 text-right whitespace-normal" data-label="Actions">
                        <div className="flex items-center justify-end gap-2">
                          <Button asChild variant="outline" size="sm">
                            <Link
                              href={`/guards/compliance?search=${encodeURIComponent(guard.name)}`}
                              title="View compliance records"
                            >
                              <FileCheck2 size={14} />
                              Compliance
                            </Link>
                          </Button>
                          <Button variant="outline" size="icon-sm" onClick={() => handleEdit(guard)} aria-label={`Edit ${guard.name}`}>
                            <Edit2 size={14} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit Guard' : 'Add New Guard'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Full Name</label>
              <Input
                type="text"
                placeholder="e.g. Michael Smith"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Phone Number</label>
              <Input
                type="tel"
                placeholder="e.g. +1 (555) 000-0000"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Email Address</label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <Input
                  type="email"
                  className="pl-9"
                  placeholder="guard@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Portal Password</label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <Input
                  type="password"
                  minLength={6}
                  className="pl-9"
                  placeholder={isEditing ? 'Leave blank to keep current password' : 'Set guard portal password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
            </div>

            <BranchSelect
              value={formData.branch_id}
              onChange={(branchId) => setFormData({ ...formData, branch_id: branchId })}
              includeAll={false}
            />

            {(canViewField('salary') ||
              canViewField('bank_details') ||
              canViewField('documents') ||
              canViewField('personal_notes')) && (
              <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
                {canViewField('salary') && (
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-muted-foreground">Salary</label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      disabled={!canEditField('salary')}
                      placeholder="e.g. 52000"
                      value={formData.salary}
                      onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                    />
                  </div>
                )}

                {canViewField('bank_details') && (
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-muted-foreground">Bank Details</label>
                    <textarea
                      disabled={!canEditField('bank_details')}
                      className={fieldInputClass}
                      placeholder="Payroll bank details"
                      value={formData.bank_details}
                      onChange={(e) => setFormData({ ...formData, bank_details: e.target.value })}
                    />
                  </div>
                )}

                {canViewField('documents') && (
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-muted-foreground">Documents</label>
                    <textarea
                      disabled={!canEditField('documents')}
                      className={fieldInputClass}
                      placeholder="Private document notes or links"
                      value={formData.documents}
                      onChange={(e) => setFormData({ ...formData, documents: e.target.value })}
                    />
                  </div>
                )}

                {canViewField('personal_notes') && (
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-muted-foreground">Personal Notes</label>
                    <textarea
                      disabled={!canEditField('personal_notes')}
                      className={fieldInputClass}
                      placeholder="Internal personal notes"
                      value={formData.personal_notes}
                      onChange={(e) => setFormData({ ...formData, personal_notes: e.target.value })}
                    />
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button type="submit">{isEditing ? 'Save Changes' : 'Add Guard'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
