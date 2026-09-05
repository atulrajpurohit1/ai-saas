'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, CornerDownLeft, Clock, Zap } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/context/AuthContext';
import { DASHBOARD_LINK, NAV_GROUPS, type NavLink } from '@/lib/nav-links';
import { QUICK_ACTIONS } from '@/lib/quick-actions';
import { useRecentPages } from '@/hooks/useRecentPages';
import { cn } from '@/lib/utils';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface PaletteItem {
  key: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

interface PaletteGroup {
  label: string;
  items: PaletteItem[];
}

// Highlights the matched substring of a label without dangerouslySetInnerHTML.
function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-transparent font-bold text-primary">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
}

/**
 * Client-side quick-nav + quick-actions over the app's own real navigation.
 * Not a new backend search. Every entry is a route the user can already reach;
 * this just makes reaching it a keystroke. Quick actions route to existing
 * create flows (see lib/quick-actions.ts).
 */
export default function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const { canAny } = useAuth();
  const { recent, record } = useRecentPages();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const navGroups = useMemo<PaletteGroup[]>(() => {
    const q = query.trim().toLowerCase();
    const matches = (label: string) => !q || label.toLowerCase().includes(q);

    const groups: PaletteGroup[] = [];

    // Quick actions first (only meaningful when not deep in a filtered search,
    // but still filterable).
    const actions = QUICK_ACTIONS.filter((a) => canAny(a.permissions) && matches(a.label)).map((a) => ({
      key: `action:${a.href}`,
      label: a.label,
      href: a.href,
      icon: a.icon,
    }));
    if (actions.length > 0) groups.push({ label: 'Quick actions', items: actions });

    // Recent pages (skip while actively searching to keep the list tight).
    if (!q && recent.length > 0) {
      groups.push({
        label: 'Recent',
        items: recent.map((r) => ({ key: `recent:${r.href}`, label: r.label, href: r.href, icon: Clock })),
      });
    }

    // Full navigation.
    const dashboard = canAny(DASHBOARD_LINK.permissions) && matches(DASHBOARD_LINK.label)
      ? [{ key: DASHBOARD_LINK.href, label: DASHBOARD_LINK.label, href: DASHBOARD_LINK.href, icon: DASHBOARD_LINK.icon }]
      : [];
    if (dashboard.length > 0) groups.push({ label: 'Workspace', items: dashboard });

    for (const group of NAV_GROUPS) {
      const items = group.links
        .filter((link: NavLink) => canAny(link.permissions) && matches(link.label))
        .map((link) => ({ key: link.href, label: link.label, href: link.href, icon: link.icon }));
      if (items.length === 0) continue;
      const existing = groups.find((g) => g.label === group.label);
      if (existing) existing.items.push(...items);
      else groups.push({ label: group.label, items });
    }

    return groups;
  }, [query, canAny, recent]);

  const flatItems = useMemo(() => navGroups.flatMap((g) => g.items), [navGroups]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  const go = (item: PaletteItem) => {
    onOpenChange(false);
    // Only nav destinations (not ?new= action routes) are worth "recent"-ing.
    if (!item.href.includes('?')) record(item.href, item.label);
    router.push(item.href);
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onOpenChange(!open);
      }
      if (event.key === 'Escape' && open) {
        onOpenChange(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onOpenChange]);

  // Keep the active row scrolled into view.
  useEffect(() => {
    const node = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    node?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  let runningIndex = -1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
          <Search size={17} className="shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActiveIndex((i) => Math.min(i + 1, flatItems.length - 1));
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActiveIndex((i) => Math.max(i - 1, 0));
              } else if (event.key === 'Enter' && flatItems[activeIndex]) {
                event.preventDefault();
                go(flatItems[activeIndex]);
              }
            }}
            placeholder="Search pages and actions..."
            aria-label="Search pages and actions"
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground sm:inline">
            Esc
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[60vh] overflow-y-auto p-2">
          {flatItems.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No pages or actions match &ldquo;{query}&rdquo;.
            </p>
          ) : (
            navGroups.map((group) => (
              <div key={group.label} className="mb-1">
                <p className="flex items-center gap-1.5 px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                  {group.label === 'Quick actions' && <Zap size={11} aria-hidden="true" />}
                  {group.label}
                </p>
                {group.items.map((item) => {
                  runningIndex += 1;
                  const index = runningIndex;
                  const Icon = item.icon;
                  const isActive = index === activeIndex;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      data-index={index}
                      onClick={() => go(item)}
                      onMouseMove={() => setActiveIndex(index)}
                      className={cn(
                        'group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors',
                        isActive ? 'bg-primary/8 text-primary' : 'text-foreground',
                      )}
                    >
                      <Icon size={16} className={cn('shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')} />
                      <span className="flex-1 truncate">
                        <Highlight text={item.label} query={query} />
                      </span>
                      <CornerDownLeft
                        size={13}
                        className={cn('shrink-0 text-muted-foreground', isActive ? 'opacity-100' : 'opacity-0')}
                        aria-hidden="true"
                      />
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
