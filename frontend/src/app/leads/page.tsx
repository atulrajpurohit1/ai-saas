'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import LoadingState from '@/components/LoadingState';
import ErrorState from '@/components/ErrorState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { Plus, Search, User, Upload, Loader2, Users } from 'lucide-react';

interface Lead {
  id: string;
  name: string;
  email: string | null;
  company: string;
  status: string;
  createdAt: string;
  salesAssessments?: Array<{
    leadScore: number | null;
    priorityTier: string | null;
    closeReadinessScore: number | null;
    discoveryQualityScore: number | null;
    recommendedNextAction: string | null;
    createdAt: string;
  }>;
}

const scoreClass = (score?: number | null) => {
  if ((score || 0) >= 75) return 'bg-success-wash text-success';
  if ((score || 0) >= 50) return 'bg-warning-wash text-warning';
  if (typeof score === 'number') return 'bg-error-wash text-error';
  return 'bg-muted text-muted-foreground';
};

const priorityLabel = (value?: string | null) => (value ? value.toUpperCase() : 'UNSCORED');

const STATUS_TONE_CLASSES: Record<string, string> = {
  new: 'bg-info-wash text-info',
  contacted: 'bg-warning-wash text-warning',
  proposal_sent: 'bg-primary/8 text-primary',
  responded: 'bg-success-wash text-success',
  closed: 'bg-muted text-muted-foreground',
};

const statusToneClass = (status: string) => STATUS_TONE_CLASSES[status] || 'bg-success-wash text-success';

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [newLead, setNewLead] = useState({ name: '', email: '', company: '' });
  const [searchQuery, setSearchQuery] = useState('');

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('leads/analyze-pdf', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const { name, company, email } = res.data;
      setNewLead({
        name: name !== 'Unknown' ? name : '',
        company: company !== 'Unknown' ? company : '',
        email: email || '',
      });
    } catch (err) {
      console.error('PDF Analysis Error:', err);
      alert('Failed to analyze PDF. Ensure Gemini API key is valid.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleStatusChange = async (leadId: string, newStatus: string) => {
    try {
      await api.patch(`leads/${leadId}/status`, { status: newStatus });
      fetchLeads();
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLeads = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await api.get('leads');
      setLeads(res.data);
    } catch (err) {
      console.error(err);
      setLoadError("Couldn't load leads. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('leads', newLead);
      setShowModal(false);
      setNewLead({ name: '', email: '', company: '' });
      fetchLeads();
    } catch (err) {
      console.error(err);
    }
  };

  const filteredLeads = leads.filter((lead) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      lead.name.toLowerCase().includes(query) ||
      lead.company.toLowerCase().includes(query) ||
      (lead.email || '').toLowerCase().includes(query)
    );
  });

  return (
    <DashboardLayout>
      <PageHeader
        title="Leads"
        description="Manage your incoming business opportunities."
        actions={
          <Button onClick={() => setShowModal(true)}>
            <Plus size={16} />
            Add New Lead
          </Button>
        }
      />

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="border-b border-border p-4">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <Input
              type="text"
              placeholder="Search leads..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {loading ? (
          <LoadingState label="Loading leads..." />
        ) : loadError ? (
          <div className="p-4">
            <ErrorState message={loadError} onRetry={fetchLeads} />
          </div>
        ) : leads.length === 0 ? (
          <EmptyState icon={Users} title="No leads yet" description="Leads you add or import will show up here." />
        ) : filteredLeads.length === 0 ? (
          <EmptyState icon={Search} title="No matching leads" description="Try a different search term." />
        ) : (
          <div className="overflow-x-auto">
            <Table className="responsive-table">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground">Lead</TableHead>
                  <TableHead className="px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground">Email</TableHead>
                  <TableHead className="px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground">Status</TableHead>
                  <TableHead className="px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground">AI Score</TableHead>
                  <TableHead className="px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground">Created</TableHead>
                  <TableHead className="px-6 py-3" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.map((lead) => {
                  const assessment = lead.salesAssessments?.[0];
                  // Prospect-imported leads often have no distinct contact name
                  // (it falls back to the company name) - showing the same
                  // string twice adds noise, not information.
                  const showCompanyLine = lead.company && lead.company !== lead.name;

                  return (
                    <TableRow key={lead.id}>
                      <TableCell className="px-6 py-3.5 whitespace-normal" data-label="Lead">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
                            <User size={16} />
                          </div>
                          <div className="min-w-0">
                            <Link href={`/leads/${lead.id}`} className="block truncate font-semibold text-foreground transition hover:text-primary">
                              {lead.name}
                            </Link>
                            {showCompanyLine && (
                              <div className="truncate text-xs text-muted-foreground">{lead.company}</div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-3.5 text-sm whitespace-normal" data-label="Email">
                        {lead.email ? (
                          <span className="text-foreground">{lead.email}</span>
                        ) : (
                          <span className="text-muted-foreground">Not provided</span>
                        )}
                      </TableCell>
                      <TableCell className="px-6 py-3.5 whitespace-normal" data-label="Status">
                        <select
                          value={lead.status}
                          onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                          className={cn(
                            'cursor-pointer appearance-none rounded-full border-0 px-3 py-1 text-xs font-semibold uppercase tracking-tight outline-none transition hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ring',
                            statusToneClass(lead.status),
                          )}
                        >
                          <option value="new">New</option>
                          <option value="contacted">Contacted</option>
                          <option value="proposal_sent">Proposal Sent</option>
                          <option value="responded">Responded</option>
                          <option value="closed">Closed</option>
                        </select>
                      </TableCell>
                      <TableCell className="px-6 py-3.5 whitespace-normal" data-label="AI Score">
                        {typeof assessment?.leadScore === 'number' ? (
                          <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold', scoreClass(assessment.leadScore))}>
                            {assessment.leadScore}
                            {assessment.priorityTier && (
                              <span className="opacity-70">&middot; {priorityLabel(assessment.priorityTier)}</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not scored</span>
                        )}
                      </TableCell>
                      <TableCell className="px-6 py-3.5 text-sm whitespace-normal text-muted-foreground" data-label="Created">
                        {new Date(lead.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="px-6 py-3.5 text-right whitespace-normal" data-label="Actions">
                        <div className="flex items-center justify-end gap-2">
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/leads/${lead.id}`}>Details</Link>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-success/20 bg-success-wash text-success hover:bg-success-wash hover:text-success"
                            onClick={async () => {
                              if (confirm('Convert this lead to a deal?')) {
                                try {
                                  await api.post(`deals/convert/${lead.id}`);
                                  fetchLeads();
                                } catch (err) {
                                  console.error(err);
                                  alert('Failed to convert lead');
                                }
                              }
                            }}
                          >
                            Convert
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
            <DialogTitle>Create New Lead</DialogTitle>
          </DialogHeader>

          <div className="relative overflow-hidden rounded-xl border border-dashed border-primary/25 bg-primary/[0.04] p-5 transition hover:bg-primary/[0.06]">
            <div className="relative z-10 flex items-center gap-4">
              <div className={cn('flex h-11 w-11 items-center justify-center rounded-lg', isUploading ? 'bg-primary/15' : 'bg-primary/10 text-primary')}>
                {isUploading ? <Loader2 size={20} className="animate-spin text-primary" /> : <Upload size={20} className="text-primary" />}
              </div>
              <div>
                <h4 className="text-sm font-semibold text-foreground">{isUploading ? 'AI is analyzing document...' : 'Populate from PDF'}</h4>
                <p className="text-xs text-muted-foreground">Auto-fill form fields using AI document analysis</p>
              </div>
            </div>
            <input type="file" className="absolute inset-0 cursor-pointer opacity-0" accept=".pdf" onChange={handlePdfUpload} disabled={isUploading} />
          </div>

          <form onSubmit={handleAddLead} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">Contact Name</label>
                <Input
                  type="text"
                  placeholder="John Doe"
                  value={newLead.name}
                  onChange={(e) => setNewLead({ ...newLead, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">Company Name</label>
                <Input
                  type="text"
                  placeholder="Security Ops Inc"
                  value={newLead.company}
                  onChange={(e) => setNewLead({ ...newLead, company: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Email Address</label>
              <Input
                type="email"
                placeholder="john@securityops.com"
                value={newLead.email}
                onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
              />
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button type="submit">Save Lead</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
