'use client';

import React from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

/**
 * Shown at the top of AI-first pages for a tenant whose plan excludes AI (the
 * AegisLead Trial plan). It explains why the AI actions on the page do nothing
 * and points at the upgrade path, so a Trial user understands the limit rather
 * than clicking into a refusal. Renders nothing for everyone else, so it is
 * safe to drop onto any page unconditionally.
 *
 * This is the visible half of the Trial AI gate; the backend is the real
 * boundary (403 AI_NOT_ON_PLAN), and the API layer shows a toast as a backstop
 * if an AI action is reached anyway.
 */
export default function AiPlanNotice({ feature }: { feature?: string }) {
  const { aiEnabled, loading } = useAuth();
  if (loading || aiEnabled) return null;

  return (
    <div className="mb-5 flex flex-col gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2.5">
        <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div>
          <p className="text-sm font-semibold text-foreground">
            AI features are not on your plan
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {feature ?? 'The AI tools on this page'} require a paid plan. Your
            Trial plan includes everything else — upgrade any time to switch AI
            on.
          </p>
        </div>
      </div>
      <Link
        href="/settings/plan"
        className="shrink-0 rounded-lg bg-primary px-3.5 py-2 text-center text-sm font-semibold text-primary-foreground transition hover:opacity-90"
      >
        View plans
      </Link>
    </div>
  );
}
