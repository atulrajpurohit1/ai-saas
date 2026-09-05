'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'aegislead-recent-pages';
const MAX_ENTRIES = 5;

export interface RecentPage {
  href: string;
  label: string;
  /** epoch ms */
  at: number;
}

function read(): RecentPage[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as RecentPage[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Tracks the last few nav destinations the user visited, for the command
 * palette's "Recent" section. Client-only, localStorage-backed - no backend.
 */
export function useRecentPages() {
  const [recent, setRecent] = useState<RecentPage[]>([]);

  useEffect(() => {
    setRecent(read());
  }, []);

  const record = useCallback((href: string, label: string) => {
    if (typeof window === 'undefined') return;
    const next = [
      { href, label, at: Date.now() },
      ...read().filter((entry) => entry.href !== href),
    ].slice(0, MAX_ENTRIES);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setRecent(next);
  }, []);

  return { recent, record };
}
