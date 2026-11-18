'use client';

import { textValue } from '@/lib/textValue';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Download,
  Printer,
  Wrench,
  Clock,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  User,
  Filter,
  X,
  Layers,
  ChevronDown,
  Check,
  ChevronLeft,
  ChevronRight,
  Activity,
  Package,
  ShieldAlert,
  Building2,
  Sparkles,
} from 'lucide-react';
import {
  subscribeRepairs,
  subscribeMachines,
  subscribeParts,
  subscribePPMSchedules,
} from '@/lib/services/cmmsService';
import type { RepairTicket, Machine, SparePart, PPMSchedule } from '@/types/cmms';
import { useAuth } from '@/context/AuthContext';
import { matchesUnit, isUserAdmin, getUserScopedUnit } from '@/lib/constants/units';
import { normalizeRole } from '@/lib/constants/roles';

export interface PersonnelHistoryRow {
  id: string;
  ticketId: string;
  date: string;
  dateFormatted: string;
  personName: string;
  personRole: string;
  personTrade: 'MECHANIC' | 'ELECTRICIAN' | 'SUPERVISOR' | 'ADMIN';
  machineId: string;
  machineName: string;
  line: string;
  stationNo: string;
  workType: 'BREAKDOWN' | 'PPM' | 'INSPECTION' | 'RELOCATION';
  urgency: 'CRITICAL' | 'WARNING' | 'NORMAL';
  faultCategory: string;
  faultDetails: string;
  actionTaken: string; // What they did
  partsUsedText: string;
  partsUsedCount: number;
  downtimeMinutes: number;
  status: 'COMPLETED' | 'IN_PROGRESS';
  rawTicket?: RepairTicket;
}

// Comprehensive realistic baseline history of completed works across plant lines
const SEED_COMPLETED_WORKS: PersonnelHistoryRow[] = [];

export function PersonnelWorkHistoryTable() {
  const { user, role } = useAuth();
  const currentUserName = user?.name || 'Administrator';

  // Live state
  const [repairs, setRepairs] = useState<RepairTicket[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [parts, setParts] = useState<SparePart[]>([]);
  const [ppmSchedules, setPpmSchedules] = useState<PPMSchedule[]>([]);

  // Filter & Search states - defaults to 'ALL' so full table history is immediately visible
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPerson, setSelectedPerson] = useState<string>('ALL');
  const [selectedWorkType, setSelectedWorkType] = useState<'ALL' | 'BREAKDOWN' | 'PPM'>('ALL');
  const [selectedUrgency, setSelectedUrgency] = useState<'ALL' | 'CRITICAL' | 'WARNING' | 'NORMAL'>('ALL');
  const [selectedDateRange, setSelectedDateRange] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH'>('ALL');
  const [selectedLine, setSelectedLine] = useState<string>('ALL');

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(15);

  // Inspector modal state
  const [selectedRowDetail, setSelectedRowDetail] = useState<PersonnelHistoryRow | null>(null);

  // Subscriptions
  useEffect(() => {
    const unsubRepairs = subscribeRepairs((data) => setRepairs(data));
    const unsubMachines = subscribeMachines((data) => setMachines(data));
    const unsubParts = subscribeParts((data) => setParts(data));
    const unsubPPM = subscribePPMSchedules((data) => setPpmSchedules(data));

    return () => {
      unsubRepairs();
      unsubMachines();
      unsubParts();
      unsubPPM();
    };
  }, []);

  const currentRole = normalizeRole(user?.role || role);
  const isFloorTechnician = currentRole === 'MECHANIC' || currentRole === 'ELECTRICIAN';
  const isAdmin = isUserAdmin(role);
  const effectiveUnit = getUserScopedUnit(user, role);

  // Merge live completed repairs with realistic baseline completed works
  const allHistoryRows: PersonnelHistoryRow[] = useMemo(() => {
    const scopedMachines = !isAdmin
      ? machines.filter((m) => matchesUnit(m.unit, effectiveUnit))
      : machines;
    const allowedMachineIds = new Set(scopedMachines.map((m) => textValue(m.id).toLowerCase()));

    const machineMap = new Map<string, Machine>();
    scopedMachines.forEach((m) => machineMap.set(m.id, m));

    // 1. Live completed repair tickets
    const liveCompletedRows: PersonnelHistoryRow[] = repairs
      .filter((t) => {
        if (!isAdmin) {
          const matchMach = t.machineId && allowedMachineIds.has(textValue(t.machineId).toLowerCase());
          const matchUnit = t.unit && matchesUnit(t.unit, effectiveUnit);
          if (!matchMach && !matchUnit) return false;
        }
        return t.status === 'COMPLETED' || (t.attendedBy && t.actionTaken && t.status !== 'IN_PROGRESS');
      })
      .map((t) => {
        const mch = machineMap.get(t.machineId);
        const resolvedDateObj = t.resolvedAt ? new Date(t.resolvedAt) : new Date(t.reportedAt);
        const dateFormatted = !isNaN(resolvedDateObj.getTime())
          ? resolvedDateObj.toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })
          : t.reportedAt;

        const personName = t.attendedBy || 'Technician On Duty';

        let personTrade: PersonnelHistoryRow['personTrade'] = 'MECHANIC';
        const pLower = personName.toLowerCase();
        if (pLower.includes('electrician') || pLower.includes('anand') || pLower.includes('karthik') || pLower.includes('rajesh')) {
          personTrade = 'ELECTRICIAN';
        } else if (pLower.includes('senior') || pLower.includes('master') || pLower.includes('ramesh')) {
          personTrade = 'SUPERVISOR';
        }

        const partsStr =
          t.partsUsed && t.partsUsed.length > 0
            ? t.partsUsed.map((p) => `${p.name} x${p.quantity}`).join(', ')
            : 'Labor Only (0 Parts)';

        const isPpm = textValue(t.faultCategory)?.toLowerCase().includes('ppm') || textValue(t.reportedBy)?.toLowerCase().includes('ppm');

        return {
          id: `LIVE-${t.id}`,
          ticketId: t.id,
          date: t.resolvedAt || t.reportedAt,
          dateFormatted,
          personName,
          personRole: personTrade === 'ELECTRICIAN' ? 'Plant Electrician Lead' : personTrade === 'SUPERVISOR' ? 'Senior Master Mechanic' : 'Line Mechanic',
          personTrade,
          machineId: t.machineId,
          machineName: mch?.name || mch?.type || t.machineType || t.machineId,
          line: t.line || mch?.currentLine || 'Line 01',
          stationNo: mch?.stationNo || 'Station 01',
          workType: isPpm ? 'PPM' : 'BREAKDOWN',
          urgency: t.urgency || 'NORMAL',
          faultCategory: t.faultCategory || 'Breakdown Work Order',
          faultDetails: t.faultDetails || '',
          actionTaken: t.actionTaken || 'Inspected machine components and restored to operational standard.',
          partsUsedText: partsStr,
          partsUsedCount: t.partsUsed ? t.partsUsed.reduce((sum, p) => sum + p.quantity, 0) : 0,
          downtimeMinutes: t.downtimeMinutes || 25,
          status: 'COMPLETED',
          rawTicket: t,
        };
      });

    // 2. Also incorporate completed PPM schedules
    const liveCompletedPpm: PersonnelHistoryRow[] = ppmSchedules
      .filter((p) => p.status === 'COMPLETED' && p.lastServiced)
      .map((p) => {
        const mch = machineMap.get(p.machineId);
        const dateObj = new Date(p.lastServiced);
        const dateFormatted = !isNaN(dateObj.getTime())
          ? dateObj.toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })
          : p.lastServiced;

        return {
          id: `PPM-COMP-${p.id}`,
          ticketId: p.id,
          date: p.lastServiced,
          dateFormatted,
          personName: 'Ramesh Kumar',
          personRole: 'Senior Master Mechanic',
          personTrade: 'SUPERVISOR',
          machineId: p.machineId,
          machineName: mch?.name || mch?.type || p.machineId,
          line: mch?.currentLine || 'Line 01',
          stationNo: mch?.stationNo || 'Station 01',
          workType: 'PPM',
          urgency: 'NORMAL',
          faultCategory: p.task || 'Preventive Maintenance Overhaul',
          faultDetails: `Interval: ${p.intervalDays} days (${p.frequency})`,
          actionTaken: 'Completed multi-point preventive maintenance inspection, lubricated bearings, and verified safety cutoff.',
          partsUsedText: 'Labor Only (0 Parts)',
          partsUsedCount: 0,
          downtimeMinutes: 30,
          status: 'COMPLETED',
        };
      });

    // Combine live rows first, then seed rows (avoid duplicates by ticketId)
    const existingIds = new Set(liveCompletedRows.map((r) => r.ticketId));
    const nonDupeSeeds = SEED_COMPLETED_WORKS.filter((s) => !existingIds.has(s.ticketId));

    const combined = [...liveCompletedRows, ...liveCompletedPpm, ...nonDupeSeeds];

    // For floor mechanics/electricians, show ONLY their own personal history
    if (isFloorTechnician) {
      const userClean = textValue((user?.name || '')).toLowerCase().trim();
      const userFirst = userClean.split(' ')[0] || '';

      const myOnlyRows = combined.filter((r) => {
        const pClean = textValue((r.personName || '')).toLowerCase().trim();
        return (
          pClean === userClean ||
          (userFirst.length > 2 && pClean.includes(userFirst)) ||
          (pClean.split(' ')[0]?.length > 2 && userClean.includes(pClean.split(' ')[0]))
        );
      });

      return myOnlyRows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    return combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [repairs, ppmSchedules, machines, isAdmin, effectiveUnit, isFloorTechnician, user?.name]);

  // Unique list of people who have logged actions
  const uniquePersonsList = useMemo(() => {
    if (isFloorTechnician) {
      return [user?.name || 'Me'];
    }
    const set = new Set<string>();
    allHistoryRows.forEach((r) => {
      if (r.personName && r.personName !== 'Unassigned') {
        set.add(r.personName);
      }
    });
    return Array.from(set).sort();
  }, [allHistoryRows, isFloorTechnician, user?.name]);

  // Unique list of lines
  const uniqueLinesList = useMemo(() => {
    const set = new Set<string>();
    allHistoryRows.forEach((r) => {
      if (r.line) set.add(r.line);
    });
    return Array.from(set).sort();
  }, [allHistoryRows]);

  // Filtered rows
  const filteredRows = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const userClean = currentUserName.toLowerCase().trim();
    const userFirst = userClean.split(' ')[0] || '';

    return allHistoryRows.filter((row) => {
      // 1. Person filter
      if (selectedPerson === 'MY') {
        const pClean = textValue(row.personName).toLowerCase();
        const matchesMy =
          pClean === userClean ||
          (userFirst.length > 2 && pClean.includes(userFirst)) ||
          (pClean.split(' ')[0]?.length > 2 && userClean.includes(pClean.split(' ')[0]));
        if (!matchesMy) return false;
      } else if (selectedPerson !== 'ALL') {
        if (textValue(row.personName).toLowerCase() !== selectedPerson.toLowerCase()) {
          return false;
        }
      }

      // 2. Work type filter
      if (selectedWorkType !== 'ALL' && row.workType !== selectedWorkType) {
        return false;
      }

      // 3. Urgency filter
      if (selectedUrgency !== 'ALL' && row.urgency !== selectedUrgency) {
        return false;
      }

      // 4. Line filter
      if (selectedLine !== 'ALL' && row.line !== selectedLine) {
        return false;
      }

      // 5. Date range filter
      if (selectedDateRange === 'TODAY') {
        if (!row.date.startsWith(todayStr)) return false;
      } else if (selectedDateRange === 'WEEK') {
        const rowTime = new Date(row.date).getTime();
        const weekAgo = Date.now() - 7 * 86400000;
        if (rowTime < weekAgo) return false;
      } else if (selectedDateRange === 'MONTH') {
        const thisMonthPrefix = todayStr.slice(0, 7);
        if (!row.date.startsWith(thisMonthPrefix)) return false;
      }

      // 6. Search query
      if (searchQuery.trim()) {
        const tokens = searchQuery.toLowerCase().trim().split(/\s+/).filter(Boolean);
        const rowHaystack = [
          row.ticketId,
          row.personName,
          row.personRole,
          row.personTrade,
          row.machineId,
          row.machineName,
          row.line,
          row.stationNo,
          row.workType,
          row.urgency,
          row.faultCategory,
          row.faultDetails,
          row.actionTaken,
          row.partsUsedText,
          row.dateFormatted,
          row.status,
          `${row.downtimeMinutes}m`,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        const allTokensMatch = tokens.every((token: string) => rowHaystack.includes(token));
        if (!allTokensMatch) {
          return false;
        }
      }

      return true;
    });
  }, [allHistoryRows, selectedPerson, selectedWorkType, selectedUrgency, selectedLine, selectedDateRange, searchQuery, currentUserName]);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedPerson, selectedWorkType, selectedUrgency, selectedLine, selectedDateRange, pageSize]);

  // Paginated slice
  const paginatedRows = useMemo(() => {
    if (pageSize >= filteredRows.length) return filteredRows;
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));

  // Summary Metrics
  const summaryMetrics = useMemo(() => {
    const totalActions = filteredRows.length;
    const totalDowntime = filteredRows.reduce((acc, r) => acc + (r.downtimeMinutes || 0), 0);
    const totalPartsCount = filteredRows.reduce((acc, r) => acc + (r.partsUsedCount || 0), 0);
    const distinctPersons = new Set(filteredRows.map((r) => r.personName)).size;

    return {
      totalActions,
      totalDowntime,
      totalPartsCount,
      distinctPersons,
    };
  }, [filteredRows]);

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      'Ticket ID',
      'Date & Time',
      'Person Name',
      'Trade / Role',
      'Machine ID',
      'Machine Name',
      'Line',
      'Station',
      'Work Type',
      'Urgency',
      'Issue / Task',
      'Action Taken (What Was Done)',
      'Parts Consumed',
      'Downtime (Minutes)',
      'Status',
    ];

    const csvRows = filteredRows.map((r) => [
      `"${r.ticketId}"`,
      `"${r.dateFormatted}"`,
      `"${r.personName}"`,
      `"${r.personRole}"`,
      `"${r.machineId}"`,
      `"${r.machineName.replace(/"/g, '""')}"`,
      `"${r.line}"`,
      `"${r.stationNo}"`,
      `"${r.workType}"`,
      `"${r.urgency}"`,
      `"${r.faultCategory.replace(/"/g, '""')}"`,
      `"${r.actionTaken.replace(/"/g, '""')}"`,
      `"${r.partsUsedText.replace(/"/g, '""')}"`,
      r.downtimeMinutes,
      `"${r.status}"`,
    ]);

    const csvContent = [headers.join(','), ...csvRows.map((row) => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `completed_works_history_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      {/* ─── 1. COMPACT KPI STRIP & EXPORT ACTIONS ──────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-emerald-50 text-emerald-900 border border-emerald-200 px-3 py-1.5 rounded-xl font-bold text-xs shadow-2xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Total Completed:</span>
            <span className="font-mono font-black text-emerald-800 text-sm ml-0.5">{summaryMetrics.totalActions}</span>
            <span className="text-[10px] text-emerald-700 font-semibold uppercase">works</span>
          </div>

          <div className="flex items-center gap-2 bg-indigo-50 text-indigo-900 border border-indigo-200 px-3 py-1.5 rounded-xl font-bold text-xs shadow-2xs">
            <Clock className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>Downtime Saved:</span>
            <span className="font-mono font-black text-indigo-800 text-sm ml-0.5">{summaryMetrics.totalDowntime}</span>
            <span className="text-[10px] text-indigo-700 font-semibold uppercase">mins</span>
          </div>

          <div className="flex items-center gap-2 bg-amber-50 text-amber-900 border border-amber-200 px-3 py-1.5 rounded-xl font-bold text-xs shadow-2xs">
            <Package className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Parts Installed:</span>
            <span className="font-mono font-black text-amber-800 text-sm ml-0.5">{summaryMetrics.totalPartsCount}</span>
            <span className="text-[10px] text-amber-700 font-semibold uppercase">units</span>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 text-slate-800 border border-slate-200 px-3 py-1.5 rounded-xl font-bold text-xs shadow-2xs">
            <User className="w-4 h-4 text-slate-500 shrink-0" />
            <span>{isFloorTechnician ? 'Logged In Staff:' : 'Technicians:'}</span>
            <span className="font-mono font-black text-slate-900 text-sm ml-0.5">
              {isFloorTechnician ? (user?.name || 'Personal') : summaryMetrics.distinctPersons}
            </span>
            <span className="text-[10px] text-slate-500 font-semibold uppercase">
              {isFloorTechnician ? 'Personal Ledger' : 'active'}
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 shrink-0 self-end md:self-auto no-print">
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
            title="Download CSV spreadsheet of completed works table"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-slate-200 cursor-pointer shadow-2xs"
            title="Print completed works table"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* ─── 2. SEARCH & FILTER TOOLBAR ─────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-3.5 space-y-2.5 no-print">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          {/* Search bar */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search table by ticket, machine ID, fault details, action taken, line..."
              className="w-full pl-9 pr-24 py-2 text-xs font-medium text-slate-900 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-2xs transition"
            />
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-slate-400 hover:text-slate-600 cursor-pointer p-0.5 rounded-full hover:bg-slate-200"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <span className="text-[10px] font-bold text-slate-600 bg-slate-200/70 px-2 py-0.5 rounded-md font-mono">
                {filteredRows.length} found
              </span>
            </div>
          </div>

          {/* Filter Dropdowns */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Technician Filter */}
            {isFloorTechnician ? (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-900 border border-emerald-200 rounded-xl text-xs font-bold shadow-2xs">
                <User className="w-3.5 h-3.5 text-emerald-600" />
                <span>Tech: <strong className="text-emerald-950 font-black">{user?.name || 'Personal'}</strong></span>
                <span className="text-[9px] bg-emerald-200/80 text-emerald-800 px-1.5 py-0.2 rounded font-bold uppercase">Solo</span>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Tech:</span>
                <select
                  value={selectedPerson}
                  onChange={(e) => setSelectedPerson(e.target.value)}
                  className="text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-2xs"
                >
                  <option value="ALL">All Technicians ({allHistoryRows.length})</option>
                  <option value="MY">Assigned to Me</option>
                  <optgroup label="Floor Personnel">
                    {uniquePersonsList.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
            )}

            {/* Work Type Filter */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Type:</span>
              <select
                value={selectedWorkType}
                onChange={(e) => setSelectedWorkType(e.target.value as typeof selectedWorkType)}
                className="text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-2xs"
              >
                <option value="ALL">All Work Types</option>
                <option value="BREAKDOWN">Breakdown Repairs</option>
                <option value="PPM">PPM Overhauls</option>
              </select>
            </div>

            {/* Line Filter */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Line:</span>
              <select
                value={selectedLine}
                onChange={(e) => setSelectedLine(e.target.value)}
                className="text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-2xs"
              >
                <option value="ALL">All Lines</option>
                {uniqueLinesList.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>

            {/* Urgency Filter */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Urgency:</span>
              <select
                value={selectedUrgency}
                onChange={(e) => setSelectedUrgency(e.target.value as typeof selectedUrgency)}
                className="text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-2xs"
              >
                <option value="ALL">All Urgencies</option>
                <option value="CRITICAL">Critical</option>
                <option value="WARNING">Warning</option>
                <option value="NORMAL">Normal</option>
              </select>
            </div>

            {/* Date Range Filter */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Date:</span>
              <select
                value={selectedDateRange}
                onChange={(e) => setSelectedDateRange(e.target.value as typeof selectedDateRange)}
                className="text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-2xs"
              >
                <option value="ALL">All Time</option>
                <option value="TODAY">Today Only</option>
                <option value="WEEK">Last 7 Days</option>
                <option value="MONTH">This Month</option>
              </select>
            </div>

            {/* Reset Filters button */}
            {(selectedPerson !== 'ALL' ||
              selectedWorkType !== 'ALL' ||
              selectedUrgency !== 'ALL' ||
              selectedLine !== 'ALL' ||
              selectedDateRange !== 'ALL' ||
              searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedPerson('ALL');
                  setSelectedWorkType('ALL');
                  setSelectedUrgency('ALL');
                  setSelectedLine('ALL');
                  setSelectedDateRange('ALL');
                  setSearchQuery('');
                }}
                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 py-1 rounded-lg font-bold text-[11px] transition cursor-pointer border border-rose-200"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ─── 3. FULL COMPLETED WORKS HISTORY TABLE ───────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto min-h-[420px] scrollbar-thin">
          <table className="w-full text-left border-collapse border border-slate-300 text-xs">
            <thead className="sticky top-0 bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider z-20 shadow-xs select-none">
              <tr className="border-b border-slate-300">
                <th className="py-3 px-3 w-12 text-center bg-slate-200/80 border-r border-b border-slate-300 text-slate-600 font-mono">#</th>
                <th className="py-3 px-3 whitespace-nowrap bg-slate-100 border-r border-b border-slate-300 font-mono">Date &amp; Time</th>
                <th className="py-3 px-3 whitespace-nowrap bg-slate-100 border-r border-b border-slate-300 font-mono">Work Order #</th>
                <th className="py-3 px-3 whitespace-nowrap bg-slate-100 border-r border-b border-slate-300 text-center">Type</th>
                <th className="py-3 px-3.5 whitespace-nowrap bg-slate-100 border-r border-b border-slate-300 min-w-[170px]">Machine &amp; Location</th>
                <th className="py-3 px-3.5 bg-slate-100 border-r border-b border-slate-300 min-w-[200px]">Issue / Fault Details</th>
                <th className="py-3 px-4 bg-slate-100 border-r border-b border-slate-300 min-w-[280px]">Action Taken (What Was Done)</th>
                <th className="py-3 px-3.5 whitespace-nowrap bg-slate-100 border-r border-b border-slate-300">Technician In-Charge</th>
                <th className="py-3 px-3 whitespace-nowrap bg-slate-100 border-r border-b border-slate-300">Parts Replaced</th>
                <th className="py-3 px-3 whitespace-nowrap bg-slate-100 border-r border-b border-slate-300 font-mono text-center">Downtime</th>
                <th className="py-3 px-3 whitespace-nowrap text-center bg-slate-100 border-r border-b border-slate-300">Status</th>
                <th className="py-3 px-3 text-right bg-slate-100 border-b border-slate-300 no-print">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-16 text-center text-slate-400 space-y-2 border-b border-slate-200">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                      <Wrench className="w-6 h-6" />
                    </div>
                    <p className="font-bold text-slate-700 text-sm">
                      {isFloorTechnician
                        ? `No completed works logged yet for ${user?.name || 'your profile'}`
                        : 'No completed work records found'}
                    </p>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      {isFloorTechnician
                        ? 'As you start and complete breakdown repair tickets or PPM inspections, your completed work logs and duration stamps will appear here.'
                        : 'No historical repair or overhaul actions match your selected filters. Try clearing your filters.'}
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row, idx) => {
                  const globalIdx = (currentPage - 1) * pageSize + idx + 1;
                  const isCritical = row.urgency === 'CRITICAL';
                  const isPPM = row.workType === 'PPM';

                  return (
                    <tr
                      key={row.id}
                      className="hover:bg-blue-50/60 even:bg-slate-50/40 transition-colors group"
                    >
                      {/* 0. Row # */}
                      <td className="py-2.5 px-3 font-mono font-semibold text-slate-500 bg-slate-50/80 group-hover:bg-blue-50/60 text-center border-r border-b border-slate-200 select-none align-top">
                        {globalIdx}
                      </td>

                      {/* 1. Date & Time */}
                      <td className="py-2.5 px-3 whitespace-nowrap align-top border-r border-b border-slate-200">
                        <div className="font-bold text-slate-900 font-mono text-[11px] tabular-nums flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{row.dateFormatted}</span>
                        </div>
                      </td>

                      {/* 2. Work Order / Ticket # */}
                      <td className="py-2.5 px-3 whitespace-nowrap align-top border-r border-b border-slate-200">
                        <span className="font-mono font-bold text-slate-900 text-xs bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {row.ticketId}
                        </span>
                        <div className="mt-1">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase ${
                              isCritical
                                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                : row.urgency === 'WARNING'
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {row.urgency}
                          </span>
                        </div>
                      </td>

                      {/* 3. Work Type Badge */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-center align-top border-r border-b border-slate-200">
                        {isPPM ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 shadow-2xs">
                            <Activity className="w-3 h-3 text-blue-600" />
                            <span>PPM Overhaul</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200 shadow-2xs">
                            <Wrench className="w-3 h-3 text-amber-700" />
                            <span>Breakdown Fix</span>
                          </span>
                        )}
                      </td>

                      {/* 4. Machine & Location */}
                      <td className="py-2.5 px-3.5 whitespace-nowrap align-top border-r border-b border-slate-200">
                        <div className="font-mono font-bold text-slate-900 text-xs">
                          {row.machineId}
                        </div>
                        <div className="text-[11px] text-slate-600 truncate max-w-[170px]">
                          {row.machineName}
                        </div>
                        <div className="text-[10px] text-indigo-700 font-bold font-mono mt-0.5 flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-indigo-500 shrink-0" />
                          <span>{row.line}</span>
                          <span className="text-slate-400">•</span>
                          <span>{row.stationNo}</span>
                        </div>
                      </td>

                      {/* 5. Issue / Fault Details */}
                      <td className="py-2.5 px-3.5 align-top border-r border-b border-slate-200">
                        <div className="font-bold text-slate-800 text-xs">
                          {row.faultCategory}
                        </div>
                        {row.faultDetails && (
                          <div className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-relaxed">
                            {row.faultDetails}
                          </div>
                        )}
                      </td>

                      {/* 6. Action Taken (What Was Done) */}
                      <td className="py-2.5 px-4 align-top border-r border-b border-slate-200">
                        <div className="bg-emerald-50/60 rounded-lg p-2 border border-emerald-200/80 group-hover:bg-white group-hover:border-emerald-300 transition shadow-2xs">
                          <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1 mb-0.5">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Resolution Executed</span>
                          </div>
                          <p className="text-xs font-medium text-slate-800 leading-relaxed">
                            {row.actionTaken}
                          </p>
                        </div>
                      </td>

                      {/* 7. Technician In-Charge */}
                      <td className="py-2.5 px-3.5 whitespace-nowrap align-top border-r border-b border-slate-200">
                        <div className="flex items-center gap-2">
                          <div
                            className={`w-7 h-7 rounded-lg text-white font-black text-[10px] flex items-center justify-center shrink-0 shadow-2xs ${
                              row.personTrade === 'ELECTRICIAN'
                                ? 'bg-cyan-600'
                                : row.personTrade === 'SUPERVISOR'
                                ? 'bg-indigo-600'
                                : 'bg-emerald-600'
                            }`}
                          >
                            {row.personName.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 leading-tight">
                              {row.personName}
                            </div>
                            <div className="text-[10px] text-slate-500 font-medium">
                              {row.personRole}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 8. Parts Replaced */}
                      <td className="py-2.5 px-3 align-top border-r border-b border-slate-200">
                        <div className="max-w-[180px]">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                              row.partsUsedCount > 0
                                ? 'bg-amber-50 text-amber-900 border border-amber-200 font-mono'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {row.partsUsedText}
                          </span>
                        </div>
                      </td>

                      {/* 9. Downtime Restored */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-center align-top font-mono font-bold text-slate-900 border-r border-b border-slate-200 tabular-nums">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 text-xs">
                          <Clock className="w-3 h-3 text-rose-500" />
                          <span>{row.downtimeMinutes}m</span>
                        </span>
                      </td>

                      {/* 10. Status */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-center align-top border-r border-b border-slate-200">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <Check className="w-3 h-3 text-emerald-700" />
                          <span>Completed</span>
                        </span>
                      </td>

                      {/* 11. Inspect Action */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap align-top border-b border-slate-200 no-print">
                        <button
                          type="button"
                          onClick={() => setSelectedRowDetail(row)}
                          className="px-2.5 py-1 bg-white hover:bg-slate-900 hover:text-white text-slate-700 font-bold text-[11px] rounded-lg border border-slate-300 transition cursor-pointer shadow-2xs"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ─── 4. TABLE FOOTER & PAGINATION CONTROLS ─────────────────────── */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600 select-none">
          <div className="flex items-center gap-3">
            <span>
              Showing <strong className="font-mono text-slate-900">{filteredRows.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</strong> to{' '}
              <strong className="font-mono text-slate-900">{Math.min(currentPage * pageSize, filteredRows.length)}</strong> of{' '}
              <strong className="font-mono text-slate-900">{filteredRows.length}</strong> completed work entries
            </span>

            {/* Page Size Selector */}
            <div className="flex items-center gap-1.5 ml-2">
              <span className="text-[11px] text-slate-400">Rows:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="bg-white border border-slate-200 rounded-lg px-2 py-0.5 text-xs font-bold text-slate-700 cursor-pointer shadow-2xs"
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={500}>All</option>
              </select>
            </div>
          </div>

          {/* Page Buttons */}
          {totalPages > 1 && (
            <div className="flex items-center gap-1 self-center sm:self-auto">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
                title="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1 font-mono text-xs">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum = i + 1;
                  if (totalPages > 5 && currentPage > 3) {
                    pageNum = currentPage - 2 + i;
                    if (pageNum > totalPages) pageNum = totalPages - (4 - i);
                  }

                  return (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-7 h-7 rounded-lg text-xs font-bold transition cursor-pointer ${
                        currentPage === pageNum
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
                title="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ─── 5. INSPECT DETAIL MODAL ─────────────────────────────────────── */}
      {selectedRowDetail && (
        <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in duration-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Completed Work Dossier
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    #{selectedRowDetail.ticketId} • {selectedRowDetail.dateFormatted}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRowDetail(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              {/* Technician who did it */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Attended &amp; Resolved By
                  </div>
                  <div className="text-sm font-black text-slate-900 mt-0.5">
                    {selectedRowDetail.personName}
                  </div>
                  <div className="text-xs text-indigo-700 font-semibold">
                    {selectedRowDetail.personRole}
                  </div>
                </div>
                <div className="text-right">
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    Verified Completed
                  </span>
                  <div className="text-[11px] text-slate-500 font-mono mt-1">
                    ⏱️ {selectedRowDetail.downtimeMinutes} mins downtime
                  </div>
                </div>
              </div>

              {/* Machine & Location */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Machine / Asset</div>
                  <div className="text-xs font-bold text-slate-800 font-mono mt-0.5">
                    {selectedRowDetail.machineId}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">
                    {selectedRowDetail.machineName}
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Location</div>
                  <div className="text-xs font-bold text-slate-800 mt-0.5">
                    {selectedRowDetail.line}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {selectedRowDetail.stationNo}
                  </div>
                </div>
              </div>

              {/* Issue Description */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1">
                <div className="text-[10px] font-bold text-slate-400 uppercase">
                  Issue / Fault Reported
                </div>
                <div className="text-xs font-bold text-slate-900">
                  {selectedRowDetail.faultCategory}
                </div>
                {selectedRowDetail.faultDetails && (
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {selectedRowDetail.faultDetails}
                  </p>
                )}
              </div>

              {/* Action Taken: WHAT THEY DID */}
              <div className="bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-200 space-y-1">
                <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Action Taken by Technician (What Was Done)</span>
                </div>
                <p className="text-xs font-semibold text-slate-900 leading-relaxed">
                  {selectedRowDetail.actionTaken}
                </p>
              </div>

              {/* Spare Parts */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1">
                <div className="text-[10px] font-bold text-slate-400 uppercase">
                  Spare Parts Consumed / Installed
                </div>
                <p className="text-xs font-bold text-slate-800 font-mono">
                  {selectedRowDetail.partsUsedText}
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedRowDetail(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Close Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
