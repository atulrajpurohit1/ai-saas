'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle, ArrowLeft, Loader2, Printer, QrCode } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Checkpoint, getCheckpoints } from '@/lib/patrols';
import { buildQrPath, type QrPath } from '@/lib/qr-sticker';

// Printable QR sticker sheet for a site's checkpoints.
//
// Deliberately NOT wrapped in DashboardLayout: the sidebar, header and
// command palette would all have to be hidden again for print, and a
// standalone route keeps the paper output under this file's own control.
// The access check below therefore stands in for the layout's.
//
// This page only ever renders codes that already exist on checkpoints. It
// never creates, changes or re-issues one - a sticker already mounted on a
// gate has to keep scanning, so assigning codes stays a deliberate act on
// the checkpoint form.

const STICKER_SIZES = {
  small: { label: 'Small - 12 per page', cols: 3, height: '70mm' },
  standard: { label: 'Standard - 6 per page', cols: 2, height: '93mm' },
  large: { label: 'Large - 2 per page', cols: 1, height: '140mm' },
} as const;

type StickerSize = keyof typeof STICKER_SIZES;

interface PrintableSticker {
  id: string;
  name: string;
  siteName: string;
  value: string;
  qr: QrPath;
}

function Sticker({ sticker }: { sticker: PrintableSticker }) {
  return (
    <div className="qr-sticker">
      <span className="qr-sticker-site">{sticker.siteName}</span>
      <svg
        className="qr-sticker-code-svg"
        viewBox={`0 0 ${sticker.qr.size} ${sticker.qr.size}`}
        role="img"
        aria-label={`QR code for ${sticker.name}`}
      >
        {/* An explicit white backing rect, not just the page background: a
            QR scanner needs the quiet zone to be light, and some printers
            render an unpainted SVG area as the paper's own tint. */}
        <rect width={sticker.qr.size} height={sticker.qr.size} fill="#fff" />
        <path d={sticker.qr.path} fill="#000" />
      </svg>
      <span className="qr-sticker-name">{sticker.name}</span>
      <span className="qr-sticker-value">{sticker.value}</span>
    </div>
  );
}

function CheckpointPrintSheet() {
  const searchParams = useSearchParams();
  const siteId = searchParams.get('site_id') || '';
  const { user, loading: authLoading, can } = useAuth();

  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [size, setSize] = useState<StickerSize>('standard');

  const allowed = Boolean(user) && can('patrols.view');

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        setLoadFailed(false);
        const result = await getCheckpoints(siteId || undefined);
        if (!cancelled) setCheckpoints(result);
      } catch (err) {
        console.error(err);
        // Surfaced as a message rather than an empty sheet: printing a blank
        // page because a request failed would look like "this site has no
        // checkpoints", which is a very different thing.
        if (!cancelled) setLoadFailed(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [allowed, siteId]);

  // Split once, up front, so the toolbar can account for every checkpoint
  // the user expected to see on the sheet and explain the ones that aren't.
  const { printable, missingCode, failed, inactive } = useMemo(() => {
    const printable: PrintableSticker[] = [];
    const missingCode: Checkpoint[] = [];
    const failed: Checkpoint[] = [];
    const inactive: Checkpoint[] = [];

    for (const cp of checkpoints) {
      if (cp.status !== 'active') {
        inactive.push(cp);
        continue;
      }
      const value = cp.qrCodeValue?.trim();
      if (!value) {
        missingCode.push(cp);
        continue;
      }
      try {
        printable.push({
          id: cp.id,
          name: cp.name,
          siteName: cp.site?.name || 'Unassigned site',
          value,
          qr: buildQrPath(value),
        });
      } catch (err) {
        // One unencodable code must not take the rest of the sheet down.
        console.error(`Could not encode QR for checkpoint ${cp.id}`, err);
        failed.push(cp);
      }
    }

    return { printable, missingCode, failed, inactive };
  }, [checkpoints]);

  const siteName = printable[0]?.siteName || checkpoints[0]?.site?.name || '';

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="mx-auto max-w-lg px-6 py-20 text-center">
        <h1 className="text-xl font-bold">Patrol access required</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You don&apos;t have permission to view checkpoints, so there are no QR codes
          to print here.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
        >
          <ArrowLeft size={14} />
          Back to dashboard
        </Link>
      </div>
    );
  }

  const excludedCount = missingCode.length + failed.length;

  return (
    <div className="qr-print-root mx-auto max-w-5xl px-4 py-8 sm:px-8">
      <div className="qr-noprint">
        <Link
          href="/patrol/checkpoints"
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft size={14} />
          Back to checkpoints
        </Link>

        <div className="mt-4 flex flex-col gap-4 border-b border-black/10 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">Print checkpoint QR codes</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {siteId && siteName
                ? `Stickers for ${siteName}.`
                : 'Stickers for every site.'}{' '}
              Print, cut along the dashed lines and mount each one at its checkpoint.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="flex items-center gap-2 text-sm">
              <span className="shrink-0 font-medium text-muted-foreground">Size:</span>
              <select
                value={size}
                onChange={(e) => setSize(e.target.value as StickerSize)}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {Object.entries(STICKER_SIZES).map(([key, cfg]) => (
                  <option key={key} value={key}>
                    {cfg.label}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={() => window.print()}
              disabled={printable.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3 font-bold text-white shadow-lg transition-all hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Printer size={18} />
              {printable.length > 0
                ? `Print ${printable.length} sticker${printable.length === 1 ? '' : 's'}`
                : 'Print'}
            </button>
          </div>
        </div>

        {loadFailed && (
          <div className="mt-6 flex items-start gap-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm">
            <AlertTriangle className="mt-0.5 shrink-0 text-rose-500" size={16} />
            <p>
              Couldn&apos;t load checkpoints. Refresh the page to try again - nothing has
              been printed.
            </p>
          </div>
        )}

        {!loading && !loadFailed && excludedCount > 0 && (
          <div className="mt-6 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 shrink-0 text-amber-500" size={16} />
              <div>
                <p className="font-semibold">
                  {excludedCount} checkpoint{excludedCount === 1 ? '' : 's'} not on this
                  sheet
                </p>
                {missingCode.length > 0 && (
                  <p className="mt-1 text-muted-foreground">
                    No QR code set yet: {missingCode.map((cp) => cp.name).join(', ')}.
                    Open each one on the checkpoints page and fill in its QR code value
                    first.
                  </p>
                )}
                {failed.length > 0 && (
                  <p className="mt-1 text-muted-foreground">
                    Code could not be turned into a QR image:{' '}
                    {failed.map((cp) => cp.name).join(', ')}.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {!loading && !loadFailed && inactive.length > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            {inactive.length} inactive checkpoint
            {inactive.length === 1 ? ' was' : 's were'} left out of this sheet.
          </p>
        )}
      </div>

      {loading ? (
        <div className="qr-noprint flex items-center justify-center py-24">
          <Loader2 className="animate-spin text-primary" size={28} />
        </div>
      ) : printable.length === 0 ? (
        !loadFailed && (
          <div className="qr-noprint flex flex-col items-center justify-center py-24 text-center">
            <QrCode className="text-muted-foreground" size={32} />
            <p className="mt-4 font-semibold">Nothing to print yet</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              None of these checkpoints has a QR code value set, so there are no
              stickers to produce.
            </p>
            <Link
              href="/patrol/checkpoints"
              className="mt-6 inline-flex items-center gap-2 rounded-2xl bg-primary px-6 py-3 font-bold text-white shadow-lg transition-all hover:bg-indigo-500"
            >
              Set up checkpoint codes
            </Link>
          </div>
        )
      ) : (
        <div
          className="qr-sheet mt-8"
          style={
            {
              '--qr-cols': STICKER_SIZES[size].cols,
              '--qr-sticker-height': STICKER_SIZES[size].height,
            } as React.CSSProperties
          }
        >
          {printable.map((sticker) => (
            <Sticker key={sticker.id} sticker={sticker} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CheckpointPrintPage() {
  return (
    <Suspense fallback={null}>
      <CheckpointPrintSheet />
    </Suspense>
  );
}
