'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import DashboardLayout from '@/components/DashboardLayout';
import LoadingState from '@/components/LoadingState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getApiErrorMessage } from '@/lib/api-error';
import { Branch, getBranch, updateBranch } from '@/lib/branches';
import { cn } from '@/lib/utils';
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
        toast.error(getApiErrorMessage(err, 'Could not load this branch.'));
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
      toast.success('Branch updated.');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not update branch.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-6">
        <Link href="/branches" className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition hover:text-foreground">
          <ArrowLeft size={16} />
          Back to Branches
        </Link>
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Branch Details</h2>
            <p className="text-muted-foreground">Update branch profile and review assigned operational records.</p>
          </div>
          {branch && (
            <span
              className={cn(
                'w-fit rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider',
                branch.status === 'active'
                  ? 'border-success/20 bg-success-wash text-success'
                  : 'border-border bg-muted text-muted-foreground',
              )}
            >
              {branch.status}
            </span>
          )}
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <LoadingState label="Loading branch..." />
        </div>
      ) : branch ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-info-wash text-info">
                <GitBranch size={20} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">Branch Profile</h3>
                <p className="text-sm text-muted-foreground">Name, location, and operating status.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">Branch Name</label>
                <Input
                  value={formData.name}
                  onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">Location</label>
                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-primary" size={16} />
                  <Input
                    value={formData.location}
                    onChange={(event) => setFormData({ ...formData, location: event.target.value })}
                    className="pl-9"
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">Status</label>
                <select
                  value={formData.status}
                  onChange={(event) => setFormData({ ...formData, status: event.target.value })}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <Button type="submit" disabled={saving} className="mt-6 w-full">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save Changes
            </Button>
          </form>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Building2 size={20} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">Assigned Records</h3>
                <p className="text-sm text-muted-foreground">Current records linked to this branch.</p>
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
    <div className="rounded-xl border border-border bg-background p-4 text-center">
      <div className="text-2xl font-semibold text-foreground">{value}</div>
      <div className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
