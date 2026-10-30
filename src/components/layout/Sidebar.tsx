'use client';

import { textValue } from '@/lib/textValue';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Wrench,
  Boxes,
  History,
  CalendarCheck,
  Layers,
  LogOut,
  Crown,
  Package,
  PackageCheck,
  UserPlus,
  Menu,
  X,
  ClipboardList,
  Users,
  LayoutDashboard,
  QrCode,
  IndianRupee,
  PanelLeftClose,
  PanelLeftOpen,
  CheckCircle2,
  Settings,
  Clock,
  Activity,
  Bell,
  Sparkles,
  Award,
  TrendingUp,
  LayoutGrid,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useNav } from '@/context/NavContext';
import { normalizeRole } from '@/lib/constants/roles';
import {
  subscribeParts,
  subscribeRepairs,
  subscribeRequisitions,
  subscribePPMSchedules,
} from '@/lib/services/cmmsService';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number | string | null;
  badgeColor?: string;
  highlight?: boolean;
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, role, logout } = useAuth();
  const { isNavHidden, showNav, hideNav, isMobileOpen, setIsMobileOpen, closeMobileNav } = useNav();

  const [lowStockCount, setLowStockCount] = useState<number>(0);
  const [pendingTicketsCount, setPendingTicketsCount] = useState<number>(0);
  const [pendingPpmCount, setPendingPpmCount] = useState<number>(0);
  const [activeInChargesCount, setActiveInChargesCount] = useState<number>(0);
  const [pendingCeoCount, setPendingCeoCount] = useState<number>(0);
  const [pendingStoreCount, setPendingStoreCount] = useState<number>(0);
  const [unattendedBreachCount, setUnattendedBreachCount] = useState<number>(0);

  const companySlug = textValue((user?.companySlug || 'esstee')).toLowerCase();

  const handleSignOut = async () => {
    await logout();
    window.location.href = `/${companySlug}/login`;
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

      // Unique process in-charges currently attending to breakdown issues
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

  // Close mobile sidebar on route change
  useEffect(() => {
    closeMobileNav();
  }, [pathname, closeMobileNav]);

  const currentRole = useMemo(() => {
    return normalizeRole(user?.role || role);
  }, [user?.role, role]);

  // Dynamic day of week and greeting (e.g. "Happy Thursday, Administrator!")
  const todayGreeting = useMemo(() => {
    try {
      const dayName = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date());
      const displayName =
        currentRole === 'ADMIN' || currentRole === 'ASSET_MANAGER'
          ? 'Administrator'
          : currentRole === 'CEO'
            ? 'Executive Director'
            : currentRole === 'STORE_PERSON'
              ? 'Store In-Charge'
              : currentRole === 'SENIOR_MECHANIC' || currentRole === 'SENIOR_ELECTRICIAN'
                ? 'Supervisor'
                : user?.name?.split(' ')[0] || 'Technician';
      return `Happy ${dayName}, ${displayName}!`;
    } catch {
      return 'Happy Day, Operations Team!';
    }
  }, [currentRole, user]);

  // Grouped Navigation Sections separated based on credentials
  const navSections: NavSection[] = useMemo(() => {
    const buildSections = (): NavSection[] => {
      // 1. CEO / Executive Directorate
      if (currentRole === 'CEO') {
        return [
          {
            items: [
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
              },
              {
                label: 'Notifications',
                href: '/dashboard/messages',
                icon: Bell,
                badge: unattendedBreachCount > 0 ? unattendedBreachCount : null,
                badgeColor: unattendedBreachCount > 0 ? 'bg-rose-500 text-white animate-pulse' : 'bg-slate-100 text-slate-600',
              },
            ],
          },
          {
            title: 'PLANT AUDIT',
            items: [
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
            ],
          },
        ];
      }

      // 2. STORE_PERSON (Tool Crib & Central Stores)
      if (currentRole === 'STORE_PERSON') {
        return [
          {
            items: [
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
              },
              {
                label: 'Notifications',
                href: '/dashboard/messages',
                icon: Bell,
                badge: unattendedBreachCount > 0 ? unattendedBreachCount : null,
                badgeColor: unattendedBreachCount > 0 ? 'bg-rose-500 text-white animate-pulse' : 'bg-slate-100 text-slate-600',
              },
            ],
          },
          {
            title: 'INVENTORY & CRIB',
            items: [
              {
                label: 'Stock Maintenance',
                href: '/dashboard/inventory',
                icon: Package,
                badge: lowStockCount > 0 ? lowStockCount : null,
                badgeColor: 'bg-amber-100 text-amber-800',
              },
              {
                label: 'Equipment Ledger',
                href: '/dashboard/asset-types',
                icon: Boxes,
              },
              {
                label: 'Dispatch History',
                href: '/dashboard/history',
                icon: History,
              },
            ],
          },
        ];
      }

      // 3. MECHANIC & ELECTRICIAN (Floor Technicians)
      if (currentRole === 'MECHANIC' || currentRole === 'ELECTRICIAN') {
        return [
          {
            items: [
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
                label: 'Notifications',
                href: '/dashboard/messages',
                icon: Bell,
                badge: unattendedBreachCount > 0 ? unattendedBreachCount : null,
                badgeColor: unattendedBreachCount > 0 ? 'bg-rose-500 text-white animate-pulse' : 'bg-slate-100 text-slate-600',
              },
            ],
          },
          {
            title: 'FLOOR ACTIONS',
            items: [
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
            ],
          },
        ];
      }

      // 4. SENIOR_MECHANIC & SENIOR_ELECTRICIAN (Workshop & Floor Supervisors)
      if (currentRole === 'SENIOR_MECHANIC' || currentRole === 'SENIOR_ELECTRICIAN') {
        return [
          {
            items: [
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
                label: 'Notifications',
                href: '/dashboard/messages',
                icon: Bell,
                badge: unattendedBreachCount > 0 ? unattendedBreachCount : null,
                badgeColor: unattendedBreachCount > 0 ? 'bg-rose-500 text-white animate-pulse' : 'bg-slate-100 text-slate-700',
              },
            ],
          },
          {
            title: 'EQUIPMENT & SPARES',
            items: [
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
            ],
          },
        ];
      }

      // 5. ADMIN & ASSET_MANAGER (Full Plant Administration)
      return [
        {
          items: [
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
              label: 'Notifications',
              href: '/dashboard/messages',
              icon: Bell,
              badge: unattendedBreachCount > 0 ? unattendedBreachCount : null,
              badgeColor: unattendedBreachCount > 0 ? 'bg-rose-500 text-white animate-pulse' : 'bg-slate-100 text-slate-700',
            },
          ],
        },
        {
          title: 'TNA',
          items: [
            {
              label: 'Active TNAs',
              href: '/dashboard/active-tna',
              icon: Layers,
            },
            {
              label: 'Completed TNAs',
              href: '/dashboard/history',
              icon: CheckCircle2,
            },
          ],
        },
        {
          title: 'Asset Management',
          items: [
            {
              label: 'Asset',
              href: '/dashboard/asset-types',
              icon: Boxes,
            },
            {
              label: 'Asset Registration',
              href: '/dashboard/machines',
              icon: QrCode,
            },
          ],
        },
        {
          title: 'STORE & SPARES',
          items: [
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
          ],
        },
        {
          title: 'PEOPLE',
          items: [
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
          ],
        },
      ];
    };
    const rawSections = buildSections();
    const companySlug = user?.companySlug || 'esstee';
    return rawSections.map((sec) => ({
      ...sec,
      items: sec.items.map((it) => ({
        ...it,
        href: it.href.startsWith('/dashboard') ? `/${companySlug}${it.href}` : it.href,
      })),
    }));
  }, [currentRole, pendingTicketsCount, pendingPpmCount, activeInChargesCount, pendingCeoCount, pendingStoreCount, lowStockCount, user?.companySlug]);

  const userInitial = useMemo(() => {
    if (currentRole === 'ADMIN') return 'A';
    if (currentRole === 'CEO') return 'C';
    if (user?.name) return user.name.charAt(0).toUpperCase();
    return 'A';
  }, [currentRole, user]);

  const userDisplayName = useMemo(() => {
    if (currentRole === 'ADMIN') return 'Administrator';
    if (currentRole === 'CEO') return 'Managing Director';
    return user?.name || 'Administrator';
  }, [currentRole, user]);

  const userDisplayRole = useMemo(() => {
    if (currentRole === 'ADMIN') return 'Administrator';
    if (currentRole === 'STORE_PERSON') return 'Store In-Charge';
    if (currentRole === 'SENIOR_MECHANIC') return 'Senior Mechanic';
    if (currentRole === 'MECHANIC') return 'Line Mechanic';
    return currentRole?.toLowerCase().replace(/_/g, ' ') || 'Staff';
  }, [currentRole]);

  const sidebarContent = (
    <div className="workspace-sidebar sidebar-expanded flex flex-col h-full select-none border-r">
      {/* ─── Top Brand Header (matching reference image) ─── */}
      <div className="p-4 border-b border-slate-100 flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <Link href={`/${user?.companySlug || 'esstee'}/dashboard`} className="flex items-center gap-2 group">
            <span className="workspace-brand text-lg font-bold tracking-tight hover:opacity-90 transition font-sans">
              <span className="workspace-brand-mark" aria-hidden="true">m.</span>
              <span>maintain</span>
            </span>
          </Link>

          <div className="flex items-center gap-1.5">
            {/* Top Notification Bell with unseen counter */}
            <Link
              href={`/${user?.companySlug || 'esstee'}/dashboard/messages`}
              className="relative p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition cursor-pointer flex items-center justify-center group"
              title={`${unattendedBreachCount} unseen alerts & notifications`}
            >
              <Bell className="w-4 h-4 text-slate-600 group-hover:text-rose-600 transition" />
              {unattendedBreachCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#f43f5e] text-white text-[10px] font-extrabold flex items-center justify-center shadow-2xs animate-pulse">
                  {unattendedBreachCount}
                </span>
              )}
            </Link>

            {/* Desktop hide button */}
            <button
              onClick={hideNav}
              className="hidden md:flex p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              title="Hide Navigation Bar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>

            {/* Mobile close button */}
            <button
              onClick={closeMobileNav}
              aria-label="Close navigation"
              className="md:hidden p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Dynamic Day Greeting */}
        <p className="text-[11px] text-slate-400 font-medium">
          {todayGreeting}
        </p>
      </div>

      {/* ─── Categorized Navigation Links (matching reference image) ─── */}
      <nav className="flex-1 px-3 py-2 space-y-4 overflow-y-auto">
        {navSections.map((section, sIdx) => (
          <div key={sIdx} className="space-y-0.5">
            {section.title && (
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 pt-2 pb-1">
                {section.title}
              </div>
            )}

            {section.items.map((item) => {
              const cleanPath = pathname.replace(/^\/[^/]+(?=\/dashboard)/, '');
              const cleanItemHref = item.href.replace(/^\/[^/]+(?=\/dashboard)/, '');
              const isActive =
                item.href.includes('?')
                  ? `${pathname}?${item.href.split('?')[1]}` === item.href || cleanPath === cleanItemHref.split('?')[0]
                  : cleanPath === cleanItemHref || pathname === item.href;
              const Icon = item.icon;

              return (
                <Link
                  key={item.label + item.href}
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  className={`sidebar-link flex items-center justify-between px-3 py-2.5 rounded-lg text-[13px] transition group cursor-pointer ${isActive
                      ? 'bg-[#eef9f5] text-[#065f46] border border-[#a7f3d0] font-bold shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-medium border border-transparent'
                    }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon
                      className={`w-4 h-4 shrink-0 transition ${isActive
                          ? 'text-[#059669]'
                          : 'text-slate-400 group-hover:text-slate-700'
                        }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </div>

                  {item.badge !== null && item.badge !== undefined && (
                    <span
                      className={`px-2 py-0.5 text-[10px] rounded-full font-semibold shrink-0 ${isActive
                          ? 'bg-[#10b981] text-white shadow-2xs'
                          : item.badgeColor || 'bg-slate-100 text-slate-600'
                        }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* ─── Bottom User Profile Dock (matching reference image) ─── */}
      <div className="sidebar-profile p-3 border-t border-slate-100">
        <div className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 transition">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Green circular avatar */}
            <div className="w-8 h-8 rounded-full bg-[#15803d] text-white font-bold flex items-center justify-center text-xs shadow-2xs shrink-0 uppercase">
              {userInitial}
            </div>

            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-800 truncate leading-tight">
                {userDisplayName}
              </div>
              <div className="text-[10px] text-slate-400 font-medium capitalize truncate">
                {userDisplayRole}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* Settings trigger */}
            <button
              type="button"
              onClick={() => router.push(`/${companySlug}/dashboard/settings`)}
              className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-lg hover:bg-emerald-50 transition cursor-pointer"
              title="System Settings"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Logout arrow icon */}
            <button
              type="button"
              onClick={handleSignOut}
              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const collapsedSidebarContent = (
    <div className="workspace-sidebar flex flex-col h-full select-none border-r w-[72px] shrink-0 items-center py-3.5 px-2 justify-between">
      {/* ─── Top Brand & Navigation Controls ─── */}
      <div className="flex flex-col items-center gap-2.5 w-full">
        {/* Brand Text */}
        <Link
          href={`/${companySlug}/dashboard`}
          className="text-center font-black text-xs text-[#15803d] tracking-tight hover:opacity-90 transition pt-1"
          title="Asset Maintenance System (Noolezhai)"
        >
          ASSET MODULE
        </Link>

        {/* Top Notification Bell with unseen counter */}
        <Link
          href={`/${companySlug}/dashboard/messages`}
          className="relative p-2 text-slate-600 hover:text-rose-600 hover:bg-slate-50 rounded-xl transition cursor-pointer flex items-center justify-center group"
          title={`${unattendedBreachCount} unseen alerts & notifications`}
        >
          <Bell className="w-5 h-5 text-slate-600 group-hover:text-rose-600 transition" />
          {unattendedBreachCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#f43f5e] text-white text-[10px] font-extrabold flex items-center justify-center shadow-2xs animate-pulse">
              {unattendedBreachCount}
            </span>
          )}
        </Link>

        {/* Open/Expand Navbar button */}
        <button
          type="button"
          onClick={showNav}
          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition cursor-pointer flex items-center justify-center"
          title="Expand Navigation Bar"
        >
          <PanelLeftOpen className="w-5 h-5" />
        </button>

        <div className="w-8 h-px bg-slate-200 mt-1" />
      </div>

      {/* ─── Middle: Quick Icon Navigation Area ─── */}
      <div className="flex-1 w-full overflow-y-auto no-scrollbar py-2 flex flex-col items-center gap-2">
        {navSections.map((section, sIdx) => (
          <React.Fragment key={section.title || sIdx}>
            {sIdx > 0 && <div className="w-8 h-px bg-slate-200 my-1" />}
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              const hasBadge = Boolean(item.badge);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative w-11 h-11 rounded-2xl flex items-center justify-center transition cursor-pointer ${isActive
                      ? 'bg-[#e6f7f4] border border-[#a7f3d0] text-[#00897b] font-bold shadow-2xs ring-1 ring-[#00897b]/20'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200/60 hover:border-slate-300'
                    }`}
                  title={item.label}
                >
                  <Icon className="w-5 h-5" />
                  {hasBadge && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#f43f5e] ring-2 ring-white" />
                  )}
                </Link>
              );
            })}
          </React.Fragment>
        ))}
      </div>

      {/* ─── Bottom Capsule matching screenshot ─── */}
      <div className="w-full bg-slate-50 border border-slate-200/90 rounded-2xl p-1.5 flex flex-col items-center gap-2.5 mt-2 shadow-2xs">
        {/* User avatar circle */}
        <div
          className="w-9 h-9 rounded-full bg-[#52c41a] text-white font-extrabold flex items-center justify-center text-sm shadow-xs"
          title={`${user?.name || 'Administrator'} (${userDisplayRole})`}
        >
          {userInitial}
        </div>

        {/* Sparkles / performance icon */}
        <button
          type="button"
          onClick={() => router.push(`/${companySlug}/dashboard/kpi`)}
          className="p-1.5 text-slate-400 hover:text-amber-500 rounded-lg hover:bg-white transition cursor-pointer"
          title="Department KPI & Performance"
        >
          <Sparkles className="w-4 h-4" />
        </button>

        {/* Sign out button */}
        <button
          type="button"
          onClick={handleSignOut}
          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-white transition cursor-pointer"
          title="Sign Out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  if (!user) return null;

  return (
    <>
      {/* Mobile Top App Bar (Only visible on small screens) */}
      <div className="md:hidden bg-white text-slate-900 px-4 py-3 flex items-center justify-between border-b border-slate-200 sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsMobileOpen(true)}
            className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:text-slate-900 hover:bg-slate-200 transition cursor-pointer"
            title="Open Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-1.5">
            <span className="font-black text-lg tracking-tight text-[#15803d]">Maintenance.</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-[#15803d] text-white font-bold flex items-center justify-center text-xs">
            {userInitial}
          </div>
          <button
            onClick={handleSignOut}
            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition cursor-pointer"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mobile Sidebar Backdrop & Drawer */}
      {isMobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={closeMobileNav}
          />
          <div className="relative w-64 max-w-[80vw] h-full shadow-2xl z-10 bg-white">
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Desktop Sticky Left Sidebar (Full w-64 or Collapsed w-[72px]) */}
      <aside
        className={`hidden md:flex flex-col shrink-0 sticky top-0 h-screen bg-white z-30 transition-all duration-150 ${isNavHidden ? 'w-[72px]' : 'w-64'
          }`}
      >
        {isNavHidden ? collapsedSidebarContent : sidebarContent}
      </aside>
    </>
  );
}
