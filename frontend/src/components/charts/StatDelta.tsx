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
        <div className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">
          <Minus size={12} />
          <span>--</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1 rounded-md bg-primary/8 px-2 py-1 text-xs font-semibold text-primary">
        <span>New</span>
      </div>
    );
  }

  if (deltaPct === 0) {
    return (
      <div className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">
        <Minus size={12} />
        <span>0%</span>
      </div>
    );
  }

  const isUp = deltaPct > 0;
  return (
    <div
      className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold ring-1 ring-inset ${
        isUp ? 'bg-success-wash text-success ring-success/20' : 'bg-error-wash text-error ring-error/20'
      }`}
    >
      {isUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      <span>{isUp ? '+' : ''}{deltaPct}%</span>
    </div>
  );
}
