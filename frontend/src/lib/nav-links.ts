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
  Umbrella,
  Sparkles,
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

// Grouped to mirror the products a customer buys -- Generation, Guard and
// Operations -- so the sidebar reads the same way the plan page does. Shared
// records (clients, sites, branches) sit under Workspace because all three
// products use them.
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Workspace',
    links: [
      { href: '/branches', label: 'Branches', icon: GitBranch, permissions: ['branches.view'] },
      { href: '/sites', label: 'Sites', icon: MapPin, permissions: ['sites.view'] },
      { href: '/clients/insurance', label: 'Client Insurance', icon: Umbrella, permissions: ['clients.view'] },
    ],
  },
  {
    label: 'Generation',
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
    label: 'Guard',
    links: [
      { href: '/guards', label: 'Guards', icon: ShieldCheck, permissions: ['guards.view'] },
      { href: '/guards/compliance', label: 'Guard Compliance', icon: FileCheck2, permissions: ['guards.view'] },
      { href: '/patrol/checkpoints', label: 'Patrols', icon: Navigation, permissions: ['patrols.view'] },
      { href: '/patrol/monitor', label: 'Patrol Monitor', icon: Radar, permissions: ['patrols.view'] },
      { href: '/incidents', label: 'Incidents', icon: FileWarning, permissions: ['incidents.view'] },
      { href: '/reports', label: 'Reports', icon: ClipboardList, permissions: ['reports.view'] },
    ],
  },
  {
    label: 'Operations',
    links: [
      { href: '/shifts', label: 'Shifts', icon: CalendarClock, permissions: ['shifts.view'] },
      { href: '/timesheets', label: 'Timesheets', icon: ClipboardCheck, permissions: ['timesheets.view'] },
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
      { href: '/settings/plan', label: 'Your Plan', icon: Sparkles, permissions: ['billing.view'] },
      { href: '/settings/billing', label: 'Billing', icon: CreditCard, permissions: ['billing.view'] },
      { href: '/settings/roles', label: 'Roles', icon: Settings, permissions: ['roles.view'] },
      { href: '/audit', label: 'Audit Logs', icon: Activity, permissions: ['audit.view'] },
    ],
  },
];
