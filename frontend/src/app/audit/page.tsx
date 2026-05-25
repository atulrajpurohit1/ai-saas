'use client';

import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import api from '@/lib/api';
import { Shield, Clock, AlertTriangle } from 'lucide-react';

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
    try {
      const res = await api.get('audit');
      setLogs(Array.isArray(res.data) ? res.data : []);
      setError('');
    } catch (err) {
      console.error(err);
      setError('Could not load activity logs. Please refresh or login again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const getActionColor = (action: string) => {
    switch (action) {
      case 'CREATE': return 'text-emerald-400';
      case 'UPDATE': return 'text-blue-400';
      case 'DELETE': return 'text-rose-400';
      case 'EXPORT': return 'text-purple-400';
      default: return 'text-indigo-400';
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h2 className="flex items-center gap-3 text-2xl font-bold sm:text-3xl">
          <Shield className="text-primary" />
          Audit Logs
        </h2>
        <p className="text-muted-foreground">Track all system actions and entity lifecycle events.</p>
      </div>

      <div className="glass-card rounded-3xl overflow-hidden border border-white/5">
        <div className="overflow-x-auto">
          <table className="responsive-table w-full text-left">
            <thead>
              <tr className="text-muted-foreground text-sm uppercase tracking-wider bg-white/5">
                <th className="px-6 py-4 font-semibold">Action</th>
                <th className="px-6 py-4 font-semibold">Entity</th>
                <th className="px-6 py-4 font-semibold">Details</th>
                <th className="px-6 py-4 font-semibold">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr><td colSpan={4} className="px-6 py-10 text-center text-muted-foreground italic">Fetching records...</td></tr>
              ) : error ? (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-rose-300">
                    <div className="flex items-center justify-center gap-2">
                      <AlertTriangle size={16} />
                      <span>{error}</span>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr><td colSpan={4} className="px-6 py-10 text-center text-muted-foreground">No logs found.</td></tr>
              ) : logs.map((log) => (
                <tr key={log.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4" data-label="Action">
                    <span className={`font-bold text-xs ${getActionColor(log.action)}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-4" data-label="Entity">
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm uppercase text-muted-foreground">{log.entityType}</span>
                      <span className="text-[10px] font-mono text-gray-500">{log.entityId}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm md:max-w-xs md:truncate" data-label="Details">
                    {log.details || 'N/A'}
                  </td>
                  <td className="px-6 py-4" data-label="Timestamp">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock size={12} />
                      {new Date(log.createdAt).toLocaleString()}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
