'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import DashboardLayout from '@/components/DashboardLayout';
import PageHeader from '@/components/PageHeader';
import StatusBadge, { type StatusTone } from '@/components/StatusBadge';
import EmptyState from '@/components/EmptyState';
import LoadingState from '@/components/LoadingState';
import ErrorState from '@/components/ErrorState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/context/AuthContext';
import { getApiErrorMessage } from '@/lib/api-error';
import { SECURITY_TYPE_OPTIONS } from '@/lib/rfp';
import { createVendor, deleteVendor, getVendors, updateVendor, Vendor, VendorInput, VendorStatus } from '@/lib/vendors';
import { cn } from '@/lib/utils';
import {
  Building2,
  FilePenLine,
  Loader2,
  Mail,
  Phone,
  Plus,
  Search,
  Trash2,
  Users,
} from 'lucide-react';

const STATUS_TONE: Record<VendorStatus, StatusTone> = {
  ACTIVE: 'success',
  INACTIVE: 'neutral',
};

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

  const [showModal, setShowModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [form, setForm] = useState<VendorInput>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState('');

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
      toast.error('Company name is required.');
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
        toast.success('Vendor updated.');
      } else {
        await createVendor(payload);
        toast.success('Vendor created.');
      }

      setShowModal(false);
      fetchData(search);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not save vendor.'));
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
      toast.success('Vendor deleted.');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not delete vendor.'));
    } finally {
      setActionId('');
    }
  };

  return (
    <DashboardLayout requiredPermissions="vendors.view">
      <PageHeader
        title="Vendors"
        description="Manage security service vendors and assign them to RFPs."
        actions={
          can('vendors.create') && (
            <Button onClick={openCreateModal}>
              <Plus size={16} />
              Add Vendor
            </Button>
          )
        }
      />

      <form onSubmit={handleSearchSubmit} className="mb-6 flex gap-3">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by company, contact, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      {error && (
        <div className="mb-6">
          <ErrorState message={error} onRetry={() => fetchData(search)} />
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {loading ? (
          <LoadingState label="Loading vendors..." />
        ) : vendors.length === 0 ? (
          <EmptyState icon={Building2} title="No vendors found" description='Use the "Add Vendor" button to create your first vendor.' />
        ) : (
          <div className="overflow-x-auto">
            <Table className="responsive-table">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground">Company</TableHead>
                  <TableHead className="px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground">Contact Person</TableHead>
                  <TableHead className="px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground">Email</TableHead>
                  <TableHead className="px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground">Phone</TableHead>
                  <TableHead className="px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground">Status</TableHead>
                  <TableHead className="px-6 py-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendors.map((vendor) => (
                  <TableRow key={vendor.id}>
                    <TableCell className="px-6 py-4 whitespace-normal" data-label="Company">
                      <div className="font-semibold text-foreground">{vendor.companyName}</div>
                      {vendor.services.length > 0 && (
                        <div className="mt-1 text-sm text-muted-foreground">{vendor.services.join(', ')}</div>
                      )}
                    </TableCell>
                    <TableCell className="px-6 py-4 text-sm whitespace-normal text-foreground" data-label="Contact Person">
                      <div className="flex items-center gap-2">
                        <Users size={14} className="text-primary" />
                        {vendor.contactPerson || '—'}
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4 text-sm whitespace-normal text-foreground" data-label="Email">
                      <div className="flex items-center gap-2">
                        <Mail size={14} className="text-primary" />
                        {vendor.email || '—'}
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4 text-sm whitespace-normal text-foreground" data-label="Phone">
                      <div className="flex items-center gap-2">
                        <Phone size={14} className="text-primary" />
                        {vendor.phone || '—'}
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4 whitespace-normal" data-label="Status">
                      <StatusBadge label={vendor.status} tone={STATUS_TONE[vendor.status]} />
                    </TableCell>
                    <TableCell className="px-6 py-4 text-right whitespace-normal" data-label="Actions">
                      <div className="flex flex-wrap justify-end gap-2">
                        {can('vendors.update') && (
                          <Button variant="outline" size="icon-sm" title="Edit" onClick={() => openEditModal(vendor)}>
                            <FilePenLine size={16} />
                          </Button>
                        )}
                        {can('vendors.delete') && (
                          <Button
                            variant="outline"
                            size="icon-sm"
                            title="Delete"
                            onClick={() => handleDelete(vendor)}
                            disabled={actionId === vendor.id}
                            className="border-error/20 bg-error-wash text-error hover:bg-error-wash hover:text-error"
                          >
                            {actionId === vendor.id ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingVendor ? 'Edit Vendor' : 'Add Vendor'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Company Name *</label>
              <Input
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Contact Person</label>
              <Input
                value={form.contactPerson}
                onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">Email</label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">Phone</label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Address</label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Services Offered</label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {SECURITY_TYPE_OPTIONS.map((service) => {
                  const active = form.services?.includes(service);
                  return (
                    <button
                      key={service}
                      type="button"
                      onClick={() => toggleService(service)}
                      className={cn(
                        'min-h-10 rounded-lg border px-3 py-2 text-xs font-semibold transition',
                        active
                          ? 'border-primary/30 bg-primary text-white'
                          : 'border-border bg-card text-muted-foreground hover:bg-muted',
                      )}
                    >
                      {service}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Notes</label>
              <textarea
                rows={3}
                className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Status</label>
              <select
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as VendorStatus })}
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="animate-spin" size={16} /> : null}
                {saving ? 'Saving...' : editingVendor ? 'Save Changes' : 'Create Vendor'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
