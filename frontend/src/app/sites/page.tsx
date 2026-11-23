'use client';

import { formatDate as fmtDate } from '@/lib/format';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import PageHeader from '@/components/PageHeader';
import LoadingState from '@/components/LoadingState';
import EmptyState from '@/components/EmptyState';
import BranchSelect from '@/components/BranchSelect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import SearchField from '@/components/SearchField';
import api from '@/lib/api';
import { branchParams, BranchSummary } from '@/lib/branches';
import { useNewIntent } from '@/hooks/useNewIntent';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { Plus, Search, MapPin, Edit2, AlertTriangle, Loader2 } from 'lucide-react';

interface Site {
  id: string;
  name: string;
  address: string;
  instructions: string | null;
  clientId: string | null;
  branchId?: string | null;
  branch?: BranchSummary | null;
  client?: {
    id: string;
    name: string;
    companyName: string | null;
  } | null;
  createdAt: string;
  autoAssignGuards: boolean;
  counts?: {
    checkpoints: number;
    routes: number;
    shifts: number;
  };
  /** False when the site has no route, or a route with no checkpoints. */
  patrolReady?: boolean;
}

interface Client {
  id: string;
  name: string;
  companyName: string | null;
}

export default function SitesPage() {
  const { can } = useAuth();
  const canManageSites = can('sites.manage');
  const [sites, setSites] = useState<Site[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoAssigningSiteId, setAutoAssigningSiteId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', address: '', instructions: '', client_id: '', branch_id: '' });

  const fetchSites = async () => {
    try {
      const res = await api.get('sites', { params: branchParams(selectedBranchId) });
      setSites(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async () => {
    try {
      const res = await api.get('clients', { params: branchParams(selectedBranchId) });
      setClients(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error(err);
    }
  };

  const resetForm = () => {
    setFormData({ name: '', address: '', instructions: '', client_id: '', branch_id: selectedBranchId });
    setIsEditing(null);
  };

  useEffect(() => {
    fetchSites();
    fetchClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranchId]);

  useNewIntent(() => {
    resetForm();
    setShowModal(true);
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        client_id: formData.client_id || null,
        branch_id: formData.branch_id || null,
      };
      if (isEditing) {
        await api.put(`sites/${isEditing}`, payload);
      } else {
        await api.post('sites', payload);
      }
      setShowModal(false);
      resetForm();
      fetchSites();
    } catch (err) {
      console.error(err);
      alert('An error occurred while saving the site.');
    }
  };

  const handleEdit = (site: Site) => {
    setFormData({
      name: site.name,
      address: site.address,
      instructions: site.instructions || '',
      client_id: site.clientId || '',
      branch_id: site.branchId || '',
    });
    setIsEditing(site.id);
    setShowModal(true);
  };

  const handleAutoAssignmentToggle = async (site: Site) => {
    if (!canManageSites || autoAssigningSiteId) return;

    const enabled = !site.autoAssignGuards;
    setAutoAssigningSiteId(site.id);

    try {
      const response = await api.put(`sites/${site.id}/auto-assignment`, { enabled });
      const updated = response.data as Site & {
        autoAssignment?: {
          guardsAssigned: number;
          shiftsStillOpen: number;
        } | null;
      };

      setSites((current) =>
        current.map((item) =>
          item.id === site.id
            ? {
                ...item,
                ...updated,
                counts: item.counts,
                patrolReady: item.patrolReady,
              }
            : item,
        ),
      );

      if (!enabled) {
        toast.success(`Automatic guard assignment is off for ${site.name}.`, {
          description: 'Existing assignments are unchanged.',
        });
        return;
      }

      const assigned = updated.autoAssignment?.guardsAssigned ?? 0;
      const stillOpen = updated.autoAssignment?.shiftsStillOpen ?? 0;
      toast.success(
        assigned > 0
          ? `${assigned} guard${assigned === 1 ? '' : 's'} assigned automatically for ${site.name}.`
          : `Automatic guard assignment is on for ${site.name}.`,
        stillOpen > 0
          ? { description: `${stillOpen} upcoming shift${stillOpen === 1 ? '' : 's'} still need coverage.` }
          : undefined,
      );
    } catch (error) {
      const message =
        (error as { response?: { data?: { message?: string } } }).response?.data?.message ||
        'Could not update automatic guard assignment.';
      toast.error(message);
    } finally {
      setAutoAssigningSiteId(null);
    }
  };

  const filteredSites = sites.filter(
    (site) => !searchQuery || site.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <DashboardLayout>
      <PageHeader
        title="Sites"
        description="Manage your physical security locations and assignments."
        actions={
          <Button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
          >
            <Plus size={16} />
            Create Site
          </Button>
        }
      />

      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card shadow-sm">
        <div className="border-b border-border p-4 sm:p-5">
          <div className="grid items-end gap-4 md:grid-cols-[minmax(0,420px)_minmax(220px,300px)] md:justify-between">
            <SearchField
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search sites..."
              className="w-full"
            />
            <BranchSelect value={selectedBranchId} onChange={setSelectedBranchId} label="Filter Branch" />
          </div>
        </div>

        {loading ? (
          <LoadingState label="Loading sites..." />
        ) : sites.length === 0 ? (
          <EmptyState
            icon={MapPin}
            title="No sites yet"
            description="Add the physical locations your guards are assigned to protect."
            action={
              <Button
                onClick={() => {
                  resetForm();
                  setShowModal(true);
                }}
              >
                <Plus size={16} />
                Create Site
              </Button>
            }
          />
        ) : filteredSites.length === 0 ? (
          <EmptyState icon={Search} title="No matching sites" description="Try a different search term." />
        ) : (
          <div className="divide-y divide-border">
            {filteredSites.map((site) => {
              const checkpointCount = site.counts?.checkpoints ?? 0;
              const routeCount = site.counts?.routes ?? 0;
              const shiftCount = site.counts?.shifts ?? 0;
              const isUpdatingAutoAssignment = autoAssigningSiteId === site.id;

              return (
                <article
                  key={site.id}
                  aria-labelledby={`site-${site.id}-name`}
                  className="p-4 transition-colors hover:bg-muted/30 sm:p-5"
                >
                  <div className="grid gap-5 lg:grid-cols-2 lg:items-start 2xl:grid-cols-[minmax(260px,1.35fr)_minmax(300px,1fr)_minmax(240px,.8fr)_auto] 2xl:items-center">
                    <div className="min-w-0">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <MapPin size={18} aria-hidden="true" />
                        </div>
                        <div className="min-w-0">
                          <h2 id={`site-${site.id}-name`} className="break-words text-base font-semibold text-foreground">
                            {site.name}
                          </h2>
                          <p className="mt-1 break-words text-sm leading-5 text-muted-foreground">
                            {site.address}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2 text-sm">
                        <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 text-muted-foreground">
                          <span className="shrink-0">Client</span>
                          <span className="min-w-0 break-words font-medium text-foreground">
                            {site.client ? site.client.companyName || site.client.name : 'Unlinked'}
                          </span>
                        </span>
                        <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 text-muted-foreground">
                          <span className="shrink-0">Branch</span>
                          <span className="min-w-0 break-words font-medium text-foreground">
                            {site.branch?.name || 'Unassigned'}
                          </span>
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 text-muted-foreground">
                          <span>Created</span>
                          <span className="font-medium text-foreground">{fmtDate(site.createdAt)}</span>
                        </span>
                      </div>
                    </div>

                    <div className="min-w-0">
                      <p className="mb-2 text-sm font-semibold text-foreground">Site setup</p>
                      <div className="grid grid-cols-3 gap-2">
                        <Link
                          href={`/patrol/checkpoints?site_id=${encodeURIComponent(site.id)}`}
                          aria-label={`View ${checkpointCount} checkpoints for ${site.name}`}
                          className="min-w-0 rounded-lg border border-border bg-background px-2 py-2.5 text-center transition hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <span className="block text-lg font-bold leading-none text-foreground">{checkpointCount}</span>
                          <span className="mt-1 block truncate text-sm text-muted-foreground">Checkpoints</span>
                        </Link>
                        <Link
                          href={`/patrol/routes?site_id=${encodeURIComponent(site.id)}`}
                          aria-label={`View ${routeCount} patrol routes for ${site.name}`}
                          className="min-w-0 rounded-lg border border-border bg-background px-2 py-2.5 text-center transition hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <span className="block text-lg font-bold leading-none text-foreground">{routeCount}</span>
                          <span className="mt-1 block truncate text-sm text-muted-foreground">Routes</span>
                        </Link>
                        <Link
                          href={`/shifts?site_id=${encodeURIComponent(site.id)}`}
                          aria-label={`View ${shiftCount} shifts for ${site.name}`}
                          className="min-w-0 rounded-lg border border-border bg-background px-2 py-2.5 text-center transition hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <span className="block text-lg font-bold leading-none text-foreground">{shiftCount}</span>
                          <span className="mt-1 block truncate text-sm text-muted-foreground">Shifts</span>
                        </Link>
                      </div>

                      {site.patrolReady === false && (
                        <Link
                          href={`/patrol/routes?site_id=${encodeURIComponent(site.id)}`}
                          className="mt-2 flex max-w-full items-start gap-2 rounded-lg border border-warning/20 bg-warning-wash px-3 py-2 text-sm font-medium leading-5 text-warning transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                          <span>
                            {routeCount === 0
                              ? 'Patrol setup needed: add a route'
                              : 'Patrol setup needed: a route has no checkpoints'}
                          </span>
                        </Link>
                      )}
                    </div>

                    <div className="rounded-lg border border-border bg-muted/35 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0" aria-live="polite">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-foreground">Auto assignment</p>
                            <span
                              className={`text-sm font-semibold ${
                                site.autoAssignGuards ? 'text-success' : 'text-muted-foreground'
                              }`}
                            >
                              {site.autoAssignGuards ? 'On' : 'Off'}
                            </span>
                          </div>
                          <p className="mt-1 text-sm leading-5 text-muted-foreground">
                            {isUpdatingAutoAssignment
                              ? 'Updating assignment settings...'
                              : site.autoAssignGuards
                                ? 'Eligible guards fill open shift slots automatically.'
                                : 'Guards are assigned manually.'}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {isUpdatingAutoAssignment && (
                            <Loader2 size={16} className="animate-spin text-primary" aria-hidden="true" />
                          )}
                          <button
                            type="button"
                            role="switch"
                            aria-checked={site.autoAssignGuards}
                            aria-label={`${site.autoAssignGuards ? 'Turn off' : 'Turn on'} automatic guard assignment for ${site.name}`}
                            title={canManageSites ? undefined : 'You need site management permission to change this setting'}
                            disabled={!canManageSites || autoAssigningSiteId !== null}
                            onClick={() => handleAutoAssignmentToggle(site)}
                            className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
                              site.autoAssignGuards
                                ? 'border-primary bg-primary'
                                : 'border-input bg-background'
                            }`}
                          >
                            <span
                              className={`block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                                site.autoAssignGuards ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex lg:justify-end 2xl:justify-self-end">
                      <Button
                        variant="outline"
                        onClick={() => handleEdit(site)}
                        disabled={!canManageSites}
                        className="w-full lg:w-auto"
                      >
                        <Edit2 size={16} />
                        Edit site
                      </Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit Site' : 'Create New Site'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Site Name</label>
              <Input
                type="text"
                placeholder="e.g. Downtown Corporate Office"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Address</label>
              <Input
                type="text"
                placeholder="e.g. 123 Main St, New York, NY 10001"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Special Instructions (Optional)</label>
              <textarea
                className="min-h-[100px] w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                placeholder="e.g. Keycard required for back entrance. Contact Jane on arrival."
                value={formData.instructions}
                onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Client (Optional)</label>
              <select
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none transition focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                value={formData.client_id}
                onChange={(e) => setFormData({ ...formData, client_id: e.target.value })}
              >
                <option value="">No linked client</option>
                {clients.length === 0 && (
                  <option value="" disabled>
                    Create a client first
                  </option>
                )}
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.companyName || client.name}
                  </option>
                ))}
              </select>
            </div>

            <BranchSelect
              value={formData.branch_id}
              onChange={(branchId) => setFormData({ ...formData, branch_id: branchId })}
              includeAll={false}
            />

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button type="submit">{isEditing ? 'Save Changes' : 'Create Site'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
