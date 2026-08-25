'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface StatDeltaProps {
  deltaPct: number | null;
  hasActivity: boolean;
}

// Real period-over-period delta (vs the previous 7 days), replacing a
// previously-hardcoded "+12%" shown on every card regardless of data.
export default function StatDelta({ deltaPct, hasActivity }: StatDeltaProps) {
  if (deltaPct === null) {
    if (!hasActivity) {
      return (
        <div className="flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1 text-sm font-bold text-slate-500">
          <Minus size={14} />
          <span>--</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1 rounded-lg bg-indigo-500/10 px-2 py-1 text-sm font-bold text-indigo-300">
        <span>New</span>
      </div>
    );
  }

  if (deltaPct === 0) {
    return (
      <div className="flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1 text-sm font-bold text-slate-400">
        <Minus size={14} />
        <span>0%</span>
      </div>
    );
  }

  const isUp = deltaPct > 0;
  return (
    <div
      className={`flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-bold ${
        isUp ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
      }`}
    >
      {isUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
      <span>{isUp ? '+' : ''}{deltaPct}%</span>
    </div>
  );
}
