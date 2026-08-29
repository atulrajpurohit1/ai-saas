import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut, X, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getBranding } from '@/lib/branding';
import { cn } from '@/lib/utils';
import { DASHBOARD_LINK, NAV_GROUPS, type NavLink } from '@/lib/nav-links';

const SIDEBAR_SCROLL_KEY = 'ai-saas-sidebar-scroll-top';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}

export default function Sidebar({ isOpen = false, onClose, collapsed = false, onToggleCollapsed }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout, canAny } = useAuth();
  const navRef = useRef<HTMLElement | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);

  useEffect(() => {
    getBranding()
      .then((branding) => {
        setLogoUrl(branding.logo_url || null);
        setCompanyName(branding.company_name || null);
      })
      .catch(() => {
        // Roles without branding.view (or a network hiccup) just keep the
        // default wordmark below - not worth surfacing an error for this.
      });
  }, []);

  const toggleCollapsed = () => {
    onToggleCollapsed?.();
  };

  const visibleDashboardLink = canAny(DASHBOARD_LINK.permissions) ? DASHBOARD_LINK : null;
  const visibleNavGroups = NAV_GROUPS
    .map((group) => ({ ...group, links: group.links.filter((link) => canAny(link.permissions)) }))
    .filter((group) => group.links.length > 0);
  const links = [
    ...(visibleDashboardLink ? [visibleDashboardLink] : []),
    ...visibleNavGroups.flatMap((group) => group.links),
  ];

  const saveScrollPosition = () => {
    if (typeof window === 'undefined' || !navRef.current) return;
    sessionStorage.setItem(SIDEBAR_SCROLL_KEY, String(navRef.current.scrollTop));
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const restoreScroll = () => {
      const storedScrollTop = sessionStorage.getItem(SIDEBAR_SCROLL_KEY);
      const nextScrollTop = storedScrollTop ? Number(storedScrollTop) : 0;

      if (navRef.current && Number.isFinite(nextScrollTop)) {
        navRef.current.scrollTop = nextScrollTop;
      }
    };

    const frame = window.requestAnimationFrame(restoreScroll);
    return () => window.cancelAnimationFrame(frame);
  }, [links.length, pathname]);

  const renderLink = (link: NavLink) => {
    const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
    const Icon = link.icon;

    return (
      <Link
        key={link.href}
        href={link.href}
        onClick={() => {
          saveScrollPosition();
          onClose?.();
        }}
        title={collapsed ? link.label : undefined}
        className={cn(
          'group relative flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-150',
          collapsed && 'lg:justify-center lg:px-2',
          isActive
            ? 'bg-primary/8 font-semibold text-primary'
            : 'font-medium text-muted-foreground hover:bg-black/[0.03] hover:text-foreground',
        )}
      >
        {isActive && (
          <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-primary" aria-hidden="true" />
        )}
        <Icon size={18} className={cn('shrink-0', isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')} />
        <span className={cn('truncate', collapsed && 'lg:hidden')}>{link.label}</span>
      </Link>
    );
  };

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-50 flex h-dvh w-[min(18rem,calc(100vw-1.5rem))] flex-col border-r border-border bg-card transition-[transform,width] duration-200 lg:translate-x-0',
        collapsed ? 'lg:w-[4.5rem]' : 'lg:w-64',
        isOpen ? 'translate-x-0' : '-translate-x-full',
      )}
    >
      <div className={cn('flex items-start justify-between gap-4 p-4 sm:p-5', collapsed && 'lg:justify-center lg:px-3')}>
        <div className={cn('min-w-0', collapsed && 'lg:hidden')}>
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={companyName || user?.tenantName || 'Company logo'}
              className="mb-1.5 h-8 max-w-full object-contain object-left"
            />
          ) : (
            <h1 className="pb-1.5 text-xl font-bold gradient-text">Ai Saas</h1>
          )}
          <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {companyName || user?.tenantName || 'Management'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-muted-foreground transition hover:bg-black/[0.04] hover:text-foreground lg:hidden"
          aria-label="Close navigation"
        >
          <X size={20} />
        </button>
      </div>

      <nav
        ref={navRef}
        onScroll={saveScrollPosition}
        className="flex-1 space-y-1 overflow-y-auto px-3 py-2"
      >
        {visibleDashboardLink && (
          <div className="mb-2">
            {renderLink(visibleDashboardLink)}
          </div>
        )}

        {visibleNavGroups.map((group) => (
          <div key={group.label} className="mb-2">
            <p className={cn(
              'px-3 pb-1.5 pt-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70',
              collapsed && 'lg:hidden',
            )}>
              {group.label}
            </p>
            <div className="space-y-0.5">{group.links.map(renderLink)}</div>
          </div>
        ))}
      </nav>

      <div className="hidden border-t border-border p-2 lg:block">
        <button
          type="button"
          onClick={toggleCollapsed}
          className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold text-muted-foreground transition hover:bg-black/[0.03] hover:text-foreground"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>

      <div className="mt-auto border-t border-border p-3">
        <div className={cn('mb-1 flex items-center gap-3 rounded-lg px-2 py-2', collapsed && 'lg:justify-center')}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
            {user?.name?.charAt(0) || 'U'}
          </div>
          <div className={cn('min-w-0 flex-1', collapsed && 'lg:hidden')}>
            <p className="truncate text-sm font-semibold text-foreground">{user?.name}</p>
            <span className="inline-block rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {user?.role}
            </span>
          </div>
        </div>
        <button
          onClick={logout}
          title={collapsed ? 'Logout' : undefined}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium text-error transition-colors hover:bg-error-wash',
            collapsed && 'lg:justify-center',
          )}
        >
          <LogOut size={18} />
          <span className={cn(collapsed && 'lg:hidden')}>Logout</span>
        </button>
      </div>
    </aside>
  );
}
