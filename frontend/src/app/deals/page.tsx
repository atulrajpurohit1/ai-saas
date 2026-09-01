'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import DealsKanbanBoard from '@/components/DealsKanbanBoard';
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
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { Deal, getDeals } from '@/lib/deals';
import { cn } from '@/lib/utils';
import { Plus, Search, DollarSign, Target, Briefcase, LayoutGrid, List } from 'lucide-react';

const VIEW_STORAGE_KEY = 'ai-saas-deals-view';

interface LeadOption {
  id: string;
  name: string;
  company: string;
}

interface ClientOption {
  id: string;
  name: string;
  companyName: string | null;
}

const scoreClass = (score?: number | null) => {
  if ((score || 0) >= 75) return 'bg-success-wash text-success';
  if ((score || 0) >= 50) return 'bg-warning-wash text-warning';
  if (typeof score === 'number') return 'bg-error-wash text-error';
  return 'bg-muted text-muted-foreground';
};

export default function DealsPage() {
  const { can } = useAuth();
  const canUpdateStage = can('deals.update');
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [newDeal, setNewDeal] = useState({ name: '', leadId: '', clientId: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [view, setView] = useState<'kanban' | 'list'>('kanban');

  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem(VIEW_STORAGE_KEY) : null;
    if (stored === 'kanban' || stored === 'list') setView(stored);
  }, []);

  const changeView = (nextView: 'kanban' | 'list') => {
    setView(nextView);
    localStorage.setItem(VIEW_STORAGE_KEY, nextView);
  };

  const getClientLabel = (client: ClientOption) => {
    const companyName = client.companyName;

    if (!companyName || companyName === client.name) {
      return client.name;
    }

    return `${companyName} (${client.name})`;
  };

  const fetchData = async () => {
    const [dealsResult, leadsResult, clientsResult] = await Promise.allSettled([
      getDeals(),
      api.get('leads'),
      api.get('clients'),
    ]);

    if (dealsResult.status === 'fulfilled') {
      setDeals(dealsResult.value);
    } else {
      console.error('Failed to fetch deals', dealsResult.reason);
    }

    if (leadsResult.status === 'fulfilled') {
      setLeads(leadsResult.value.data);
    } else {
      console.error('Failed to fetch leads', leadsResult.reason);
    }

    if (clientsResult.status === 'fulfilled') {
      setClients(clientsResult.value.data);
    } else {
      console.error('Failed to fetch clients', clientsResult.reason);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...newDeal,
        clientId: newDeal.clientId || null,
      };
      await api.post('deals', payload);
      setShowModal(false);
      setNewDeal({ name: '', leadId: '', clientId: '' });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const filteredDeals = deals.filter((deal) => {
    if (!searchQuery) return true;
    return deal.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <DashboardLayout>
      <PageHeader
        title="Sales Pipeline"
        description="Track your active deals and conversion progress."
        actions={
          <>
            <div className="flex rounded-lg border border-border bg-card p-1 shadow-sm">
              <button
                type="button"
                onClick={() => changeView('kanban')}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors',
                  view === 'kanban' ? 'bg-primary/8 text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <LayoutGrid size={15} />
                <span className="hidden sm:inline">Kanban</span>
              </button>
              <button
                type="button"
                onClick={() => changeView('list')}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors',
                  view === 'list' ? 'bg-primary/8 text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <List size={15} />
                <span className="hidden sm:inline">List</span>
              </button>
            </div>
            <Button onClick={() => setShowModal(true)}>
              <Plus size={16} />
              New Deal
            </Button>
          </>
        }
      />

      {loading ? (
        <div className="rounded-2xl border border-border bg-card shadow-sm">
          <LoadingState label="Syncing with pipeline..." />
        </div>
      ) : view === 'kanban' ? (
        deals.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card shadow-sm">
            <EmptyState
              icon={Briefcase}
              title="No active deals"
              description="A deal tracks one opportunity through your pipeline stages. Create one from a lead or a client."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button onClick={() => setShowModal(true)}>
                    <Plus size={16} />
                    New Deal
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/leads">View Leads</Link>
                  </Button>
                </div>
              }
            />
          </div>
        ) : (
          <DealsKanbanBoard deals={deals} onDealsChange={setDeals} canUpdateStage={canUpdateStage} />
        )
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="border-b border-border p-4">
            <div className="relative w-full sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <Input
                type="text"
                placeholder="Filter deals..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {deals.length === 0 ? (
            <EmptyState
              icon={Briefcase}
              title="No active deals"
              description="A deal tracks one opportunity through your pipeline stages. Create one from a lead or a client."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button onClick={() => setShowModal(true)}>
                    <Plus size={16} />
                    New Deal
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="/leads">View Leads</Link>
                  </Button>
                </div>
              }
            />
          ) : filteredDeals.length === 0 ? (
            <EmptyState icon={Search} title="No matching deals" description="Try a different search term." />
          ) : (
            <div className="grid grid-cols-1 gap-4 p-4 sm:p-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-5">
              {filteredDeals.map((deal) => {
                const assessment = deal.salesAssessments?.[0];
                return (
                  <div key={deal.id} className="rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:border-primary/30 hover:shadow-md">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="rounded-lg bg-primary/8 p-2 text-primary">
                        <Briefcase size={18} />
                      </div>
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <span className="rounded-md bg-primary/8 px-2 py-1 text-xs font-bold uppercase tracking-wider text-primary">
                          {deal.stage}
                        </span>
                        <span className={cn('rounded-md px-2 py-1 text-xs font-bold uppercase tracking-wider', scoreClass(assessment?.closeReadinessScore))}>
                          {assessment?.closeReadinessScore ?? '--'} ready
                        </span>
                      </div>
                    </div>
                    <Link href={`/deals/${deal.id}`} className="mb-1 block truncate text-lg font-semibold text-foreground transition hover:text-primary">
                      {deal.name}
                    </Link>
                    <p className="mb-3 flex items-center gap-1 text-sm text-muted-foreground">
                      <Target size={14} />
                      {deal.lead.company}
                    </p>
                    {deal.client && (
                      <p className="mb-3 text-xs font-medium text-success">Client: {deal.client.name}</p>
                    )}
                    <div className="min-h-10 rounded-lg bg-muted px-3 py-2 text-xs leading-5 text-muted-foreground">
                      {assessment?.recommendedNextAction || 'Run Sales Accelerator scoring from deal details.'}
                    </div>

                    <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                      <div className="flex items-center gap-1 font-bold text-success">
                        <DollarSign size={16} />
                        <span className="text-sm">Proposed</span>
                      </div>
                      <Link href={`/deals/${deal.id}`} className="text-xs font-bold text-muted-foreground transition-colors hover:text-foreground">
                        VIEW DETAILS
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Start a New Deal</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddDeal} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Deal Title</label>
              <Input
                type="text"
                placeholder="Security Contract Q3"
                value={newDeal.name}
                onChange={(e) => setNewDeal({ ...newDeal, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Select Lead</label>
              <select
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                value={newDeal.leadId}
                onChange={(e) => setNewDeal({ ...newDeal, leadId: e.target.value })}
                required
              >
                <option value="">Choose a lead...</option>
                {leads.length === 0 && <option value="" disabled>No leads available</option>}
                {leads.map((lead) => (
                  <option key={lead.id} value={lead.id}>{lead.company} ({lead.name})</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">Link to Client (Optional)</label>
              <select
                className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                value={newDeal.clientId}
                onChange={(e) => setNewDeal({ ...newDeal, clientId: e.target.value })}
              >
                <option value="">Choose a client...</option>
                {clients.length === 0 && <option value="" disabled>No clients available</option>}
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>{getClientLabel(client)}</option>
                ))}
              </select>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                Cancel
              </Button>
              <Button type="submit">Initialize Deal</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
