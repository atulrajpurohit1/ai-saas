import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Users, 
  Briefcase, 
  FileText, 
  UserCircle, 
  LogOut,
  ChevronRight,
  MapPin,
  ShieldCheck,
  CalendarClock
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Sidebar() {
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
  ];

  const links = adminLinks;

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 glass-card border-r flex flex-col z-50">
      <div className="p-6">
        <h1 className="text-2xl font-bold gradient-text pb-2">Ai Saas</h1>
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
          {user?.tenantName || 'Management'}
        </p>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-1">
        {links.map((link) => {
          const isActive = pathname === link.href;
          const Icon = link.icon;
          
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 group",
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


