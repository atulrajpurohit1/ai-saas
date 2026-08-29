import {
  LayoutDashboard,
  Users,
  Briefcase,
  FileText,
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
  FileCheck2,
  type LucideIcon,
} from 'lucide-react';

export interface NavLink {
  href: string;
  label: string;
  icon: LucideIcon;
  permissions: string[];
}

export interface NavGroup {
  label: string;
  links: NavLink[];
}

// Single source of truth for the app's navigation - Sidebar renders this
// grouped-by-section, CommandPalette flattens it for quick-jump search. Keep
// both consuming this file rather than duplicating the list, so they can
// never drift out of sync.
export const DASHBOARD_LINK: NavLink = {
  href: '/',
  label: 'Overview',
  icon: LayoutDashboard,
  permissions: ['dashboard.view'],
};

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Workspace',
    links: [
      { href: '/leads', label: 'Leads', icon: Users, permissions: ['leads.view'] },
      { href: '/deals', label: 'Deals', icon: Briefcase, permissions: ['deals.view'] },
      { href: '/prospect-search', label: 'Prospect Search', icon: Radar, permissions: ['prospect_search.view'] },
    ],
  },
  {
    label: 'Sales',
    links: [
      { href: '/sales-accelerator', label: 'Sales Accelerator', icon: BrainCircuit, permissions: ['ai.view', 'leads.view'] },
      { href: '/sales-calls', label: 'Sales Calls', icon: PhoneCall, permissions: ['ai.view', 'deals.view'] },
      { href: '/proposals', label: 'Proposals', icon: FileText, permissions: ['proposals.view'] },
    ],
  },
  {
    label: 'Operations',
    links: [
      { href: '/rfp', label: 'RFP Management', icon: FileSpreadsheet, permissions: ['rfp.view'] },
      { href: '/vendors', label: 'Vendors', icon: Building2, permissions: ['vendors.view'] },
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
