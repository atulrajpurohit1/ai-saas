'use client';

import React, { useEffect, useState } from 'react';
import { GitBranch, Loader2 } from 'lucide-react';
import { Branch, getBranches } from '@/lib/branches';

interface BranchSelectProps {
  value: string;
  onChange: (branchId: string) => void;
  includeAll?: boolean;
  label?: string;
  className?: string;
}

export default function BranchSelect({
  value,
  onChange,
  includeAll = true,
  label = 'Branch',
  className = '',
}: BranchSelectProps) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    getBranches()
      .then((nextBranches) => {
        if (mounted) setBranches(nextBranches);
      })
      .catch((err) => console.error('Failed to load branches:', err))
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <label className={`block space-y-1 ${className}`}>
      <span className="text-xs font-bold uppercase tracking-widest text-slate-500">{label}</span>
      <div className="relative">
        <GitBranch className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-300" size={16} />
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={loading}
          className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-9 text-sm text-white outline-none transition focus:ring-2 focus:ring-indigo-500/40 disabled:opacity-60"
        >
          {includeAll && <option value="" className="bg-[#0e0e1a] text-white">All branches</option>}
          {!includeAll && <option value="" className="bg-[#0e0e1a] text-white">Unassigned</option>}
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id} className="bg-[#0e0e1a] text-white">
              {branch.name}
            </option>
          ))}
        </select>
        {loading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-500" size={15} />}
      </div>
    </label>
  );
}

export function BranchBadge({ branch }: { branch?: { name?: string | null } | null }) {
  if (!branch?.name) {
    return (
      <span className="inline-flex rounded-full border border-slate-500/20 bg-slate-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
        Unassigned
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-sky-200">
      {branch.name}
    </span>
  );
}
