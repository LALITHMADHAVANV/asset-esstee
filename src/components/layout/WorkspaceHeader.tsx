"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, ChevronRight, Factory } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const titles: Record<string, string> = {
  'assign-task': 'Assign a task', 'active-tna': 'Active task tracking',
  allowance: 'Allowances', users: 'User access', 'store-inbox': 'Store requests',
  dashboard: 'Plant overview', 'asset-types': 'Equipment fleet', 'asset-log': 'Asset log', machines: 'Equipment',
  calendar: 'Team overview', 'pending-actions': 'Pending actions', inventory: 'Spare parts',
  'ppm-scheduler': 'Preventive maintenance', 'mechanic-roster': 'Maintenance team',
  history: 'Work history', messages: 'Notifications',
  settings: 'Settings', kpi: 'Performance', 'floor-tracker': 'Factory floor',
};

export function WorkspaceHeader() {
  const pathname = usePathname();
  const { user } = useAuth();
  const companySlug = user?.companySlug || 'esstee';
  const companyName = user?.company || (companySlug ? companySlug.charAt(0).toUpperCase() + companySlug.slice(1) : 'Esstee');

  const section = pathname.split('/').filter(Boolean).pop() || 'dashboard';
  const title = titles[section] || section.replace(/-/g, ' ');

  return (
    <header className="workspace-topbar no-print">
      <div className="workspace-breadcrumb">
        <Factory size={17} />
        <Link href={`/${companySlug}/dashboard`}>{companyName}</Link>
        <ChevronRight size={13} />
        <span>{title}</span>
      </div>
      <div className="workspace-topbar-actions">
        <span className="workspace-unit">{user?.unit || `${companyName} Operations`}</span>
        <Link href={`/${companySlug}/dashboard/messages`} aria-label="View notifications" className="workspace-icon-button">
          <Bell size={18} />
        </Link>
        <div className="workspace-avatar" title={user?.name || 'My account'}>
          {user?.name?.charAt(0).toUpperCase() || 'M'}
        </div>
      </div>
    </header>
  );
}
