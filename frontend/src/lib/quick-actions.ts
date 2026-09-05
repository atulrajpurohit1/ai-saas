import { UserPlus, FilePlus2, Radar, FileSpreadsheet, Building2, MapPin, ShieldCheck, CalendarClock, type LucideIcon } from 'lucide-react';

export interface QuickAction {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Any one of these permissions grants the action. */
  permissions: string[];
}

/**
 * Command-palette "Quick Actions". Every entry routes to a page/flow that
 * ALREADY EXISTS in the app - the palette just opens it with the create
 * intent. No new backend capability is implied. Permission-gated so a user
 * only sees actions they can actually perform.
 */
export const QUICK_ACTIONS: QuickAction[] = [
  { label: 'Add a lead', href: '/leads?new=1', icon: UserPlus, permissions: ['leads.view'] },
  { label: 'Find prospects', href: '/prospect-search', icon: Radar, permissions: ['prospect_search.view'] },
  { label: 'Generate a proposal', href: '/proposals', icon: FilePlus2, permissions: ['proposals.view'] },
  { label: 'New RFP', href: '/rfp/new', icon: FileSpreadsheet, permissions: ['rfp.view'] },
  { label: 'Add a branch', href: '/branches?new=1', icon: Building2, permissions: ['branches.view'] },
  { label: 'Add a site', href: '/sites?new=1', icon: MapPin, permissions: ['sites.view'] },
  { label: 'Add a guard', href: '/guards?new=1', icon: ShieldCheck, permissions: ['guards.view'] },
  { label: 'Schedule a shift', href: '/shifts?new=1', icon: CalendarClock, permissions: ['shifts.view'] },
];
