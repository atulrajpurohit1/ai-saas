'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import DashboardLayout from '@/components/DashboardLayout';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import LoadingState from '@/components/LoadingState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getApiErrorMessage } from '@/lib/api-error';
import { Branch, createBranch, getBranches, updateBranch } from '@/lib/branches';
import { cn } from '@/lib/utils';
import { ArrowRight, GitBranch, Loader2, MapPin, Plus, Power, Search } from 'lucide-react';

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({ name: '', location: '' });
  const [togglingId, setTogglingId] = useState('');

  const filteredBranches = branches.filter(
    (branch) =>
      !searchQuery ||
      branch.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      branch.location.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const fetchBranches = async () => {
    setLoading(true);
    try {
      setBranches(await getBranches());
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not load branches.'));
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
      toast.success('Branch created.');
      fetchBranches();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not create branch.'));
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (branch: Branch) => {
    const status = branch.status === 'active' ? 'inactive' : 'active';
    setTogglingId(branch.id);
    try {
      await updateBranch(branch.id, { status });
      toast.success(`Branch ${status === 'active' ? 'activated' : 'deactivated'}.`);
      fetchBranches();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not update branch.'));
    } finally {
      setTogglingId('');
    }
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Branches"
        description="Manage regions, locations, and branch-level operating access."
        actions={
          <Button onClick={() => setShowModal(true)}>
            <Plus size={16} />
            Create Branch
          </Button>
        }
      />

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border p-4 sm:p-6">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <Input
              placeholder="Search branches..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {loading ? (
          <LoadingState label="Loading branches..." />
        ) : filteredBranches.length === 0 ? (
          <EmptyState
            icon={GitBranch}
            title={branches.length === 0 ? 'No branches yet' : 'No matching branches'}
            description={
              branches.length === 0
                ? 'Use the "Create Branch" button to add your first branch.'
                : 'Try a different search term.'
            }
          />
        ) : (
          <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 xl:grid-cols-3">
            {filteredBranches.map((branch) => (
              <div key={branch.id} className="rounded-2xl border border-border bg-background p-5">
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-info-wash text-info">
                      <GitBranch size={20} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-semibold text-foreground">{branch.name}</h3>
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                        <MapPin size={14} />
                        {branch.location}
                      </p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider',
                      branch.status === 'active'
                        ? 'border-success/20 bg-success-wash text-success'
                        : 'border-border bg-muted text-muted-foreground',
                    )}
                  >
                    {branch.status}
                  </span>
                </div>

                <div className="mb-5 grid grid-cols-3 gap-2 text-center">
                  <Metric label="Clients" value={branch._count?.clients ?? 0} />
                  <Metric label="Sites" value={branch._count?.sites ?? 0} />
                  <Metric label="Guards" value={branch._count?.guards ?? 0} />
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => toggleStatus(branch)}
                    disabled={togglingId === branch.id}
                  >
                    {togglingId === branch.id ? <Loader2 size={16} className="animate-spin" /> : <Power size={16} />}
                    {branch.status === 'active' ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button asChild variant="secondary" className="flex-1">
                    <Link href={`/branches/${branch.id}`}>
                      Details
                      <ArrowRight size={16} />
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Branch</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Branch Name</label>
              <Input
                value={formData.name}
                onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                placeholder="Tampa Branch"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Location</label>
              <Input
                value={formData.location}
                onChange={(event) => setFormData({ ...formData, location: event.target.value })}
                placeholder="Tampa, FL"
                required
              />
            </div>
            <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 size={16} className="animate-spin" />}
                Create
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-muted px-3 py-2">
      <div className="text-lg font-semibold text-foreground">{value}</div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
