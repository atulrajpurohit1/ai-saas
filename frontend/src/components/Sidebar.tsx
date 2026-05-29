import React from 'react';
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
  FileWarning,
  ClipboardList,
  ClipboardCheck,
  BadgeDollarSign,
  DollarSign,
  Receipt,
  X
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const adminLinks = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/leads', label: 'Leads', icon: Users },
    { href: '/deals', label: 'Deals', icon: Briefcase },
    { href: '/proposals', label: 'Proposals', icon: FileText },
    { href: '/sites', label: 'Sites', icon: MapPin },
    { href: '/guards', label: 'Guards', icon: ShieldCheck },
    { href: '/shifts', label: 'Shifts', icon: CalendarClock },
    { href: '/incidents', label: 'Incidents', icon: FileWarning },
    { href: '/reports', label: 'Reports', icon: ClipboardList },
    { href: '/timesheets', label: 'Timesheets', icon: ClipboardCheck },
    { href: '/rate-cards', label: 'Rate Cards', icon: BadgeDollarSign },
    { href: '/invoices', label: 'Invoices', icon: Receipt },
    { href: '/invoice-disputes', label: 'Disputes', icon: FileWarning },
    { href: '/finance', label: 'Finance', icon: DollarSign },
    { href: '/audit', label: 'Activity', icon: Activity },
  ];

  const links = user?.role === 'finance'
    ? [{ href: '/finance', label: 'Finance', icon: DollarSign }]
    : adminLinks;

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-50 flex h-dvh w-72 max-w-[85vw] flex-col border-r glass-card transition-transform duration-300 lg:w-64 lg:translate-x-0',
        isOpen ? 'translate-x-0' : '-translate-x-full',
      )}
    >
      <div className="flex items-start justify-between gap-4 p-5 sm:p-6">
        <div>
          <h1 className="pb-2 text-2xl font-bold gradient-text">Ai Saas</h1>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {user?.tenantName || 'Management'}
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

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3 sm:px-4 sm:py-4">
        {links.map((link) => {
          const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
          const Icon = link.icon;
          
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={onClose}
              className={cn(
                "group flex min-h-12 items-center justify-between rounded-xl px-4 py-3 transition-all duration-200",
                isActive 
                  ? "bg-primary text-white shadow-lg shadow-indigo-500/30" 
                  : "hover:bg-white/5 text-muted-foreground hover:text-white"
              )}
            >
              <div className="flex items-center gap-3">
                <Icon size={20} className={cn(isActive ? "text-white" : "text-muted-foreground group-hover:text-indigo-400")} />
                <span className="font-medium">{link.label}</span>
              </div>
              {isActive && <ChevronRight size={16} />}
            </Link>
          );
        })}
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
