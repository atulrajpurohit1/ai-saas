'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, CornerDownLeft } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/context/AuthContext';
import { DASHBOARD_LINK, NAV_GROUPS, type NavLink } from '@/lib/nav-links';
import { cn } from '@/lib/utils';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Client-side quick-nav over the app's own real navigation - not a new
// backend search. Every entry here is a route the user can already reach
// from the Sidebar; this just makes reaching it a keystroke instead of a
// scroll-and-click.
export default function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const { canAny } = useAuth();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const results = useMemo(() => {
    const visibleDashboard = canAny(DASHBOARD_LINK.permissions) ? [DASHBOARD_LINK] : [];
    const visibleGroups = NAV_GROUPS.map((group) => ({
      ...group,
      links: group.links.filter((link) => canAny(link.permissions)),
    })).filter((group) => group.links.length > 0);

    const q = query.trim().toLowerCase();
    const matches = (link: NavLink) => !q || link.label.toLowerCase().includes(q);

    const groups: { label: string; links: NavLink[] }[] = [];
    const dashboardMatches = visibleDashboard.filter(matches);
    if (dashboardMatches.length > 0) groups.push({ label: 'Workspace', links: dashboardMatches });
    for (const group of visibleGroups) {
      const links = group.links.filter(matches);
      if (links.length === 0) continue;
      const existing = groups.find((g) => g.label === group.label);
      if (existing) existing.links.push(...links);
      else groups.push({ label: group.label, links });
    }
    return groups;
  }, [query, canAny]);

  const flatCount = results.reduce((sum, g) => sum + g.links.length, 0);

  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogTitle className="sr-only">Quick navigation</DialogTitle>
        <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
          <Search size={17} className="shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && flatCount > 0) {
                go(results[0].links[0].href);
              }
            }}
            placeholder="Jump to a page..."
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground sm:inline">
            Esc
          </kbd>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2">
          {flatCount === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">No matching pages.</p>
          ) : (
            results.map((group) => (
              <div key={group.label} className="mb-1">
                <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
                  {group.label}
                </p>
                {group.links.map((link) => {
                  const Icon = link.icon;
                  return (
                    <button
                      key={link.href}
                      type="button"
                      onClick={() => go(link.href)}
                      className={cn(
                        'group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-foreground transition-colors hover:bg-primary/8 hover:text-primary',
                      )}
                    >
                      <Icon size={16} className="shrink-0 text-muted-foreground group-hover:text-primary" />
                      <span className="flex-1 truncate">{link.label}</span>
                      <CornerDownLeft size={13} className="shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
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
