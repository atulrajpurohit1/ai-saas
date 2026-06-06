'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, FileJson, Loader2 } from 'lucide-react';

type OpenApiPath = Record<string, { summary?: string; description?: string }>;

function getDocsBaseUrl() {
  const fallbackUrl = 'https://ai-saas-backend-ulpb.onrender.com/api';
  const envUrl = process.env.NEXT_PUBLIC_API_URL || fallbackUrl;
  return envUrl.split('/api')[0].replace(/\/+$/, '');
}

export default function ApiDocsPage() {
  const docsBaseUrl = useMemo(() => getDocsBaseUrl(), []);
  const openApiUrl = `${docsBaseUrl}/api-docs/openapi.json`;
  const docsUrl = `${docsBaseUrl}/api-docs`;
  const [paths, setPaths] = useState<Record<string, OpenApiPath>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadDocs = async () => {
      try {
        const res = await fetch(openApiUrl);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setPaths(data.paths || {});
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load OpenAPI document.');
      } finally {
        setLoading(false);
      }
    };

    loadDocs();
  }, [openApiUrl]);

  return (
    <main className="min-h-screen bg-[#0f172a] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="flex items-center gap-3 text-3xl font-black">
              <FileJson className="text-indigo-300" size={30} />
              Public API Docs
            </h1>
            <p className="mt-2 text-slate-400">OpenAPI 3.0</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href={openApiUrl}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-bold text-white transition hover:bg-white/10"
            >
              <FileJson size={17} />
              JSON
            </a>
            <a
              href={docsUrl}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-500 px-4 text-sm font-bold text-white transition hover:bg-indigo-400"
            >
              <ExternalLink size={17} />
              Backend Docs
            </a>
          </div>
        </div>

        {loading ? (
          <div className="py-24 text-center text-slate-400">
            <Loader2 className="mx-auto mb-3 animate-spin text-indigo-300" size={28} />
            Loading docs...
          </div>
        ) : error ? (
          <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-300">
            {error}
          </div>
        ) : (
          <div className="space-y-3">
            {Object.entries(paths).flatMap(([path, methods]) =>
              Object.entries(methods).map(([method, operation]) => (
                <article key={`${method}:${path}`} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="min-w-16 rounded-lg bg-sky-400/10 px-3 py-1 text-center text-xs font-black uppercase tracking-widest text-sky-300">
                      {method}
                    </span>
                    <code className="break-all text-sm text-indigo-200">/api{path}</code>
                  </div>
                  <div className="mt-3 font-bold text-white">{operation.summary}</div>
                  <div className="mt-1 text-sm text-slate-400">{operation.description}</div>
                </article>
              )),
            )}
          </div>
        )}
      </div>
    </main>
  );
}
