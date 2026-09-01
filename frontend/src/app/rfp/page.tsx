'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import DashboardLayout from '@/components/DashboardLayout';
import PageHeader from '@/components/PageHeader';
import StatusBadge, { type StatusTone } from '@/components/StatusBadge';
import EmptyState from '@/components/EmptyState';
import LoadingState from '@/components/LoadingState';
import ErrorState from '@/components/ErrorState';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/context/AuthContext';
import { getApiErrorMessage } from '@/lib/api-error';
import { createRfp, deleteRfp, downloadRfpPdf, getRfps, Rfp } from '@/lib/rfp';
import {
  Copy,
  Download,
  Eye,
  FilePenLine,
  FileText,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react';

const STATUS_TONE: Record<Rfp['status'], StatusTone> = {
  DRAFT: 'warning',
  GENERATED: 'primary',
  FINALIZED: 'success',
  EVALUATED: 'info',
  AWARDED: 'warning',
};

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function RfpListPage() {
  const { can } = useAuth();
  const [rfps, setRfps] = useState<Rfp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionId, setActionId] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await getRfps();
      setRfps(Array.isArray(data) ? data : []);
      setError('');
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not load RFPs.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDuplicate = async (rfp: Rfp) => {
    setActionId(rfp.id);
    try {
      await createRfp({
        title: `${rfp.title} (Copy)`,
        clientName: rfp.clientName,
        companyName: rfp.companyName || undefined,
        industry: rfp.industry || undefined,
        projectName: rfp.projectName || undefined,
        dueDate: rfp.dueDate || undefined,
        startDate: rfp.startDate || undefined,
        endDate: rfp.endDate || undefined,
        estimatedBudget: rfp.estimatedBudget ?? undefined,
        securityTypes: rfp.securityTypes,
        numberOfLocations: rfp.numberOfLocations ?? undefined,
        address: rfp.address || undefined,
        operatingHours: rfp.operatingHours || undefined,
        guardsRequired: rfp.guardsRequired ?? undefined,
        additionalRequirements: rfp.additionalRequirements || undefined,
        generatedContent: rfp.generatedContent || undefined,
        status: 'DRAFT',
      });
      toast.success('RFP duplicated.');
      fetchData();
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not duplicate this RFP.'));
    } finally {
      setActionId('');
    }
  };

  const handleDelete = async (rfp: Rfp) => {
    if (!confirm(`Delete "${rfp.title}"? This cannot be undone.`)) return;
    setActionId(rfp.id);
    try {
      await deleteRfp(rfp.id);
      setRfps((current) => current.filter((item) => item.id !== rfp.id));
      toast.success('RFP deleted.');
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not delete this RFP.'));
    } finally {
      setActionId('');
    }
  };

  const handleDownload = async (rfp: Rfp) => {
    setActionId(rfp.id);
    try {
      await downloadRfpPdf(rfp.id, rfp.title);
    } catch (err) {
      toast.error(getApiErrorMessage(err, 'Could not download PDF.'));
    } finally {
      setActionId('');
    }
  };

  return (
    <DashboardLayout requiredPermissions="rfp.view">
      <PageHeader
        title="RFP Management"
        description="Create, generate, and manage Requests for Proposal."
        actions={
          can('rfp.create') && (
            <Button asChild>
              <Link href="/rfp/new">
                <Plus size={16} />
                Create RFP
              </Link>
            </Button>
          )
        }
      />

      {error && (
        <div className="mb-6">
          <ErrorState message={error} onRetry={fetchData} />
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {loading ? (
          <LoadingState label="Loading RFPs..." />
        ) : rfps.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No RFPs yet"
            description='Use the "Create RFP" button to draft your first Request for Proposal.'
          />
        ) : (
          <div className="overflow-x-auto">
            <Table className="responsive-table">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground">Title</TableHead>
                  <TableHead className="px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground">Client</TableHead>
                  <TableHead className="px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground">Due Date</TableHead>
                  <TableHead className="px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground">Status</TableHead>
                  <TableHead className="px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground">Created By</TableHead>
                  <TableHead className="px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground">Created Date</TableHead>
                  <TableHead className="px-6 py-3 text-right text-xs uppercase tracking-wider text-muted-foreground">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rfps.map((rfp) => (
                  <TableRow key={rfp.id}>
                    <TableCell className="px-6 py-4 whitespace-normal" data-label="Title">
                      <div className="font-semibold text-foreground">{rfp.title}</div>
                      {rfp.projectName && <div className="mt-1 text-sm text-muted-foreground">{rfp.projectName}</div>}
                    </TableCell>
                    <TableCell className="px-6 py-4 text-sm whitespace-normal text-foreground" data-label="Client">
                      <div>{rfp.clientName}</div>
                      {rfp.companyName && <div className="mt-1 text-muted-foreground">{rfp.companyName}</div>}
                    </TableCell>
                    <TableCell className="px-6 py-4 text-sm whitespace-normal text-foreground" data-label="Due Date">
                      {formatDate(rfp.dueDate)}
                    </TableCell>
                    <TableCell className="px-6 py-4 whitespace-normal" data-label="Status">
                      <StatusBadge label={rfp.status} tone={STATUS_TONE[rfp.status]} />
                    </TableCell>
                    <TableCell className="px-6 py-4 text-sm whitespace-normal text-foreground" data-label="Created By">
                      {rfp.createdByUser?.name || rfp.createdByUser?.email || '—'}
                    </TableCell>
                    <TableCell className="px-6 py-4 text-sm whitespace-normal text-foreground" data-label="Created Date">
                      {formatDate(rfp.createdAt)}
                    </TableCell>
                    <TableCell className="px-6 py-4 text-right whitespace-normal" data-label="Actions">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button asChild variant="outline" size="icon-sm" title="View">
                          <Link href={`/rfp/${rfp.id}`}>
                            <Eye size={16} />
                          </Link>
                        </Button>
                        {can('rfp.update') && (
                          <Button asChild variant="outline" size="icon-sm" title="Edit">
                            <Link href={`/rfp/${rfp.id}/edit`}>
                              <FilePenLine size={16} />
                            </Link>
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="icon-sm"
                          title="Duplicate"
                          onClick={() => handleDuplicate(rfp)}
                          disabled={actionId === rfp.id || !can('rfp.create')}
                        >
                          {actionId === rfp.id ? <Loader2 className="animate-spin" size={16} /> : <Copy size={16} />}
                        </Button>
                        <Button
                          variant="outline"
                          size="icon-sm"
                          title="Export PDF"
                          onClick={() => handleDownload(rfp)}
                          disabled={actionId === rfp.id}
                        >
                          <Download size={16} />
                        </Button>
                        {can('rfp.delete') && (
                          <Button
                            variant="outline"
                            size="icon-sm"
                            title="Delete"
                            onClick={() => handleDelete(rfp)}
                            disabled={actionId === rfp.id}
                            className="border-error/20 bg-error-wash text-error hover:bg-error-wash hover:text-error"
                          >
                            <Trash2 size={16} />
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
    </DashboardLayout>
  );
}
