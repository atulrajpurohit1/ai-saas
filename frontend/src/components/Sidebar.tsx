import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  FileText,
  LogOut,
  ChevronRight,
  MapPin,
  ShieldCheck,
  CalendarClock,
  Activity,
  Navigation,
  FileWarning,
  ClipboardList,
  ClipboardCheck,
  BadgeDollarSign,
  DollarSign,
  Receipt,
  X,
  BrainCircuit,
  GitBranch,
  Settings,
  Plug,
  Palette,
  FileSpreadsheet,
  PhoneCall,
  CreditCard,
  Radar,
  Building2,
  FileCheck2
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { getBranding } from '@/lib/branding';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const SIDEBAR_SCROLL_KEY = 'ai-saas-sidebar-scroll-top';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout, canAny } = useAuth();
  const navRef = useRef<HTMLElement | null>(null);
  const [logoUrl, setLogoUrl] = React.useState<string | null>(null);
  const [companyName, setCompanyName] = React.useState<string | null>(null);

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

  const dashboardLink = { href: '/', label: 'Dashboard', icon: LayoutDashboard, permissions: ['dashboard.view'] };

  const navGroups = [
    {
      label: 'Sales / CRM',
      links: [
        { href: '/leads', label: 'Leads', icon: Users, permissions: ['leads.view'] },
        { href: '/deals', label: 'Deals', icon: Briefcase, permissions: ['deals.view'] },
        { href: '/prospect-search', label: 'Prospect Search', icon: Radar, permissions: ['prospect_search.view'] },
        { href: '/sales-accelerator', label: 'Sales Accelerator', icon: BrainCircuit, permissions: ['ai.view', 'leads.view'] },
        { href: '/sales-calls', label: 'Sales Calls', icon: PhoneCall, permissions: ['ai.view', 'deals.view'] },
        { href: '/proposals', label: 'Proposals', icon: FileText, permissions: ['proposals.view'] },
        { href: '/rfp', label: 'RFP Management', icon: FileSpreadsheet, permissions: ['rfp.view'] },
        { href: '/vendors', label: 'Vendors', icon: Building2, permissions: ['vendors.view'] },
      ],
    },
    {
      label: 'Operations',
      links: [
        { href: '/branches', label: 'Branches', icon: GitBranch, permissions: ['branches.view'] },
        { href: '/sites', label: 'Sites', icon: MapPin, permissions: ['sites.view'] },
        { href: '/guards', label: 'Guards', icon: ShieldCheck, permissions: ['guards.view'] },
        { href: '/guards/compliance', label: 'Guard Compliance', icon: FileCheck2, permissions: ['guards.view'] },
        { href: '/shifts', label: 'Shifts', icon: CalendarClock, permissions: ['shifts.view'] },
        { href: '/patrol/checkpoints', label: 'Patrols', icon: Navigation, permissions: ['patrols.view'] },
        { href: '/incidents', label: 'Incidents', icon: FileWarning, permissions: ['incidents.view'] },
        { href: '/reports', label: 'Reports', icon: ClipboardList, permissions: ['reports.view'] },
        { href: '/timesheets', label: 'Timesheets', icon: ClipboardCheck, permissions: ['timesheets.view'] },
      ],
    },
    {
      label: 'Finance',
      links: [
        { href: '/rate-cards', label: 'Rate Cards', icon: BadgeDollarSign, permissions: ['rate_cards.view'] },
        { href: '/invoices', label: 'Invoices', icon: Receipt, permissions: ['invoices.view'] },
        { href: '/invoice-disputes', label: 'Disputes', icon: FileWarning, permissions: ['invoice_disputes.view'] },
        { href: '/finance', label: 'Finance', icon: DollarSign, permissions: ['finance.view'] },
      ],
    },
    {
      label: 'Administration',
      links: [
        { href: '/integrations', label: 'Integrations', icon: Plug, permissions: ['integrations.view'] },
        { href: '/settings/branding', label: 'Branding', icon: Palette, permissions: ['branding.view'] },
        { href: '/settings/billing', label: 'Billing', icon: CreditCard, permissions: ['billing.view'] },
        { href: '/settings/roles', label: 'Roles', icon: Settings, permissions: ['roles.view'] },
        { href: '/audit', label: 'Audit Logs', icon: Activity, permissions: ['audit.view'] },
      ],
    },
  ];

  const visibleDashboardLink = canAny(dashboardLink.permissions) ? dashboardLink : null;
  const visibleNavGroups = navGroups
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

  const renderLink = (link: (typeof navGroups)[number]['links'][number]) => {
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
        className={cn(
          "group flex min-h-11 items-center justify-between rounded-xl px-3 py-2.5 transition-all duration-200 sm:min-h-12 sm:px-4 sm:py-3",
          isActive
            ? "bg-primary text-white shadow-lg shadow-indigo-500/30"
            : "hover:bg-white/5 text-muted-foreground hover:text-white"
        )}
      >
        <div className="flex min-w-0 items-center gap-3">
          <Icon size={20} className={cn("shrink-0", isActive ? "text-white" : "text-muted-foreground group-hover:text-indigo-400")} />
          <span className="truncate font-medium">{link.label}</span>
        </div>
        {isActive && <ChevronRight size={16} />}
      </Link>
    );
  };

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-50 flex h-dvh w-[min(18rem,calc(100vw-1.5rem))] flex-col border-r glass-card transition-transform duration-300 lg:w-64 lg:translate-x-0',
        isOpen ? 'translate-x-0' : '-translate-x-full',
      )}
    >
      <div className="flex items-start justify-between gap-4 p-4 sm:p-5">
        <div className="min-w-0">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={companyName || user?.tenantName || 'Company logo'}
              className="mb-2 h-9 max-w-full object-contain object-left"
            />
          ) : (
            <h1 className="pb-2 text-2xl font-bold gradient-text">Ai Saas</h1>
          )}
          <p className="truncate text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {companyName || user?.tenantName || 'Management'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl p-2 text-slate-400 transition hover:bg-white/10 hover:text-white lg:hidden"
          aria-label="Close navigation"
        >
          <X size={20} />
        </button>
      </div>

      <nav
        ref={navRef}
        onScroll={saveScrollPosition}
        className="flex-1 space-y-1 overflow-y-auto px-3 py-2 sm:px-4 sm:py-3"
      >
        {visibleDashboardLink && (
          <div className="mb-1">
            {renderLink(visibleDashboardLink)}
          </div>
        )}

        {visibleNavGroups.map((group) => (
          <div key={group.label} className="mb-1">
            <p className="px-3 pb-1 pt-2 text-xs font-bold uppercase tracking-wider text-muted-foreground sm:px-4">
              {group.label}
            </p>
            {group.links.map(renderLink)}
          </div>
        ))}
      </nav>

      <div className="p-4 mt-auto border-t border-white/5">
        <div className="flex items-center gap-3 px-4 py-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
            <span className="text-indigo-400 font-bold">{user?.name?.charAt(0) || 'U'}</span>
          </div>
          <div className="flex-1 truncate">
            <p className="text-sm font-semibold truncate">{user?.name}</p>
            <p className="text-xs text-muted-foreground truncate">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-3 w-full px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
        >
          <LogOut size={20} />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </aside>
  );
}
