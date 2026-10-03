'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  CrmProviderSummary,
  connectCrmWithCredentials,
  getCrmConnectUrl,
  getCrmProviders,
} from '@/lib/integrations';
import { getApiErrorMessage } from '@/lib/api-error';
import { ArrowLeft, ExternalLink, Loader2, Plug, Search } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after an API-key provider connects, so the page can refresh. */
  onConnected?: () => void;
  /** Opens the CSV import flow for CRMs with no direct connector. */
  onImportCsv?: () => void;
}

export default function CrmConnectDialog({
  open,
  onOpenChange,
  onConnected,
  onImportCsv,
}: Props) {
  const [providers, setProviders] = useState<CrmProviderSummary[]>([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<CrmProviderSummary | null>(null);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    getCrmProviders()
      .then((list) => {
        if (!cancelled) setProviders(list);
      })
      .catch((err) => {
        if (!cancelled) setError(getApiErrorMessage(err, 'Could not load the CRM list.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const reset = () => {
    setQuery('');
    setSelected(null);
    setCredentials({});
    setError('');
    setBusy(false);
  };

  const close = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  /**
   * A tenant can always connect an api_key provider. OAuth providers need
   * credentials registered on our side first, so hide the ones that have
   * none rather than showing a dead "Not configured" card.
   */
  const connectable = useMemo(
    () => providers.filter((provider) => provider.auth_kind === 'api_key' || provider.configured),
    [providers],
  );

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return connectable;
    return connectable.filter((provider) => provider.label.toLowerCase().includes(term));
  }, [connectable, query]);

  /**
   * Both kinds get a second step: api_key providers collect credentials,
   * oauth providers confirm before we hand the person off to the CRM, so
   * the redirect is never a surprise.
   */
  const choose = (provider: CrmProviderSummary) => {
    setSelected(provider);
    setCredentials({});
    setError('');
  };

  const startOauth = async () => {
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      const result = await getCrmConnectUrl(selected.key);
      window.location.assign(result.url);
    } catch (err) {
      setError(getApiErrorMessage(err, `Could not start the ${selected.label} connection.`));
      setBusy(false);
    }
  };

  const submitCredentials = async () => {
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      await connectCrmWithCredentials(selected.key, credentials);
      onConnected?.();
      close(false);
    } catch (err) {
      setError(getApiErrorMessage(err, `Could not connect ${selected.label}.`));
    } finally {
      setBusy(false);
    }
  };

  const missingField = selected?.credential_fields.some(
    (field) => !credentials[field.key]?.trim(),
  );

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {selected ? `Connect ${selected.label}` : 'Connect your CRM'}
          </DialogTitle>
          <DialogDescription>
            {selected
              ? 'Enter the credentials from your CRM. We check them before saving.'
              : 'Pick your CRM to sync contacts both ways.'}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error}
          </div>
        )}

        {!selected ? (
          <div className="space-y-4">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
                size={16}
              />
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search CRMs..."
                className="w-full rounded-lg border border-white/10 bg-slate-950/40 py-2 pl-9 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none"
              />
            </div>

            <div className="rounded-lg border border-white/10 bg-slate-950/30 px-3 py-2.5 text-xs text-slate-400">
              Connecting lets you pull contacts in as leads and push prospects
              from Prospect Search back out to your CRM. We only read and write
              contacts &mdash; nothing else in your account.
            </div>

            {loading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-400">
                <Loader2 className="animate-spin" size={16} />
                Loading CRMs...
              </div>
            ) : visible.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">
                No CRM matches &ldquo;{query}&rdquo;.
              </p>
            ) : (
              <div className="grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2">
                {visible.map((provider) => (
                  <button
                    key={provider.key}
                    type="button"
                    disabled={busy}
                    onClick={() => choose(provider)}
                    className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-3 text-left text-sm font-semibold text-white transition hover:border-indigo-400/40 hover:bg-indigo-400/10 disabled:opacity-60"
                  >
                    <Plug className="shrink-0 text-indigo-300" size={16} />
                    <span className="truncate">{provider.label}</span>
                  </button>
                ))}
              </div>
            )}

            {onImportCsv && (
              <div className="border-t border-white/10 pt-3 text-sm text-slate-400">
                Don&rsquo;t see yours?{' '}
                <button
                  type="button"
                  className="font-semibold text-indigo-300 underline-offset-2 hover:underline"
                  onClick={() => {
                    close(false);
                    onImportCsv();
                  }}
                >
                  Import a CSV instead
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {selected.setup_steps && selected.setup_steps.length > 0 && (
              <div className="rounded-lg border border-white/10 bg-slate-950/30 px-3 py-2.5">
                <div className="mb-1.5 text-xs font-black uppercase tracking-widest text-slate-500">
                  Where to find these
                </div>
                <ol className="list-decimal space-y-1 pl-4 text-xs text-slate-400">
                  {selected.setup_steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                {selected.docs_url && (
                  <a
                    href={selected.docs_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-300 underline-offset-2 hover:underline"
                  >
                    {selected.label} API docs
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>
            )}

            {selected.auth_kind === 'oauth' && (
              <p className="text-sm text-slate-400">
                We&rsquo;ll send you to {selected.label} to sign in and approve
                access, then bring you straight back here.
              </p>
            )}

            {selected.credential_fields.map((field) => (
              <div key={field.key}>
                <label className="mb-1 block text-sm font-semibold text-slate-300">
                  {field.label}
                </label>
                <input
                  type={field.key.toLowerCase().includes('key') ? 'password' : 'text'}
                  value={credentials[field.key] || ''}
                  placeholder={field.placeholder || undefined}
                  onChange={(event) =>
                    setCredentials((current) => ({
                      ...current,
                      [field.key]: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-white/10 bg-slate-950/40 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none"
                />
                {field.help_text && (
                  <p className="mt-1 text-xs text-slate-500">{field.help_text}</p>
                )}
              </div>
            ))}

            {selected.auth_kind === 'api_key' && (
              <p className="text-xs text-slate-500">
                Your credentials are encrypted before they are stored, and are never
                shown again after saving.
              </p>
            )}

            <div className="flex items-center justify-between gap-3 pt-1">
              <Button
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  setSelected(null);
                  setError('');
                }}
              >
                <ArrowLeft size={15} />
                Back
              </Button>
              <Button
                type="button"
                disabled={busy || missingField}
                onClick={selected.auth_kind === 'oauth' ? startOauth : submitCredentials}
              >
                {busy ? <Loader2 className="animate-spin" size={15} /> : <Plug size={15} />}
                {selected.auth_kind === 'oauth' ? `Continue to ${selected.label}` : 'Connect'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
