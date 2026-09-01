'use client';

import React, { useCallback, useEffect, useState } from 'react';
import ClientLayout from '@/components/ClientLayout';
import api from '@/lib/api';
import { Folder, FileText, Download, Clock, Search } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import LoadingState from '@/components/LoadingState';
import ErrorState from '@/components/ErrorState';

interface SharedDocument {
  id: string;
  name: string;
  url: string;
  description?: string;
  createdAt: string;
}

export default function ClientDocumentsPage() {
  const [documents, setDocuments] = useState<SharedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('client-portal/documents');
      setDocuments(Array.isArray(res.data) ? res.data : []);
      setError('');
    } catch (err) {
      console.error('Failed to fetch documents', err);
      setError('Could not load shared documents. Please refresh or sign in again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const filteredDocs = documents.filter((doc) =>
    doc.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <ClientLayout>
      <PageHeader
        title="Shared Documents"
        description="Files and resources shared by your account manager."
      />

      <div className="surface-card overflow-hidden">
        <div className="border-b border-border bg-muted/50 p-4 sm:p-5">
          <div className="relative w-full sm:max-w-md">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <input
              type="text"
              placeholder="Search documents…"
              className="w-full rounded-[var(--radius)] border border-border bg-card py-2.5 pl-10 pr-4 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary/40 focus:ring-2 focus:ring-ring/50"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="p-3 sm:p-4">
          {loading ? (
            <LoadingState label="Loading your documents…" />
          ) : error ? (
            <ErrorState message={error} onRetry={fetchDocuments} />
          ) : filteredDocs.length === 0 ? (
            <EmptyState
              icon={Folder}
              title={search ? 'No matching documents' : 'No documents shared yet'}
              description={
                search
                  ? 'Try a different search term.'
                  : 'Files your account manager shares with you will appear here.'
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {filteredDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="group flex flex-col rounded-[var(--radius)] border border-border bg-card p-5 transition hover:border-primary/30 hover:shadow-md"
                >
                  <div className="mb-4 flex items-start justify-between">
                    <span className="flex h-11 w-11 items-center justify-center rounded-[var(--radius)] bg-primary/10 text-primary">
                      <FileText size={22} />
                    </span>
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-h-11 min-w-11 items-center justify-center rounded-[var(--radius-sm)] bg-muted text-muted-foreground transition hover:bg-primary hover:text-primary-foreground"
                      aria-label={`Download ${doc.name}`}
                    >
                      <Download size={18} />
                    </a>
                  </div>

                  <h3 className="mb-1 text-base font-bold text-foreground">{doc.name}</h3>
                  {doc.description && (
                    <p className="mb-4 line-clamp-2 text-sm text-muted-foreground">{doc.description}</p>
                  )}

                  <div className="mt-auto flex items-center gap-1.5 text-eyebrow">
                    <Clock size={12} />
                    Shared {new Date(doc.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ClientLayout>
  );
}
