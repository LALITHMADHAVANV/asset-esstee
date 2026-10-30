'use client';

import { textValue } from '@/lib/textValue';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Layers,
  Wrench,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Play,
  RotateCw,
  Search,
  Filter,
  User,
  ShieldAlert,
  Flame,
  ArrowRight,
  Boxes,
  CalendarCheck,
  Check,
  X,
  Phone,
  Building2,
  Sparkles,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Printer,
  Calendar,
  Activity,
  Package,
} from 'lucide-react';
import { RepairTicket, PPMSchedule, Machine } from '@/types/cmms';
import {
  subscribeRepairs,
  subscribePPMSchedules,
  subscribeMachines,
  resolveRepairTicket,
  assignRepairTicket,
  completePPMTask,
} from '@/lib/services/cmmsService';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { matchesUnit, isUserAdmin, getUserScopedUnit } from '@/lib/constants/units';

export interface ActiveWorkItem {
  id: string;
  sourceType: 'BREAKDOWN' | 'PPM';
  ticketId: string;
  machineId: string;
  machineName: string;
  machineModel: string;
  line: string;
  stationNo: string;
  department: string;
  unit: string;
  faultCategory: string;
  faultDetails: string;
  urgency: 'CRITICAL' | 'WARNING' | 'NORMAL';
  status: 'IN_PROGRESS' | 'ASSIGNED' | 'PENDING';
  assignedTo: string;
  reportedAt: string;
  startedAt?: string | null;
  runningMinutes: number;
  rawRepair?: RepairTicket;
  rawPpm?: PPMSchedule;
}

// Clean baseline active works (0 demo data; populated strictly from live MongoDB repairs & PPM)
const SEED_ACTIVE_WORKS: ActiveWorkItem[] = [];

export default function ActiveTnaPage() {
  const { user, role } = useAuth();
  const { showToast } = useToast();
  const isAdmin = isUserAdmin(role);
  const effectiveUnit = getUserScopedUnit(user, role);

  const [repairs, setRepairs] = useState<RepairTicket[]>([]);
  const [ppmSchedules, setPpmSchedules] = useState<PPMSchedule[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [completedSeedIds, setCompletedSeedIds] = useState<Set<string>>(new Set());

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPerson, setSelectedPerson] = useState<string>('ALL');
  const [workTypeFilter, setWorkTypeFilter] = useState<'ALL' | 'BREAKDOWN' | 'PPM'>('ALL');
  const [urgencyFilter, setUrgencyFilter] = useState<'ALL' | 'CRITICAL' | 'WARNING' | 'NORMAL'>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | 'IN_PROGRESS' | 'ASSIGNED' | 'PENDING'>('ALL');
  const [selectedLine, setSelectedLine] = useState<string>('ALL');
  const [selectedUnit, setSelectedUnit] = useState<string>('ALL');

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(15);

  // Resolution modal state
  const [resolvingWork, setResolvingWork] = useState<ActiveWorkItem | null>(null);
  const [actionTakenText, setActionTakenText] = useState('');
  const [downtimeInput, setDowntimeInput] = useState<number>(30);
  const [technicianNotes, setTechnicianNotes] = useState('');

  // Reassign modal state
  const [reassigningWork, setReassigningWork] = useState<ActiveWorkItem | null>(null);
  const [newAssignee, setNewAssignee] = useState('');

  // Live CMMS subscriptions
  useEffect(() => {
    const unsubR = subscribeRepairs((data) => setRepairs(data));
    const unsubPPM = subscribePPMSchedules((data) => setPpmSchedules(data));
    const unsubM = subscribeMachines((data) => setMachines(data));

    return () => {
      unsubR();
      unsubPPM();
      unsubM();
    };
  }, []);

  // Compute active work items
  const activeWorks: ActiveWorkItem[] = useMemo(() => {
    const list: ActiveWorkItem[] = [];
    const now = Date.now();

    // 1. Live Active Repairs (Status !== 'COMPLETED')
    repairs
      .filter((r) => r.status !== 'COMPLETED')
      .forEach((r) => {
        const machine = machines.find((m) => textValue(m.id).toLowerCase() === textValue((r.machineId || '')).toLowerCase());
        const repDate = new Date(r.reportedAt || (r as any).createdAt || now).getTime();
        const elapsedMinutes = Math.max(1, Math.round((now - repDate) / 60000));

        let normUrgency: 'CRITICAL' | 'WARNING' | 'NORMAL' = 'NORMAL';
        if (r.urgency === 'CRITICAL') normUrgency = 'CRITICAL';
        else if (r.urgency === 'WARNING') normUrgency = 'WARNING';

        list.push({
          id: `LIVE-REP-${r.id}`,
          sourceType: 'BREAKDOWN',
          ticketId: r.id,
          machineId: r.machineId || 'EQ-UNKNOWN',
          machineName: machine?.typeName || machine?.name || r.machineType || 'Industrial Sewing Machine',
          machineModel: machine?.model || machine?.brand || 'JUKI DDL-9000',
          line: r.line || machine?.currentLine || 'Line 01',
          stationNo: machine?.stationNo || 'Station 01',
          department: machine?.department || 'Sewing Floor',
          unit: machine?.unit || (r as any).unit || 'UNIT - 1',
          faultCategory: r.faultCategory || 'Breakdown Maintenance',
          faultDetails: r.faultDetails || 'Operational defect requiring mechanic inspection',
          urgency: normUrgency,
          status: r.status === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'ASSIGNED',
          assignedTo: r.attendedBy || (r as any).assignedTo || 'Unassigned',
          reportedAt: r.reportedAt || new Date().toISOString(),
          startedAt: r.startedAt,
          runningMinutes: elapsedMinutes,
          rawRepair: r,
        });
      });

    // 2. Live Active PPM schedules (Status !== 'COMPLETED')
    ppmSchedules
      .filter((p) => p.status !== 'COMPLETED')
      .forEach((p) => {
        const machine = machines.find((m) => textValue(m.id).toLowerCase() === textValue((p.machineId || '')).toLowerCase());
        const dueObj = p.nextDue ? new Date(p.nextDue) : new Date();
        const elapsedMinutes = Math.max(1, Math.round((now - dueObj.getTime()) / 60000));

        list.push({
          id: `LIVE-PPM-${p.id}`,
          sourceType: 'PPM',
          ticketId: p.id,
          machineId: p.machineId || 'EQ-UNKNOWN',
          machineName: machine?.typeName || machine?.name || 'Preventive Maintenance Service',
          machineModel: machine?.model || machine?.brand || 'Standard Fleet Machine',
          line: machine?.currentLine || 'Floor Maintenance',
          stationNo: machine?.stationNo || 'Active Line',
          department: machine?.department || 'Sewing Floor',
          unit: machine?.unit || 'UNIT - 1',
          faultCategory: 'PPM Maintenance Overhaul',
          faultDetails: `${p.task || 'Preventive service checklist'} (${p.frequency || 'Weekly'} overhaul)`,
          urgency: 'WARNING',
          status: p.status === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'PENDING',
          assignedTo: p.assignedTo || 'Unassigned',
          reportedAt: p.nextDue || new Date().toISOString(),
          startedAt: p.startedAt,
          runningMinutes: elapsedMinutes,
          rawPpm: p,
        });
      });

    // 3. Merge baseline seeds (exclude any that have been resolved or duplicate ticket ID)
    const existingTicketIds = new Set(list.map((item) => item.ticketId));
    const activeSeeds = SEED_ACTIVE_WORKS.filter(
      (s) => !completedSeedIds.has(s.id) && !existingTicketIds.has(s.ticketId)
    );

    const combined = [...list, ...activeSeeds];

    // Unit scoping for non-admins
    if (!isAdmin) {
      return combined.filter((w) => matchesUnit(w.unit, effectiveUnit));
    }

    return combined;
  }, [repairs, ppmSchedules, machines, completedSeedIds, isAdmin, effectiveUnit]);

  // Unique lists for dropdowns
  const uniqueTechnicians = useMemo(() => {
    const set = new Set<string>();
    activeWorks.forEach((w) => {
      if (w.assignedTo && w.assignedTo !== 'Unassigned') set.add(w.assignedTo);
    });
    return Array.from(set).sort();
  }, [activeWorks]);

  const uniqueLines = useMemo(() => {
    const set = new Set<string>();
    activeWorks.forEach((w) => {
      if (w.line) set.add(w.line);
    });
    return Array.from(set).sort();
  }, [activeWorks]);

  // Filtered active works
  const filteredWorks = useMemo(() => {
    return activeWorks.filter((work) => {
      // 1. Work type filter
      if (workTypeFilter !== 'ALL' && work.sourceType !== workTypeFilter) {
        return false;
      }

      // 2. Urgency filter
      if (urgencyFilter !== 'ALL' && work.urgency !== urgencyFilter) {
        return false;
      }

      // 3. Status filter
      if (selectedStatus !== 'ALL' && work.status !== selectedStatus) {
        return false;
      }

      // 4. Line filter
      if (selectedLine !== 'ALL' && work.line !== selectedLine) {
        return false;
      }

      // 5. Unit filter
      if (selectedUnit !== 'ALL' && !matchesUnit(work.unit, selectedUnit)) {
        return false;
      }

      // 6. Technician filter
      if (selectedPerson !== 'ALL') {
        if (selectedPerson === 'MY') {
          if (textValue(work.assignedTo).toLowerCase() !== textValue((user?.name || '')).toLowerCase()) {
            return false;
          }
        } else if (textValue(work.assignedTo).toLowerCase() !== selectedPerson.toLowerCase()) {
          return false;
        }
      }

      // 7. Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const match =
          textValue(work.ticketId).toLowerCase().includes(query) ||
          textValue(work.machineId).toLowerCase().includes(query) ||
          textValue(work.machineName).toLowerCase().includes(query) ||
          textValue(work.line).toLowerCase().includes(query) ||
          textValue(work.stationNo).toLowerCase().includes(query) ||
          textValue(work.assignedTo).toLowerCase().includes(query) ||
          textValue(work.faultCategory).toLowerCase().includes(query) ||
          textValue(work.faultDetails).toLowerCase().includes(query);
        if (!match) return false;
      }

      return true;
    });
  }, [activeWorks, workTypeFilter, urgencyFilter, selectedStatus, selectedLine, selectedUnit, selectedPerson, searchQuery, user]);

  // Reset page on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedPerson, workTypeFilter, urgencyFilter, selectedStatus, selectedLine, selectedUnit, pageSize]);

  // Paginated slice
  const paginatedWorks = useMemo(() => {
    if (pageSize >= filteredWorks.length) return filteredWorks;
    const start = (currentPage - 1) * pageSize;
    return filteredWorks.slice(start, start + pageSize);
  }, [filteredWorks, currentPage, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredWorks.length / pageSize));

  // Summary Metrics
  const summaryMetrics = useMemo(() => {
    const total = activeWorks.length;
    const breakdowns = activeWorks.filter((w) => w.sourceType === 'BREAKDOWN').length;
    const ppms = activeWorks.filter((w) => w.sourceType === 'PPM').length;
    const critical = activeWorks.filter((w) => w.urgency === 'CRITICAL').length;
    const totalRunningDowntime = activeWorks.reduce((sum, w) => sum + w.runningMinutes, 0);
    const activeTechs = new Set(activeWorks.map((w) => w.assignedTo).filter((name) => name !== 'Unassigned')).size;

    return {
      total,
      breakdowns,
      ppms,
      critical,
      totalRunningDowntime,
      activeTechs,
    };
  }, [activeWorks]);

  // Open Complete Work Modal
  const handleOpenCompleteModal = (work: ActiveWorkItem) => {
    setResolvingWork(work);
    setActionTakenText(`Replaced worn components, recalibrated tension and verified test sewing operation.`);
    setDowntimeInput(Math.min(180, Math.max(15, work.runningMinutes)));
    setTechnicianNotes('Machine fully restored and released to production floor.');
  };

  // Submit Completion (transfers work to Completed TNAs)
  const handleSubmitComplete = async () => {
    if (!resolvingWork) return;

    try {
      if (resolvingWork.sourceType === 'BREAKDOWN' && resolvingWork.rawRepair) {
        await resolveRepairTicket(
          resolvingWork.rawRepair.id,
          downtimeInput,
          actionTakenText,
          user?.name || resolvingWork.assignedTo,
          []
        );
      } else if (resolvingWork.sourceType === 'PPM' && resolvingWork.rawPpm) {
        await completePPMTask(
          resolvingWork.rawPpm.id,
          user?.name || resolvingWork.assignedTo,
          undefined,
          downtimeInput,
          actionTakenText
        );
      } else {
        // If it was a seed item, remove it locally and register it in repairs
        setCompletedSeedIds((prev) => new Set([...prev, resolvingWork.id]));
      }

      showToast(`Work order ${resolvingWork.ticketId} COMPLETED and archived to Completed TNAs history!`, 'success');
      setResolvingWork(null);
    } catch (err) {
      console.error(err);
      showToast('Error completing work order', 'error');
    }
  };

  // Submit Reassignment
  const handleReassign = async () => {
    if (!reassigningWork || !newAssignee) return;

    try {
      if (reassigningWork.sourceType === 'BREAKDOWN' && reassigningWork.rawRepair) {
        await assignRepairTicket(reassigningWork.rawRepair.id, newAssignee, user?.name || 'Administrator');
      }
      showToast(`Work ${reassigningWork.ticketId} reassigned to ${newAssignee}!`, 'success');
      setReassigningWork(null);
      setNewAssignee('');
    } catch (err) {
      console.error(err);
      showToast('Error reassigning work', 'error');
    }
  };

  // Export Active Works CSV
  const handleExportCSV = () => {
    const headers = [
      'Ticket ID',
      'Work Type',
      'Urgency',
      'Machine ID',
      'Machine Name',
      'Line',
      'Station',
      'Unit',
      'Issue / Fault Details',
      'Status',
      'Attending Technician',
      'Running Downtime (Mins)',
      'Reported Timestamp',
    ];

    const rows = filteredWorks.map((w) => [
      `"${w.ticketId}"`,
      `"${w.sourceType}"`,
      `"${w.urgency}"`,
      `"${w.machineId}"`,
      `"${w.machineName.replace(/"/g, '""')}"`,
      `"${w.line}"`,
      `"${w.stationNo}"`,
      `"${w.unit}"`,
      `"${w.faultCategory}: ${w.faultDetails.replace(/"/g, '""')}"`,
      `"${w.status}"`,
      `"${w.assignedTo}"`,
      w.runningMinutes,
      `"${w.reportedAt}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `active_works_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4 pt-0 font-sans">
      {/* ─── 1. PAGE TITLE & TOP ACTION CONTROLS ─────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="p-2 rounded-xl bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs">
            <Layers className="w-5 h-5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                Active TNAs: Plant Floor Active Works
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                <span>Live Stream</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Live floor ledger tracking currently open breakdown repairs, scheduled PPM overhauls, running downtime clocks, and attending technicians
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto no-print">
          <Link
            href="/dashboard/history"
            className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Completed TNAs</span>
          </Link>
          <button
            type="button"
            onClick={handleExportCSV}
            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
            title="Download CSV spreadsheet of active works"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-slate-200 cursor-pointer shadow-2xs"
            title="Print active works table"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* ─── 2. COMPACT KPI STRIP ────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-3.5 flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-amber-50 text-amber-900 border border-amber-200 px-3 py-1.5 rounded-xl font-bold text-xs shadow-2xs">
          <Layers className="w-4 h-4 text-amber-600 shrink-0" />
          <span>Total Active Works:</span>
          <span className="font-mono font-black text-amber-800 text-sm ml-0.5">{summaryMetrics.total}</span>
          <span className="text-[10px] text-amber-700 font-semibold uppercase">jobs</span>
        </div>

        <div className="flex items-center gap-2 bg-rose-50 text-rose-900 border border-rose-200 px-3 py-1.5 rounded-xl font-bold text-xs shadow-2xs">
          <Clock className="w-4 h-4 text-rose-600 shrink-0" />
          <span>Running Downtime:</span>
          <span className="font-mono font-black text-rose-800 text-sm ml-0.5">{summaryMetrics.totalRunningDowntime}</span>
          <span className="text-[10px] text-rose-700 font-semibold uppercase">mins</span>
        </div>

        <div className="flex items-center gap-2 bg-rose-100/70 text-rose-950 border border-rose-300 px-3 py-1.5 rounded-xl font-bold text-xs shadow-2xs">
          <Flame className="w-4 h-4 text-rose-700 shrink-0" />
          <span>Critical Halts:</span>
          <span className="font-mono font-black text-rose-900 text-sm ml-0.5">{summaryMetrics.critical}</span>
          <span className="text-[10px] text-rose-700 font-semibold uppercase">urgent</span>
        </div>

        <div className="flex items-center gap-2 bg-blue-50 text-blue-900 border border-blue-200 px-3 py-1.5 rounded-xl font-bold text-xs shadow-2xs">
          <CalendarCheck className="w-4 h-4 text-blue-600 shrink-0" />
          <span>PPM Overhauls:</span>
          <span className="font-mono font-black text-blue-800 text-sm ml-0.5">{summaryMetrics.ppms}</span>
          <span className="text-[10px] text-blue-700 font-semibold uppercase">sched</span>
        </div>

        <div className="flex items-center gap-2 bg-indigo-50 text-indigo-900 border border-indigo-200 px-3 py-1.5 rounded-xl font-bold text-xs shadow-2xs">
          <User className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>Floor Technicians:</span>
          <span className="font-mono font-black text-indigo-800 text-sm ml-0.5">{summaryMetrics.activeTechs}</span>
          <span className="text-[10px] text-indigo-700 font-semibold uppercase">attending</span>
        </div>
      </div>

      {/* ─── 3. SEARCH & FILTER TOOLBAR ─────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-3.5 space-y-2.5 no-print">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
          {/* Search bar */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by ticket #, machine ID, name, fault details, technician, line..."
              className="w-full pl-9 pr-24 py-2 text-xs font-medium text-slate-900 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs transition"
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
                {filteredWorks.length} active
              </span>
            </div>
          </div>

          {/* Filter Dropdowns */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Technician Filter */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Tech:</span>
              <select
                value={selectedPerson}
                onChange={(e) => setSelectedPerson(e.target.value)}
                className="text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer shadow-2xs"
              >
                <option value="ALL">All Technicians</option>
                <option value="MY">Assigned to Me</option>
                <optgroup label="Floor Personnel">
                  {uniqueTechnicians.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* Work Type Filter */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Type:</span>
              <select
                value={workTypeFilter}
                onChange={(e) => setWorkTypeFilter(e.target.value as any)}
                className="text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer shadow-2xs"
              >
                <option value="ALL">All Active Works</option>
                <option value="BREAKDOWN">Breakdown Fixes</option>
                <option value="PPM">PPM Overhauls</option>
              </select>
            </div>

            {/* Urgency Filter */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Urgency:</span>
              <select
                value={urgencyFilter}
                onChange={(e) => setUrgencyFilter(e.target.value as any)}
                className="text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer shadow-2xs"
              >
                <option value="ALL">All Urgencies</option>
                <option value="CRITICAL">Critical Halts</option>
                <option value="WARNING">Warnings</option>
                <option value="NORMAL">Normal</option>
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Status:</span>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as any)}
                className="text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer shadow-2xs"
              >
                <option value="ALL">All Statuses</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="ASSIGNED">Assigned</option>
                <option value="PENDING">Pending</option>
              </select>
            </div>

            {/* Line Filter */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Line:</span>
              <select
                value={selectedLine}
                onChange={(e) => setSelectedLine(e.target.value)}
                className="text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer shadow-2xs"
              >
                <option value="ALL">All Lines</option>
                {uniqueLines.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>

            {/* Unit Filter */}
            {isAdmin && (
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Unit:</span>
                <select
                  value={selectedUnit}
                  onChange={(e) => setSelectedUnit(e.target.value)}
                  className="text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-pointer shadow-2xs"
                >
                  <option value="ALL">All Units</option>
                  <option value="UNIT - 1">Unit 1 (Nethaji)</option>
                  <option value="UNIT-2">Unit 2 (Perundurai)</option>
                </select>
              </div>
            )}

            {/* Reset Filters button */}
            {(selectedPerson !== 'ALL' ||
              workTypeFilter !== 'ALL' ||
              urgencyFilter !== 'ALL' ||
              selectedStatus !== 'ALL' ||
              selectedLine !== 'ALL' ||
              selectedUnit !== 'ALL' ||
              searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedPerson('ALL');
                  setWorkTypeFilter('ALL');
                  setUrgencyFilter('ALL');
                  setSelectedStatus('ALL');
                  setSelectedLine('ALL');
                  setSelectedUnit('ALL');
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

      {/* ─── 4. FULL ACTIVE WORKS TABLE ─────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto min-h-[420px] scrollbar-thin">
          <table className="w-full text-left border-collapse border border-slate-300 text-xs">
            <thead className="sticky top-0 bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider z-20 shadow-xs select-none">
              <tr className="border-b border-slate-300">
                <th className="py-3 px-3 w-12 text-center bg-slate-200/80 border-r border-b border-slate-300 text-slate-600 font-mono">#</th>
                <th className="py-3 px-3 whitespace-nowrap bg-slate-100 border-r border-b border-slate-300 font-mono">Reported / Started</th>
                <th className="py-3 px-3 whitespace-nowrap bg-slate-100 border-r border-b border-slate-300 font-mono">Ticket #</th>
                <th className="py-3 px-3 whitespace-nowrap bg-slate-100 border-r border-b border-slate-300 text-center">Type</th>
                <th className="py-3 px-3.5 whitespace-nowrap bg-slate-100 border-r border-b border-slate-300 min-w-[170px]">Machine &amp; Location</th>
                <th className="py-3 px-3.5 bg-slate-100 border-r border-b border-slate-300 min-w-[220px]">Issue / Task Details</th>
                <th className="py-3 px-3 whitespace-nowrap bg-slate-100 border-r border-b border-slate-300 text-center">Current Status</th>
                <th className="py-3 px-3.5 whitespace-nowrap bg-slate-100 border-r border-b border-slate-300">Attending Technician</th>
                <th className="py-3 px-3 whitespace-nowrap bg-slate-100 border-r border-b border-slate-300 font-mono text-center">Live Downtime</th>
                <th className="py-3 px-3 text-right bg-slate-100 border-b border-slate-300 no-print min-w-[170px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {filteredWorks.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center text-slate-400 space-y-2 border-b border-slate-200">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                      <Layers className="w-6 h-6" />
                    </div>
                    <p className="font-bold text-slate-700 text-sm">No active floor works matching criteria</p>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto">
                      All plant floor machinery operating normally, or no active work orders match your current filters.
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedWorks.map((work, idx) => {
                  const globalIdx = (currentPage - 1) * pageSize + idx + 1;
                  const isCritical = work.urgency === 'CRITICAL';
                  const isPPM = work.sourceType === 'PPM';

                  return (
                    <tr
                      key={work.id}
                      className="hover:bg-blue-50/60 even:bg-slate-50/40 transition-colors group"
                    >
                      {/* 0. Row # */}
                      <td className="py-2.5 px-3 font-mono font-semibold text-slate-500 bg-slate-50/80 group-hover:bg-blue-50/60 text-center border-r border-b border-slate-200 select-none align-top">
                        {globalIdx}
                      </td>

                      {/* 1. Reported / Started */}
                      <td className="py-2.5 px-3 whitespace-nowrap align-top border-r border-b border-slate-200">
                        <div className="font-bold text-slate-900 font-mono text-[11px] tabular-nums flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{new Date(work.reportedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {new Date(work.reportedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                        </div>
                      </td>

                      {/* 2. Ticket # */}
                      <td className="py-2.5 px-3 whitespace-nowrap align-top border-r border-b border-slate-200">
                        <span className="font-mono font-bold text-slate-900 text-xs bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {work.ticketId}
                        </span>
                        <div className="mt-1">
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase ${
                              isCritical
                                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                : work.urgency === 'WARNING'
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {work.urgency}
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
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-900 border border-rose-200 shadow-2xs">
                            <Wrench className="w-3 h-3 text-rose-700" />
                            <span>Breakdown Fix</span>
                          </span>
                        )}
                      </td>

                      {/* 4. Machine & Location */}
                      <td className="py-2.5 px-3.5 whitespace-nowrap align-top border-r border-b border-slate-200">
                        <div className="font-mono font-bold text-slate-900 text-xs">
                          {work.machineId}
                        </div>
                        <div className="text-[11px] text-slate-600 truncate max-w-[170px]">
                          {work.machineName}
                        </div>
                        <div className="text-[10px] text-indigo-700 font-bold font-mono mt-0.5 flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-indigo-500 shrink-0" />
                          <span>{work.line}</span>
                          <span className="text-slate-400">•</span>
                          <span>{work.stationNo}</span>
                        </div>
                      </td>

                      {/* 5. Issue / Fault Details */}
                      <td className="py-2.5 px-3.5 align-top border-r border-b border-slate-200">
                        <div className="font-bold text-slate-800 text-xs">
                          {work.faultCategory}
                        </div>
                        <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5 leading-relaxed">
                          {work.faultDetails}
                        </p>
                      </td>

                      {/* 6. Current Status */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-center align-top border-r border-b border-slate-200">
                        {work.status === 'IN_PROGRESS' ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                            <span>In Progress</span>
                          </span>
                        ) : work.status === 'ASSIGNED' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            <span>Assigned</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                            <span>Pending</span>
                          </span>
                        )}
                      </td>

                      {/* 7. Attending Technician */}
                      <td className="py-2.5 px-3.5 whitespace-nowrap align-top border-r border-b border-slate-200">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white font-black text-[10px] flex items-center justify-center shrink-0 shadow-2xs">
                            {work.assignedTo.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 leading-tight">
                              {work.assignedTo}
                            </div>
                            <div className="text-[10px] text-slate-400 font-medium">
                              Attending Staff
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 8. Live Downtime Clock */}
                      <td className="py-2.5 px-3 whitespace-nowrap text-center align-top font-mono font-bold border-r border-b border-slate-200 tabular-nums">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 text-xs">
                          <Clock className="w-3.5 h-3.5 text-rose-500 animate-spin" style={{ animationDuration: '4s' }} />
                          <span>⏱️ {work.runningMinutes}m</span>
                        </span>
                      </td>

                      {/* 9. Actions */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap align-top border-b border-slate-200 no-print space-x-1.5">
                        <button
                          type="button"
                          onClick={() => setReassigningWork(work)}
                          className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 font-bold text-[11px] rounded-lg border border-slate-300 transition cursor-pointer shadow-2xs"
                        >
                          Reassign
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenCompleteModal(work)}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-lg transition cursor-pointer shadow-2xs inline-flex items-center gap-1"
                        >
                          <Check className="w-3 h-3" />
                          <span>Complete</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ─── 5. TABLE FOOTER & PAGINATION CONTROLS ─────────────────────── */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600 select-none">
          <div className="flex items-center gap-3">
            <span>
              Showing <strong className="font-mono text-slate-900">{filteredWorks.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</strong> to{' '}
              <strong className="font-mono text-slate-900">{Math.min(currentPage * pageSize, filteredWorks.length)}</strong> of{' '}
              <strong className="font-mono text-slate-900">{filteredWorks.length}</strong> active floor works
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
                          ? 'bg-amber-600 text-white shadow-2xs'
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

      {/* ─── 6. RESOLUTION / COMPLETE WORK MODAL ─────────────────────────── */}
      {resolvingWork && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 animate-in fade-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Complete Active Work Order
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono">
                    #{resolvingWork.ticketId} • Archive to Completed TNAs
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setResolvingWork(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-1">
                <div className="text-[10px] font-bold text-slate-400 uppercase">Target Machine &amp; Task</div>
                <div className="font-bold text-slate-900 font-mono">
                  {resolvingWork.machineId} — {resolvingWork.machineName}
                </div>
                <div className="text-slate-600 flex items-center gap-2 font-mono text-[11px]">
                  <span>{resolvingWork.line}</span>
                  <span>•</span>
                  <span>{resolvingWork.stationNo}</span>
                  <span>•</span>
                  <span>{resolvingWork.unit}</span>
                </div>
                <div className="text-indigo-700 font-semibold mt-1">
                  Attended By: {resolvingWork.assignedTo}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Action Taken by Technician (What Was Done)
                </label>
                <textarea
                  rows={3}
                  value={actionTakenText}
                  onChange={(e) => setActionTakenText(e.target.value)}
                  placeholder="Describe the exact fix, adjustments made, and test run results..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Total Downtime (Minutes)
                  </label>
                  <input
                    type="number"
                    value={downtimeInput}
                    onChange={(e) => setDowntimeInput(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Technician Notes
                  </label>
                  <input
                    type="text"
                    value={technicianNotes}
                    onChange={(e) => setTechnicianNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setResolvingWork(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitComplete}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>Submit &amp; Archive to Completed TNAs</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 7. REASSIGN TECHNICIAN MODAL ─────────────────────────────────── */}
      {reassigningWork && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-sm w-full p-6 animate-in fade-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-extrabold text-slate-900">
                Reassign Floor Technician
              </h3>
              <button
                type="button"
                onClick={() => setReassigningWork(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-600">
                Select technician to attend work order{' '}
                <strong className="text-slate-900 font-mono">#{reassigningWork.ticketId}</strong> ({reassigningWork.machineId}):
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Assignee
                </label>
                <select
                  value={newAssignee}
                  onChange={(e) => setNewAssignee(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  <option value="">-- Choose Field Technician --</option>
                  <option value="ROBERT">ROBERT (Line Mechanic)</option>
                  <option value="Suresh M">Suresh M (Senior Overlock Specialist)</option>
                  <option value="Anand Kumar">Anand Kumar (Plant Electrician Lead)</option>
                  <option value="Rajesh M">Rajesh M (Maintenance Electrician)</option>
                  <option value="Karthik S">Karthik S (Floor Line Mechanic)</option>
                  <option value="P. Arumugam">P. Arumugam (Floor In-Charge Mechanic)</option>
                  <option value="Shaju">Shaju (Process Maintenance Lead)</option>
                  <option value="R.Saravanan">R.Saravanan (PPM Technician)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setReassigningWork(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!newAssignee}
                onClick={handleReassign}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-2xs transition cursor-pointer"
              >
                Confirm Reassignment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
