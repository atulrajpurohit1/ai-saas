'use client';

import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import PageHeader from '@/components/PageHeader';
import LoadingState from '@/components/LoadingState';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import { formatEnumLabel } from '@/lib/format';
import { Clock, ScrollText } from 'lucide-react';

interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
  createdAt: string;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await api.get('audit');
      setLogs(Array.isArray(res.data) ? res.data : []);
      setError('');
    } catch (err) {
      console.error(err);
      setError('Could not load activity logs. Please refresh or log in again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const getActionColor = (action: string) => {
    switch (action.toUpperCase()) {
      case 'CREATE':
        return 'text-success';
      case 'UPDATE':
        return 'text-info';
      case 'DELETE':
        return 'text-error';
      case 'EXPORT':
        return 'text-primary';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <DashboardLayout>
      <PageHeader
        title="Audit Logs"
        description="Track all system actions and entity lifecycle events."
      />

      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card shadow-sm">
        {loading ? (
          <LoadingState label="Loading activity..." />
        ) : error ? (
          <div className="p-4">
            <ErrorState message={error} onRetry={fetchLogs} />
          </div>
        ) : logs.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title="No activity yet"
            description="System and user actions will appear here as they happen."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table className="responsive-table">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground">Action</TableHead>
                  <TableHead className="px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground">Entity</TableHead>
                  <TableHead className="px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground">Details</TableHead>
                  <TableHead className="px-6 py-3 text-xs uppercase tracking-wider text-muted-foreground">Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="px-6 py-3.5" data-label="Action">
                      <span className={cn('text-xs font-bold uppercase tracking-wide', getActionColor(log.action))}>
                        {formatEnumLabel(log.action)}
                      </span>
                    </TableCell>
                    <TableCell className="px-6 py-3.5" data-label="Entity">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-foreground">{formatEnumLabel(log.entityType)}</span>
                        <span className="font-mono text-[10px] text-muted-foreground">{log.entityId}</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-3.5 text-sm text-foreground md:max-w-xs md:truncate" data-label="Details">
                      {log.details || 'N/A'}
                    </TableCell>
                    <TableCell className="px-6 py-3.5" data-label="Timestamp">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock size={12} aria-hidden="true" />
                        {new Date(log.createdAt).toLocaleString()}
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
