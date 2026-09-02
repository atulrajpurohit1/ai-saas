'use client';

import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import PageHeader from '@/components/PageHeader';
import LoadingState from '@/components/LoadingState';
import EmptyState from '@/components/EmptyState';
import BranchSelect, { BranchBadge } from '@/components/BranchSelect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import api from '@/lib/api';
import { branchParams, BranchSummary } from '@/lib/branches';
import { Plus, Search, MapPin, Edit2 } from 'lucide-react';

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
}

interface Client {
  id: string;
  name: string;
  companyName: string | null;
}

export default function SitesPage() {
  const [sites, setSites] = useState<Site[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
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

  useEffect(() => {
    fetchSites();
    fetchClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranchId]);

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

  const resetForm = () => {
    setFormData({ name: '', address: '', instructions: '', client_id: '', branch_id: selectedBranchId });
    setIsEditing(null);
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
        <div className="border-b border-border p-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_240px]">
            <div className="relative w-full sm:max-w-sm">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                size={16}
              />
              <Input
                type="text"
                placeholder="Search sites..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
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
          <div className="overflow-x-auto">
            <Table className="responsive-table">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground">Site</TableHead>
                  <TableHead className="px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground">Location</TableHead>
                  <TableHead className="px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground">Client</TableHead>
                  <TableHead className="px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground">Branch</TableHead>
                  <TableHead className="px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground">Created</TableHead>
                  <TableHead className="px-6 py-3" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSites.map((site) => (
                  <TableRow key={site.id}>
                    <TableCell className="px-6 py-3.5 whitespace-normal" data-label="Site">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
                          <MapPin size={16} />
                        </div>
                        <span className="font-semibold text-foreground">{site.name}</span>
                      </div>
                    </TableCell>
                    <TableCell
                      className="px-6 py-3.5 text-sm text-muted-foreground whitespace-normal md:max-w-xs md:truncate"
                      data-label="Location"
                    >
                      {site.address}
                    </TableCell>
                    <TableCell className="px-6 py-3.5 whitespace-normal" data-label="Client">
                      {site.client ? (
                        <span className="inline-flex w-fit items-center rounded-full bg-success-wash px-2.5 py-0.5 text-xs font-semibold text-success">
                          {site.client.companyName || site.client.name}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">Unlinked</span>
                      )}
                    </TableCell>
                    <TableCell className="px-6 py-3.5 whitespace-normal" data-label="Branch">
                      <BranchBadge branch={site.branch} />
                    </TableCell>
                    <TableCell className="px-6 py-3.5 text-sm text-muted-foreground whitespace-normal" data-label="Created">
                      {new Date(site.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="px-6 py-3.5 text-right whitespace-normal" data-label="Actions">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(site)}>
                        <Edit2 size={14} />
                        Edit
                      </Button>
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
