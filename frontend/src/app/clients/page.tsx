'use client';

import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import DashboardLayout from '@/components/DashboardLayout';
import PageHeader from '@/components/PageHeader';
import LoadingState from '@/components/LoadingState';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import ConfirmDialog from '@/components/ConfirmDialog';
import BranchSelect, { BranchBadge } from '@/components/BranchSelect';
import InsuranceAdvisoryBanner from '@/components/InsuranceAdvisoryBanner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import api from '@/lib/api';
import { getApiErrorMessage } from '@/lib/api-error';
import { branchParams, BranchSummary } from '@/lib/branches';
import { FieldAccessMap, getEffectiveFieldPermissions } from '@/lib/field-permissions';
import { useNewIntent } from '@/hooks/useNewIntent';
import { Plus, Search, User, Mail, Phone, Building, Edit2, Folder, FileText, Download, Trash2, Loader2, Users } from 'lucide-react';

interface Client {
  id: string;
  name: string;
  companyName: string;
  email: string;
  phone: string;
  billingNotes?: string | null;
  internalNotes?: string | null;
  branchId?: string | null;
  branch?: BranchSummary | null;
  createdAt: string;
  users: { email: string }[];
}

interface SharedDocument {
  id: string;
  name: string;
  url: string;
  description?: string;
  createdAt: string;
}

const fieldInputClass =
  'min-h-24 w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60';

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [fieldAccess, setFieldAccess] = useState<FieldAccessMap>({});
  const [formData, setFormData] = useState({
    name: '',
    companyName: '',
    email: '',
    phone: '',
    branch_id: '',
    billing_notes: '',
    internal_notes: '',
  });

  // Document management state
  const [showDocsModal, setShowDocsModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [documents, setDocuments] = useState<SharedDocument[]>([]);
  const [docLoading, setDocLoading] = useState(false);
  const [newDoc, setNewDoc] = useState({ name: '', url: '', description: '' });
  const [isUploading, setIsUploading] = useState(false);
  const [docError, setDocError] = useState('');

  const [createUserTarget, setCreateUserTarget] = useState<Client | null>(null);
  const [creatingUser, setCreatingUser] = useState(false);
  const [removeDocTarget, setRemoveDocTarget] = useState<string | null>(null);
  const [removingDoc, setRemovingDoc] = useState(false);

  const resetForm = () => {
    setFormData({
      name: '',
      companyName: '',
      email: '',
      phone: '',
      branch_id: selectedBranchId,
      billing_notes: '',
      internal_notes: '',
    });
    setIsEditing(null);
  };

  const fetchClients = async () => {
    try {
      const res = await api.get('clients', { params: branchParams(selectedBranchId) });
      setClients(res.data);
    } catch (err) {
      console.error('Failed to fetch clients:', err);
      toast.error('Could not load clients.');
    } finally {
      setLoading(false);
    }
  };

  const fetchDocuments = async (clientId: string) => {
    setDocLoading(true);
    try {
      const res = await api.get(`documents?clientId=${clientId}`);
      setDocuments(Array.isArray(res.data) ? res.data : []);
      setDocError('');
    } catch (err) {
      console.error(err);
      setDocError('Could not load shared documents.');
    } finally {
      setDocLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranchId]);

  useEffect(() => {
    getEffectiveFieldPermissions('client')
      .then(setFieldAccess)
      .catch((err) => console.error('Failed to load client field permissions', err));
  }, []);

  useNewIntent(() => {
    resetForm();
    setShowModal(true);
  });

  const canViewField = (field: string) => fieldAccess[field]?.canView !== false;
  const canEditField = (field: string) => fieldAccess[field]?.canEdit !== false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: formData.name,
        companyName: formData.companyName,
        email: formData.email,
        phone: formData.phone,
        branch_id: formData.branch_id,
        ...(canEditField('billing_notes') ? { billing_notes: formData.billing_notes.trim() || null } : {}),
        ...(canEditField('internal_notes') ? { internal_notes: formData.internal_notes.trim() || null } : {}),
      };

      if (isEditing) {
        await api.put(`clients/${isEditing}`, payload);
      } else {
        await api.post('clients', payload);
      }
      setShowModal(false);
      resetForm();
      fetchClients();
      toast.success(isEditing ? 'Client updated.' : 'Client created.');
    } catch (err) {
      console.error(err);
      toast.error(getApiErrorMessage(err, 'An error occurred while saving the client.'));
    }
  };

  const handleCreateUser = async () => {
    if (!createUserTarget) return;
    setCreatingUser(true);
    try {
      const res = await api.post(`clients/${createUserTarget.id}/create-user`, { email: createUserTarget.email });
      toast.success(`Portal login created. Temporary password: ${res.data.temporaryPassword}`);
      fetchClients();
    } catch (err) {
      console.error(err);
      toast.error(getApiErrorMessage(err, 'Failed to create user. It may already exist.'));
    } finally {
      setCreatingUser(false);
      setCreateUserTarget(null);
    }
  };

  const handleShareDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClient) return;
    setIsUploading(true);
    setDocError('');
    try {
      await api.post('documents', {
        name: newDoc.name.trim(),
        url: newDoc.url.trim(),
        description: newDoc.description.trim() || undefined,
        clientId: selectedClient.id,
      });
      setNewDoc({ name: '', url: '', description: '' });
      fetchDocuments(selectedClient.id);
    } catch (err) {
      console.error(err);
      setDocError(getApiErrorMessage(err, 'Could not share this document.'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveDocument = async () => {
    if (!removeDocTarget) return;
    setRemovingDoc(true);
    try {
      await api.delete(`documents/${removeDocTarget}`);
      if (selectedClient) fetchDocuments(selectedClient.id);
    } catch (err) {
      console.error(err);
      setDocError(getApiErrorMessage(err, 'Could not remove this document.'));
    } finally {
      setRemovingDoc(false);
      setRemoveDocTarget(null);
    }
  };

  const handleEdit = (client: Client) => {
    setFormData({
      name: client.name,
      companyName: client.companyName || '',
      email: client.email,
      phone: client.phone || '',
      branch_id: client.branchId || '',
      billing_notes: client.billingNotes || '',
      internal_notes: client.internalNotes || '',
    });
    setIsEditing(client.id);
    setShowModal(true);
  };

  const filteredClients = clients.filter(
    (client) =>
      !searchQuery ||
      client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (client.companyName || '').toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <DashboardLayout>
      <PageHeader
        title="Client Management"
        description="Manage your client relationships and contact details."
        actions={
          <Button
            onClick={() => {
              resetForm();
              setShowModal(true);
            }}
          >
            <Plus size={16} />
            Add New Client
          </Button>
        }
      />

      <InsuranceAdvisoryBanner />

      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card shadow-sm">
        <div className="border-b border-border p-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_240px]">
            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <Input
                type="text"
                placeholder="Search clients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <BranchSelect value={selectedBranchId} onChange={setSelectedBranchId} label="Filter Branch" />
          </div>
        </div>

        {loading ? (
          <LoadingState label="Loading clients..." />
        ) : clients.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No clients yet"
            description="Add your first client to start sharing documents, proposals, and invoices with them."
            action={
              <Button
                onClick={() => {
                  resetForm();
                  setShowModal(true);
                }}
              >
                <Plus size={16} />
                Add New Client
              </Button>
            }
          />
        ) : filteredClients.length === 0 ? (
          <EmptyState icon={Search} title="No matching clients" description="Try a different search term." />
        ) : (
          <div className="overflow-x-auto">
            <Table className="responsive-table">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground">Client / Company</TableHead>
                  <TableHead className="px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground">Contact</TableHead>
                  <TableHead className="px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground">Branch</TableHead>
                  <TableHead className="px-6 py-3 text-center text-xs uppercase tracking-wider text-muted-foreground">Portal</TableHead>
                  <TableHead className="px-6 py-3" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell className="px-6 py-3.5 whitespace-normal" data-label="Client">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
                          <User size={16} />
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-foreground">{client.name}</div>
                          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Building size={12} aria-hidden="true" />
                            <span className="truncate">{client.companyName || 'No company'}</span>
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-3.5 whitespace-normal" data-label="Contact">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Mail size={13} aria-hidden="true" />
                          <span className="truncate">{client.email}</span>
                        </div>
                        {client.phone && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Phone size={13} aria-hidden="true" />
                            {client.phone}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-3.5 whitespace-normal" data-label="Branch">
                      <BranchBadge branch={client.branch} />
                    </TableCell>
                    <TableCell className="px-6 py-3.5 text-center whitespace-normal" data-label="Portal">
                      {client.users && client.users.length > 0 ? (
                        <span className="inline-flex items-center rounded-full bg-success-wash px-2.5 py-0.5 text-xs font-semibold text-success">
                          Active
                        </span>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => setCreateUserTarget(client)}>
                          Enable Portal
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="px-6 py-3.5 text-right whitespace-normal" data-label="Actions">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => {
                            setSelectedClient(client);
                            setShowDocsModal(true);
                            fetchDocuments(client.id);
                          }}
                          aria-label={`Manage documents for ${client.name}`}
                          title="Manage documents"
                        >
                          <Folder size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleEdit(client)}
                          aria-label={`Edit ${client.name}`}
                          title="Edit client"
                        >
                          <Edit2 size={16} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Document management */}
      <Dialog open={showDocsModal} onOpenChange={setShowDocsModal}>
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] w-full flex-col overflow-hidden p-0 sm:max-w-4xl">
          {selectedClient && (
            <>
              <DialogHeader className="border-b border-border p-5 text-left sm:p-6">
                <DialogTitle>Documents: {selectedClient.name}</DialogTitle>
                <DialogDescription>Share and manage files for this client.</DialogDescription>
              </DialogHeader>

              <div className="grid flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-2 lg:overflow-hidden">
                <div className="space-y-3 overflow-y-auto border-b border-border p-5 lg:border-b-0 lg:border-r">
                  <h4 className="text-eyebrow mb-2">Shared documents</h4>
                  {docLoading ? (
                    <LoadingState label="Loading documents..." />
                  ) : docError ? (
                    <ErrorState message={docError} />
                  ) : documents.length === 0 ? (
                    <EmptyState icon={FileText} title="No documents shared yet" />
                  ) : (
                    documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/8 text-primary">
                            <FileText size={16} />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-foreground">{doc.name}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {new Date(doc.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon-sm" asChild aria-label={`Download ${doc.name}`} title="Download">
                            <a href={doc.url} target="_blank" rel="noopener noreferrer">
                              <Download size={15} />
                            </a>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-error hover:bg-error-wash hover:text-error"
                            onClick={() => setRemoveDocTarget(doc.id)}
                            aria-label={`Remove ${doc.name}`}
                            title="Remove document"
                          >
                            <Trash2 size={15} />
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="overflow-y-auto bg-muted/40 p-5">
                  <h4 className="text-eyebrow mb-4">Share new document</h4>
                  {docError && (
                    <div className="mb-4">
                      <ErrorState message={docError} />
                    </div>
                  )}
                  <form onSubmit={handleShareDocument} className="space-y-4">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-muted-foreground">Document name</label>
                      <Input
                        type="text"
                        placeholder="e.g. Service Agreement"
                        value={newDoc.name}
                        onChange={(e) => setNewDoc({ ...newDoc, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-muted-foreground">File URL / link</label>
                      <Input
                        type="url"
                        className="font-mono"
                        placeholder="https://example.com/file.pdf"
                        value={newDoc.url}
                        onChange={(e) => setNewDoc({ ...newDoc, url: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-muted-foreground">Description (optional)</label>
                      <textarea
                        className={fieldInputClass}
                        placeholder="Brief note about this document..."
                        value={newDoc.description}
                        onChange={(e) => setNewDoc({ ...newDoc, description: e.target.value })}
                      />
                    </div>
                    <Button type="submit" disabled={isUploading} className="w-full">
                      {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                      Share Document
                    </Button>
                  </form>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Create / edit client */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit Client' : 'Add New Client'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Contact name</label>
              <Input
                type="text"
                placeholder="e.g. Robert Fox"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Company name</label>
              <Input
                type="text"
                placeholder="e.g. Acme Corp"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">Email address</label>
                <Input
                  type="email"
                  placeholder="robert@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">Phone number</label>
                <Input
                  type="tel"
                  placeholder="+1 (555) 000-0000"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>

            <BranchSelect
              value={formData.branch_id}
              onChange={(branchId) => setFormData({ ...formData, branch_id: branchId })}
              includeAll={false}
            />

            {(canViewField('billing_notes') || canViewField('internal_notes')) && (
              <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
                {canViewField('billing_notes') && (
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-muted-foreground">Billing notes</label>
                    <textarea
                      disabled={!canEditField('billing_notes')}
                      className={fieldInputClass}
                      placeholder="Private billing notes"
                      value={formData.billing_notes}
                      onChange={(e) => setFormData({ ...formData, billing_notes: e.target.value })}
                    />
                  </div>
                )}

                {canViewField('internal_notes') && (
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-muted-foreground">Internal notes</label>
                    <textarea
                      disabled={!canEditField('internal_notes')}
                      className={fieldInputClass}
                      placeholder="Internal relationship notes"
                      value={formData.internal_notes}
                      onChange={(e) => setFormData({ ...formData, internal_notes: e.target.value })}
                    />
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button type="submit">{isEditing ? 'Save Changes' : 'Add Client'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={createUserTarget !== null}
        onOpenChange={(o) => !o && setCreateUserTarget(null)}
        title="Enable client portal?"
        description={
          createUserTarget
            ? `Create a portal login for ${createUserTarget.email}. A secure temporary password will be generated and shown once.`
            : undefined
        }
        confirmLabel="Create login"
        loading={creatingUser}
        onConfirm={handleCreateUser}
      />

      <ConfirmDialog
        open={removeDocTarget !== null}
        onOpenChange={(o) => !o && setRemoveDocTarget(null)}
        title="Remove this document?"
        description="The client will no longer be able to access it from their portal."
        confirmLabel="Remove"
        destructive
        loading={removingDoc}
        onConfirm={handleRemoveDocument}
      />
    </DashboardLayout>
  );
}
