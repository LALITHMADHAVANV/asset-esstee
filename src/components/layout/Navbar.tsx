'use client';

import { textValue } from '@/lib/textValue';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Wrench,
  QrCode,
  Boxes,
  History,
  CalendarCheck,
  LogOut,
  Camera,
  Crown,
  Package,
  PackageCheck,
  UserPlus,
  Zap,
  LayoutDashboard,
  IndianRupee,
  Settings,
  PanelLeft,
  PanelLeftClose,
  Menu,
  Users,
  CheckCircle2,
  ClipboardList,
  Layers,
  Clock,
  Activity,
  Bell,
  Award,
  TrendingUp,
  LayoutGrid,
} from 'lucide-react';
import { LiveClock } from './LiveClock';
import { useAuth } from '@/context/AuthContext';
import { useNav } from '@/context/NavContext';
import { normalizeRole } from '@/lib/constants/roles';
import {
  subscribeParts,
  subscribeRepairs,
  subscribeRequisitions,
  subscribePPMSchedules,
} from '@/lib/services/cmmsService';
import { ScanModal } from '@/components/scan/ScanModal';
import { CameraScannerModal } from '@/components/scan/CameraScannerModal';

export interface NavTab {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number | string | null;
  badgeColor?: string;
  highlight?: boolean;
}

export function Navbar() {
  const pathname = usePathname();
  const { user, role, logout } = useAuth();
  const { isNavHidden, toggleNav, openMobileNav } = useNav();

  const [lowStockCount, setLowStockCount] = useState<number>(0);
  const [pendingTicketsCount, setPendingTicketsCount] = useState<number>(0);
  const [pendingPpmCount, setPendingPpmCount] = useState<number>(0);
  const [activeInChargesCount, setActiveInChargesCount] = useState<number>(0);
  const [pendingCeoCount, setPendingCeoCount] = useState<number>(0);
  const [pendingStoreCount, setPendingStoreCount] = useState<number>(0);
  const [unattendedBreachCount, setUnattendedBreachCount] = useState<number>(0);

  const [isScanModalOpen, setIsScanModalOpen] = useState<boolean>(false);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState<boolean>(false);

  const currentRole = useMemo(() => {
    return normalizeRole(user?.role || role);
  }, [user?.role, role]);

  const handleSignOut = async () => {
    const slug = user?.companySlug || 'esstee';
    await logout();
    window.location.href = `/${slug}/login`;
  };

  useEffect(() => {
    const unsubParts = subscribeParts((parts) => {
      const low = parts.filter((p) => p.stock <= p.minStock).length;
      setLowStockCount(low);
    });

    const unsubRepairs = subscribeRepairs((repairs) => {
      const pendingTickets = repairs.filter((r) => r.status !== 'COMPLETED');
      setPendingTicketsCount(pendingTickets.length);

      // Check unattended breakdown issues > 5 mins
      const now = Date.now();
      const unattended = pendingTickets.filter((r) => {
        const hasAttendant = Boolean(
          r.attendedBy &&
          textValue(r.attendedBy).trim() !== '' &&
          textValue(r.attendedBy).toLowerCase() !== 'unassigned'
        );
        const elapsedMin = r.reportedAt ? (now - new Date(r.reportedAt).getTime()) / 60000 : 0;
        return !hasAttendant && elapsedMin >= 5;
      }).length;
      setUnattendedBreachCount(unattended);

      // Active process in-charges
      const activeInCharges = new Set(
        pendingTickets
          .map((r) => r.attendedBy || (r as any).assignedTo)
          .filter((n) => Boolean(n && n.trim()))
      );
      setActiveInChargesCount(activeInCharges.size);
    });

    const unsubPpm = subscribePPMSchedules((ppms) => {
      const pendingPpm = ppms.filter((p) => p.status !== 'COMPLETED').length;
      setPendingPpmCount(pendingPpm);
    });

    const unsubReqs = subscribeRequisitions((reqs) => {
      const ceoPending = reqs.filter(
        (r) =>
          (r.type === 'CRITICAL_CEO' || r.requiresCeoApproval) &&
          r.status === 'PENDING_CEO_APPROVAL'
      ).length;
      setPendingCeoCount(ceoPending);

      const storePending = reqs.filter(
        (r) => r.status !== 'FULFILLED' && r.status !== 'REJECTED'
      ).length;
      setPendingStoreCount(storePending);
    });

    return () => {
      unsubParts();
      unsubRepairs();
      unsubPpm();
      unsubReqs();
    };
  }, []);

  // Compute navigation tabs based on normalized currentRole
  const navTabs: NavTab[] = useMemo(() => {
    const buildTabs = (): NavTab[] => {
      // 1. CEO / Executive Directorate
      if (currentRole === 'CEO') {
        return [
          {
            label: 'Executive Overview',
            href: '/dashboard',
            icon: LayoutDashboard,
          },
          {
            label: 'Executive Approvals',
            href: '/dashboard/messages',
            icon: Crown,
            badge: pendingCeoCount > 0 ? pendingCeoCount : null,
            badgeColor: 'bg-rose-500 text-white animate-pulse',
            highlight: true,
          },
          {
            label: 'Equipment Fleet',
            href: '/dashboard/asset-types',
            icon: Boxes,
          },
          {
            label: 'Audit History',
            href: '/dashboard/history',
            icon: History,
          },
          {
            label: 'Notifications',
            href: '/dashboard/messages',
            icon: Bell,
            badge: unattendedBreachCount > 0 ? unattendedBreachCount : null,
            badgeColor: unattendedBreachCount > 0 ? 'bg-rose-500 text-white animate-pulse' : 'bg-slate-100 text-slate-700',
          },
        ];
      }

      // 2. STORE_PERSON (Tool Crib & Central Stores)
      if (currentRole === 'STORE_PERSON') {
        return [
          {
            label: 'Store Overview',
            href: '/dashboard',
            icon: LayoutDashboard,
          },
          {
            label: 'Mechanic Indents',
            href: '/dashboard/store-inbox',
            icon: PackageCheck,
            badge: pendingStoreCount > 0 ? pendingStoreCount : null,
            badgeColor: 'bg-rose-500 text-white animate-pulse',
            highlight: true,
          },
          {
            label: 'Stock Maintenance',
            href: '/dashboard/inventory',
            icon: Package,
            badge: lowStockCount > 0 ? lowStockCount : null,
            badgeColor: 'bg-amber-100 text-amber-800',
          },
          {
            label: 'Equipment Fleet',
            href: '/dashboard/asset-types',
            icon: Boxes,
          },
          {
            label: 'Dispatch History',
            href: '/dashboard/history',
            icon: History,
          },
          {
            label: 'Notifications',
            href: '/dashboard/messages',
            icon: Bell,
            badge: unattendedBreachCount > 0 ? unattendedBreachCount : null,
            badgeColor: unattendedBreachCount > 0 ? 'bg-rose-500 text-white animate-pulse' : 'bg-slate-100 text-slate-700',
          },
        ];
      }

      // 3. MECHANIC & ELECTRICIAN (Floor Technicians)
      if (currentRole === 'MECHANIC' || currentRole === 'ELECTRICIAN') {
        return [
          {
            label: 'My Floor Overview',
            href: '/dashboard',
            icon: LayoutDashboard,
          },
          {
            label: 'Pending Tasks',
            href: '/dashboard/calendar',
            icon: Clock,
            badge: pendingTicketsCount > 0 ? pendingTicketsCount : null,
            badgeColor: 'bg-slate-100 text-slate-700',
          },
          {
            label: 'Part Indents',
            href: '/dashboard/inventory',
            icon: Package,
          },
          {
            label: 'Task History',
            href: '/dashboard/history',
            icon: History,
          },
          {
            label: 'Notifications',
            href: '/dashboard/messages',
            icon: Bell,
            badge: unattendedBreachCount > 0 ? unattendedBreachCount : null,
            badgeColor: unattendedBreachCount > 0 ? 'bg-rose-500 text-white animate-pulse' : 'bg-slate-100 text-slate-700',
          },
        ];
      }

      // 4. SENIOR_MECHANIC & SENIOR_ELECTRICIAN (Workshop & Floor Supervisors)
      if (currentRole === 'SENIOR_MECHANIC' || currentRole === 'SENIOR_ELECTRICIAN') {
        return [
          {
            label: 'Supervisor Desk',
            href: '/dashboard',
            icon: TrendingUp,
          },
          {
            label: 'Team Overview',
            href: '/dashboard/calendar',
            icon: LayoutGrid,
          },
          {
            label: 'Pending Actions',
            href: '/dashboard/pending-actions',
            icon: Clock,
            badge: (pendingTicketsCount + pendingPpmCount) > 0 ? (pendingTicketsCount + pendingPpmCount) : null,
            badgeColor: 'bg-emerald-500 text-white',
          },
          {
            label: 'Process In-Charges',
            href: '/dashboard/mechanic-roster',
            icon: Activity,
            badge: activeInChargesCount > 0 ? activeInChargesCount : null,
            badgeColor: 'bg-slate-100 text-slate-700',
          },
          {
            label: 'PPM Scheduler',
            href: '/dashboard/ppm-scheduler',
            icon: CalendarCheck,
            badge: pendingPpmCount > 0 ? pendingPpmCount : null,
            badgeColor: 'bg-amber-100 text-amber-800',
          },
          {
            label: 'Equipment Fleet',
            href: '/dashboard/asset-types',
            icon: Boxes,
          },
          {
            label: 'Stock Maintenance',
            href: '/dashboard/inventory',
            icon: Package,
            badge: lowStockCount > 0 ? lowStockCount : null,
            badgeColor: 'bg-amber-100 text-amber-800',
          },
          {
            label: 'Work History',
            href: '/dashboard/history',
            icon: History,
          },
          {
            label: 'Notifications',
            href: '/dashboard/messages',
            icon: Bell,
            badge: unattendedBreachCount > 0 ? unattendedBreachCount : null,
            badgeColor: unattendedBreachCount > 0 ? 'bg-rose-500 text-white animate-pulse' : 'bg-slate-100 text-slate-700',
          },
        ];
      }

      // 5. ADMIN & ASSET_MANAGER (Full Plant Administration)
      return [
        {
          label: 'Admin Dashboard',
          href: '/dashboard',
          icon: TrendingUp,
        },
        {
          label: 'Team Overview',
          href: '/dashboard/calendar',
          icon: LayoutGrid,
        },
        {
          label: 'Pending Actions',
          href: '/dashboard/pending-actions',
          icon: Clock,
          badge: (pendingTicketsCount + pendingPpmCount) > 0 ? (pendingTicketsCount + pendingPpmCount) : null,
          badgeColor: 'bg-emerald-500 text-white',
        },
        {
          label: 'Process In-Charges',
          href: '/dashboard/mechanic-roster',
          icon: Activity,
          badge: activeInChargesCount > 0 ? activeInChargesCount : null,
          badgeColor: 'bg-slate-100 text-slate-700',
        },
        {
          label: 'PPM Scheduler',
          href: '/dashboard/ppm-scheduler',
          icon: CalendarCheck,
          badge: pendingPpmCount > 0 ? pendingPpmCount : null,
          badgeColor: 'bg-amber-100 text-amber-800',
        },
        {
          label: 'Active TNAs',
          href: '/dashboard/active-tna',
          icon: Layers,
        },
        {
          label: 'Asset Master',
          href: '/dashboard/asset-types',
          icon: Boxes,
        },
        {
          label: 'Asset Registration',
          href: '/dashboard/machines',
          icon: QrCode,
        },
        {
          label: 'Mechanic Indents',
          href: '/dashboard/store-inbox',
          icon: PackageCheck,
          badge: pendingStoreCount > 0 ? pendingStoreCount : null,
          badgeColor: 'bg-rose-500 text-white animate-pulse',
        },
        {
          label: 'Stock Maintenance',
          href: '/dashboard/inventory',
          icon: Package,
          badge: lowStockCount > 0 ? lowStockCount : null,
          badgeColor: 'bg-amber-100 text-amber-800',
        },
        {
          label: 'Department KPI',
          href: '/dashboard/kpi',
          icon: Award,
        },
        {
          label: 'Settings',
          href: '/dashboard/settings',
          icon: Settings,
        },
        {
          label: 'Notifications',
          href: '/dashboard/messages',
          icon: Bell,
          badge: unattendedBreachCount > 0 ? unattendedBreachCount : null,
          badgeColor: unattendedBreachCount > 0 ? 'bg-rose-500 text-white animate-pulse' : 'bg-slate-100 text-slate-700',
        },
      ];
    };

    const defaultTabs = buildTabs();
    const companySlug = user?.companySlug || 'esstee';
    return defaultTabs.map((tab) => ({
      ...tab,
      href: tab.href.startsWith('/dashboard') ? `/${companySlug}${tab.href}` : tab.href,
    }));
  }, [
    currentRole,
    pendingTicketsCount,
    pendingPpmCount,
    activeInChargesCount,
    pendingCeoCount,
    pendingStoreCount,
    lowStockCount,
    unattendedBreachCount,
    user?.companySlug,
  ]);

  if (!user) return null;

  // Get color for role badge
  const getRoleBadgeColor = () => {
    switch (currentRole) {
      case 'CEO':
        return 'bg-purple-600 text-white';
      case 'ADMIN':
      case 'ASSET_MANAGER':
        return 'bg-indigo-600 text-white';
      case 'SENIOR_MECHANIC':
        return 'bg-blue-600 text-white';
      case 'SENIOR_ELECTRICIAN':
        return 'bg-cyan-600 text-white';
      case 'MECHANIC':
        return 'bg-amber-500 text-slate-950 font-bold';
      case 'ELECTRICIAN':
        return 'bg-amber-400 text-slate-950 font-bold';
      case 'STORE_PERSON':
        return 'bg-emerald-600 text-white';
      default:
        return 'bg-slate-600 text-white';
    }
  };

  const getWorkspaceTitle = () => {
    switch (currentRole) {
      case 'CEO':
        return 'CEO Executive Directorate';
      case 'ADMIN':
      case 'ASSET_MANAGER':
        return 'Plant Operations & Asset Hub';
      case 'SENIOR_MECHANIC':
        return 'Supervisor Sewing Desk';
      case 'SENIOR_ELECTRICIAN':
        return 'Supervisor Electrical Desk';
      case 'MECHANIC':
        return 'Mechanic Service Workbench';
      case 'ELECTRICIAN':
        return 'Electrical Service Workbench';
      case 'STORE_PERSON':
        return 'Central Stores & Tool Crib';
      default:
        return 'Maintenance Module';
    }
  };

  const getUserDisplayRole = () => {
    switch (currentRole) {
      case 'ADMIN':
      case 'ASSET_MANAGER':
        return 'Administrator';
      case 'CEO':
        return 'Executive Director';
      case 'STORE_PERSON':
        return 'Store In-Charge';
      case 'SENIOR_MECHANIC':
        return 'Senior Mechanic';
      case 'SENIOR_ELECTRICIAN':
        return 'Senior Electrician';
      case 'MECHANIC':
        return 'Line Mechanic';
      case 'ELECTRICIAN':
        return 'Plant Electrician';
      default:
        return currentRole.toLowerCase().replace(/_/g, ' ');
    }
  };

  const isTabActive = (tabHref: string) => {
    const cleanPath = pathname.replace(/^\/[^/]+(?=\/dashboard)/, '');
    const cleanTab = tabHref.replace(/^\/[^/]+(?=\/dashboard)/, '');
    if (cleanTab === '/dashboard') {
      return cleanPath === '/dashboard';
    }
    return cleanPath.startsWith(cleanTab);
  };

  return (
    <>
      <header className="bg-white/95 backdrop-blur-md text-slate-800 sticky top-0 z-30 shadow-xs border-b border-slate-200/90 no-print">
        {/* Tier 1: System Bar & Quick Tools */}
        <div className="w-full px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16 gap-2">
            {/* Left: Mobile Drawer Trigger / Desktop Sidebar Toggle & Breadcrumb */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              {/* Mobile Drawer Button */}
              <button
                type="button"
                onClick={openMobileNav}
                className="md:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                title="Open Navigation Menu"
              >
                <Menu className="w-5 h-5" />
              </button>

              {/* Desktop Sidebar Collapse / Expand Toggle */}
              <button
                type="button"
                onClick={toggleNav}
                className={`hidden md:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-xl border transition cursor-pointer active:scale-95 shadow-2xs ${isNavHidden
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100'
                    : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                title={isNavHidden ? 'Show Left Sidebar' : 'Hide Left Sidebar for Full-Width Mode'}
              >
                {isNavHidden ? (
                  <>
                    <PanelLeft className="w-4 h-4 text-indigo-600" />
                    <span>Show Sidebar</span>
                  </>
                ) : (
                  <>
                    <PanelLeftClose className="w-4 h-4 text-slate-500" />
                    <span>Collapse</span>
                  </>
                )}
              </button>

              {/* Workspace Title & Active Indicator */}
              <div className="flex items-center gap-2 min-w-0">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h1 className="text-xs sm:text-sm font-extrabold text-slate-900 tracking-tight truncate">
                      {getWorkspaceTitle()}
                    </h1>
                    <span
                      className={`hidden sm:inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${getRoleBadgeColor()}`}
                    >
                      {getUserDisplayRole()}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Quick Tools, Live Clock, Scanner & Profile */}
            <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
              {/* Live Factory Floor Clock */}
              <LiveClock />

              {/* QR Tag Scan Action */}
              <button
                type="button"
                onClick={() => setIsScanModalOpen(true)}
                className="flex items-center gap-1.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white text-xs font-bold px-2.5 sm:px-3 py-1.5 rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
                title="Quick Scan Machine QR Tag"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Scan Tag</span>
              </button>

              {/* Camera Scanner Trigger (Admins & Supervisors) */}
              {(currentRole === 'ADMIN' ||
                currentRole === 'ASSET_MANAGER' ||
                currentRole === 'SENIOR_MECHANIC' ||
                currentRole === 'SENIOR_ELECTRICIAN') && (
                  <button
                    type="button"
                    onClick={() => setIsCameraModalOpen(true)}
                    className="hidden sm:flex items-center gap-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-slate-200 transition cursor-pointer"
                    title="Live Camera QR Scanner"
                  >
                    <Camera className="w-3.5 h-3.5 text-indigo-600" />
                    <span className="hidden lg:inline">Camera</span>
                  </button>
                )}

              {/* User Profile Pill & Sign Out */}
              <div className="flex items-center space-x-1.5 sm:space-x-2 bg-slate-50 py-1 pl-2 sm:pl-2.5 pr-1.5 rounded-xl border border-slate-200 shadow-2xs">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold uppercase shadow-2xs shrink-0 ${getRoleBadgeColor()}`}
                >
                  {currentRole === 'CEO' ? (
                    <Crown className="w-3.5 h-3.5 text-amber-300" />
                  ) : currentRole === 'STORE_PERSON' ? (
                    <Package className="w-3.5 h-3.5 text-white" />
                  ) : currentRole === 'ELECTRICIAN' || currentRole === 'SENIOR_ELECTRICIAN' ? (
                    <Zap className="w-3.5 h-3.5 text-amber-200" />
                  ) : (
                    user?.name?.charAt(0) || 'A'
                  )}
                </div>
                <div className="hidden lg:block text-left">
                  <div className="text-xs font-bold leading-tight text-slate-900 truncate max-w-[120px]">
                    {user?.name || 'Staff User'}
                  </div>
                  <div className="text-[9px] font-bold tracking-wider uppercase text-slate-400">
                    {getUserDisplayRole()}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="p-1 sm:p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tier 2: Persistent Quick Nav Bar (Horizontal Tabs for All Logins) */}
        <div className="bg-slate-50/80 border-t border-slate-200/70 overflow-x-auto no-scrollbar scroll-smooth">
          <div className="w-full px-3 sm:px-6 lg:px-8">
            <div className="flex items-center gap-1 sm:gap-1.5 py-1.5 whitespace-nowrap">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 px-1 hidden sm:inline-block">
                Quick Nav:
              </span>
              {navTabs.map((tab) => {
                const active = isTabActive(tab.href);
                const Icon = tab.icon;

                return (
                  <Link
                    key={`${tab.href}-${tab.label}`}
                    href={tab.href}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 select-none active:scale-95 shrink-0 ${active
                        ? 'bg-indigo-600 text-white shadow-xs shadow-indigo-600/30'
                        : tab.highlight
                          ? 'text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 font-bold'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                      }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${active ? 'text-white' : 'text-slate-500'}`} />
                    <span>{tab.label}</span>
                    {tab.badge !== null && tab.badge !== undefined && (
                      <span
                        className={`px-1.5 py-0.2 text-[10px] rounded-full font-bold ml-0.5 ${tab.badgeColor || 'bg-indigo-500 text-white'
                          }`}
                      >
                        {tab.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </header>

      {/* Floor Scanner Simulator Modal */}
      <ScanModal
        isOpen={isScanModalOpen}
        onClose={() => setIsScanModalOpen(false)}
        onOpenLiveScanner={() => {
          setIsScanModalOpen(false);
          setIsCameraModalOpen(true);
        }}
      />

      {/* Live Camera Scanner Modal */}
      <CameraScannerModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
      />
    </>
  );
}

export const QuickNavBar = Navbar;
