'use client';

import { textValue } from '@/lib/textValue';

import React, { useState, useEffect, useMemo } from 'react';
import {
  RotateCw,
  Search,
  ChevronDown,
  User,
  CheckCircle2,
  Calendar,
  AlertTriangle,
  Clock,
  Layers,
  X,
  Filter,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  Wrench,
  CalendarCheck,
  Flame,
  Package,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Printer,
} from 'lucide-react';
import { RepairTicket, PPMSchedule, Machine } from '@/types/cmms';
import {
  subscribeRepairs,
  subscribePPMSchedules,
  subscribeMachines,
  resolveRepairTicket,
  rejectRepairTicket,
  completePPMTask,
} from '@/lib/services/cmmsService';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import { matchesUnit, isUserAdmin, getUserScopedUnit } from '@/lib/constants/units';

export interface ActionItem {
  id: string;
  sourceType: 'PPM' | 'REPAIR' | 'REQUISITION' | 'APPROVAL';
  tag: string; // e.g. "Overdue PPM", "Critical Halt", "Breakdown Fix", "Store Indent"
  tagColor: string;
  machineId: string;
  machineName: string;
  line: string;
  stationNo: string;
  unit: string;
  ref: string; // e.g. "4DORD15615 · Line 01 (St-04) · JUKI DDL-9000C"
  inCharge: string;
  inChargeRole: string;
  targetDate: string; // e.g. "Due 22 Oct"
  urgency: 'Critical' | 'High' | 'Warning' | 'Normal';
  taskTitle: string; // e.g. "PPM: ROTARY HOOK & LOOPER TIMING"
  statusBadge: string; // e.g. "In progress", "Assigned", "Pending"
  dueDate: string; // e.g. "22 Oct"
  plannedDate: string; // e.g. "22 Oct"
  overdueDays: number;
  details: string; // e.g. "Line: Line 01 (St-04) · Unit: UNIT - 1 · Shift: General"
  hint: string; // e.g. "Task is overdue by 4 days · Complete work order or reschedule to clear"
  type: 'PPM' | 'Breakdown' | 'Requisition' | 'Electrical';
  createdAt?: string;
  isCompleted?: boolean;
  rawTicket?: RepairTicket;
  rawPpm?: PPMSchedule;
}

export default function PendingActionsPage() {
  const { showToast } = useToast();
  const { user, role } = useAuth();
  const isAdmin = isUserAdmin(role);
  const effectiveUnit = getUserScopedUnit(user, role);

  const [repairs, setRepairs] = useState<RepairTicket[]>([]);
  const [ppmSchedules, setPpmSchedules] = useState<PPMSchedule[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [clearedTodayCount, setClearedTodayCount] = useState<number>(0);
  const [completedItemIds, setCompletedItemIds] = useState<Set<string>>(new Set());

  // Filter & Search states
  const [activeTab, setActiveTab] = useState<'ALL' | 'OVERDUE' | 'CRITICAL' | 'BREAKDOWN' | 'REQUISITION'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedLine, setSelectedLine] = useState<string>('ALL');
  const [selectedInCharge, setSelectedInCharge] = useState<string>('ALL');
  const [selectedUrgency, setSelectedUrgency] = useState<string>('ALL');
  const [selectedUnit, setSelectedUnit] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'NEWEST' | 'URGENT' | 'DUE' | 'NAME'>('NEWEST');
  const [viewLayout, setViewLayout] = useState<'CARDS' | 'TABLE'>('CARDS');

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(15);

  // Modal state for Date Extension Request
  const [rescheduleModalItem, setRescheduleModalItem] = useState<ActionItem | null>(null);
  const [newRequestedDate, setNewRequestedDate] = useState<string>('');
  const [rescheduleReason, setRescheduleReason] = useState<string>('');

  // Live subscriptions to CMMS database
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

  // Merge live CMMS repairs and PPM schedules into action items
  const allActions: ActionItem[] = useMemo(() => {
    const list: ActionItem[] = [];

    // 1. Map live active repair tickets
    repairs
      .filter((r) => r.status !== 'COMPLETED' && !completedItemIds.has(r.id))
      .forEach((r) => {
        const machine = machines.find((m) => textValue(m.id).toLowerCase() === textValue((r.machineId || '')).toLowerCase());
        const refText = machine
          ? `${machine.id} · ${r.line || machine.currentLine || 'Line 01'} (${machine.stationNo || 'St-01'}) · ${machine.typeName || r.machineType || machine.name}`
          : `${r.machineId || 'EQ-UNKNOWN'} · ${r.line || 'Line 01'} · ${r.machineType || 'Industrial Machine'}`;
        const reportedDate = r.reportedAt ? new Date(r.reportedAt) : new Date();
        const diffDays = Math.max(
          1,
          Math.floor((Date.now() - reportedDate.getTime()) / (1000 * 60 * 60 * 24))
        );

        const isCrit = r.urgency === 'CRITICAL';

        list.push({
          id: `LIVE-REP-${r.id}`,
          sourceType: 'REPAIR',
          tag: isCrit ? 'Critical Line Halt' : 'Breakdown Fix',
          tagColor: isCrit ? 'bg-rose-100 text-rose-800 border-rose-300' : 'bg-amber-100 text-amber-900 border-amber-300',
          machineId: r.machineId || 'EQ-UNKNOWN',
          machineName: machine?.typeName || machine?.name || r.machineType || 'Sewing Machine',
          line: r.line || machine?.currentLine || 'Line 01',
          stationNo: machine?.stationNo || 'Station 01',
          unit: machine?.unit || (r as any).unit || 'UNIT - 1',
          ref: refText,
          inCharge: r.attendedBy || (r as any).assignedTo || 'Ramesh Kumar',
          inChargeRole: 'Floor Line Mechanic',
          targetDate: `Target ${reportedDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`,
          urgency: isCrit ? 'Critical' : 'High',
          taskTitle: `BREAKDOWN: ${textValue((r.faultCategory || 'FLOOR DEFECT')).toUpperCase()} - ${r.faultDetails?.slice(0, 45) || 'REPAIR REQUIRED'}`,
          statusBadge: r.status === 'IN_PROGRESS' ? 'In progress' : 'Assigned',
          dueDate: reportedDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
          plannedDate: reportedDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
          overdueDays: diffDays,
          details: `Line: ${r.line || 'Line 01'} · Unit: ${machine?.unit || 'UNIT - 1'} · Attending: ${r.attendedBy || 'Technician'}`,
          hint: `Breakdown is open for ${diffDays}d · Complete repair or reassign to clear`,
          type: 'Breakdown',
          createdAt: r.reportedAt || (r as any).createdAt || new Date().toISOString(),
          rawTicket: r,
        });
      });

    // 2. Map live active PPM schedules
    ppmSchedules
      .filter((p) => p.status !== 'COMPLETED' && !completedItemIds.has(p.id))
      .forEach((p) => {
        const machine = machines.find((m) => textValue(m.id).toLowerCase() === textValue((p.machineId || '')).toLowerCase());
        const refText = machine
          ? `${machine.id} · ${machine.currentLine || 'Line 02'} (${machine.stationNo || 'St-01'}) · ${machine.typeName || machine.name}`
          : `${p.machineId} · Floor Maintenance · Preventive Task`;
        const dueDateObj = p.nextDue ? new Date(p.nextDue) : new Date();
        const diffDays = Math.max(
          0,
          Math.floor((Date.now() - dueDateObj.getTime()) / (1000 * 60 * 60 * 24))
        );

        list.push({
          id: `LIVE-PPM-${p.id}`,
          sourceType: 'PPM',
          tag: diffDays > 0 ? 'Overdue PPM' : 'Scheduled PPM',
          tagColor: diffDays > 0 ? 'bg-rose-100 text-rose-800 border-rose-300' : 'bg-blue-100 text-blue-800 border-blue-300',
          machineId: p.machineId || 'EQ-UNKNOWN',
          machineName: machine?.typeName || machine?.name || 'Sewing Machine',
          line: machine?.currentLine || 'Line 02',
          stationNo: machine?.stationNo || 'Station 01',
          unit: machine?.unit || 'UNIT - 1',
          ref: refText,
          inCharge: p.assignedTo || 'Ramesh Kumar',
          inChargeRole: 'Senior Master Mechanic',
          targetDate: `Due ${dueDateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`,
          urgency: diffDays > 2 ? 'High' : 'Normal',
          taskTitle: `PPM: ${textValue((p.task || 'PREVENTIVE OVERHAUL')).toUpperCase()}`,
          statusBadge: p.status === 'IN_PROGRESS' ? 'In progress' : 'Pending',
          dueDate: dueDateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
          plannedDate: dueDateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
          overdueDays: diffDays,
          details: `Line: ${machine?.currentLine || 'Line 02'} · Interval: ${p.frequency || 'Weekly'} · Unit: ${machine?.unit || 'UNIT - 1'}`,
          hint: diffDays > 0 ? `PPM is overdue by ${diffDays}d · Complete overhaul checklist to clear` : 'Scheduled preventive maintenance task',
          type: 'PPM',
          createdAt: (p as any).createdAt || (p as any).reportedAt || p.nextDue || new Date().toISOString(),
          rawPpm: p,
        });
      });

    // Ensure newest actions/messages appear at the top
    list.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });

    // Unit filter for non-admins
    if (!isAdmin) {
      return list.filter((item) => matchesUnit(item.unit, effectiveUnit));
    }

    return list;
  }, [repairs, ppmSchedules, machines, completedItemIds, isAdmin, effectiveUnit]);

  // Unique lists for filters
  const uniqueInCharges = useMemo(() => {
    const set = new Set<string>();
    allActions.forEach((a) => {
      if (a.inCharge) set.add(a.inCharge);
    });
    return Array.from(set).sort();
  }, [allActions]);

  const uniqueLines = useMemo(() => {
    const set = new Set<string>();
    allActions.forEach((a) => {
      if (a.line) set.add(a.line);
    });
    return Array.from(set).sort();
  }, [allActions]);

  // Filtered action items
  const filteredActions = useMemo(() => {
    return allActions.filter((item) => {
      // Tab filter
      if (activeTab === 'OVERDUE' && (item.overdueDays <= 0 || item.sourceType !== 'PPM')) return false;
      if (activeTab === 'CRITICAL' && item.urgency !== 'Critical') return false;
      if (activeTab === 'BREAKDOWN' && item.sourceType !== 'REPAIR') return false;
      if (activeTab === 'REQUISITION' && item.sourceType !== 'REQUISITION') return false;

      // Dropdown filters
      if (selectedType !== 'ALL' && textValue(item.type).toLowerCase() !== selectedType.toLowerCase()) {
        return false;
      }
      if (selectedInCharge !== 'ALL' && textValue(item.inCharge).toLowerCase() !== selectedInCharge.toLowerCase()) {
        return false;
      }
      if (selectedLine !== 'ALL' && textValue(item.line).toLowerCase() !== selectedLine.toLowerCase()) {
        return false;
      }
      if (selectedUrgency !== 'ALL' && textValue(item.urgency).toLowerCase() !== selectedUrgency.toLowerCase()) {
        return false;
      }
      if (selectedUnit !== 'ALL' && !matchesUnit(item.unit, selectedUnit)) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesRef = textValue(item.ref).toLowerCase().includes(q);
        const matchesTitle = textValue(item.taskTitle).toLowerCase().includes(q);
        const matchesUser = textValue(item.inCharge).toLowerCase().includes(q);
        const matchesDetails = textValue(item.details).toLowerCase().includes(q);
        const matchesMach = textValue(item.machineId).toLowerCase().includes(q);
        const matchesLine = textValue(item.line).toLowerCase().includes(q);
        if (!matchesRef && !matchesTitle && !matchesUser && !matchesDetails && !matchesMach && !matchesLine) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'NEWEST') {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      }
      if (sortBy === 'URGENT') {
        if (b.overdueDays !== a.overdueDays) return b.overdueDays - a.overdueDays;
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      }
      if (sortBy === 'DUE') {
        if (a.overdueDays !== b.overdueDays) return a.overdueDays - b.overdueDays;
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      }
      return a.taskTitle.localeCompare(b.taskTitle);
    });
  }, [allActions, activeTab, selectedType, selectedInCharge, selectedLine, selectedUrgency, selectedUnit, searchQuery, sortBy]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, activeTab, selectedType, selectedInCharge, selectedLine, selectedUrgency, selectedUnit, sortBy, pageSize]);

  // Paginated slice
  const paginatedActions = useMemo(() => {
    if (pageSize >= filteredActions.length) return filteredActions;
    const start = (currentPage - 1) * pageSize;
    return filteredActions.slice(start, start + pageSize);
  }, [filteredActions, currentPage, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredActions.length / pageSize));

  // Summary Counts
  const totalToGoCount = allActions.length;
  const overduePpmCount = allActions.filter((a) => a.sourceType === 'PPM' && a.overdueDays > 0).length;
  const criticalCount = allActions.filter((a) => a.urgency === 'Critical').length;
  const breakdownCount = allActions.filter((a) => a.sourceType === 'REPAIR').length;
  const requisitionCount = allActions.filter((a) => a.sourceType === 'REQUISITION').length;

  const progressPercent = useMemo(() => {
    const total = totalToGoCount + clearedTodayCount;
    if (total === 0) return 100;
    return Math.min(100, Math.round((clearedTodayCount / total) * 100));
  }, [totalToGoCount, clearedTodayCount]);

  // Complete action handler
  const handleCompleteAction = async (action: ActionItem) => {
    try {
      if (action.sourceType === 'REPAIR' && action.rawTicket) {
        await resolveRepairTicket(
          action.rawTicket.id,
          action.overdueDays * 60 || 30,
          `Completed by ${user?.name || 'Administrator'} via Pending Actions queue.`,
          user?.name || action.inCharge,
          []
        );
      } else if (action.sourceType === 'PPM' && action.rawPpm) {
        await completePPMTask(
          action.rawPpm.id,
          user?.name || action.inCharge,
          undefined,
          30,
          `PPM completed via Pending Actions queue.`
        );
      }

      setCompletedItemIds((prev) => new Set([...prev, action.id]));
      setClearedTodayCount((prev) => prev + 1);
      showToast(`Action "${action.taskTitle}" resolved and updated!`, 'success');
    } catch (err) {
      console.error('Failed to complete action:', err);
      showToast('Error completing action. Please try again.', 'error');
    }
  };

  // Reject action handler (for breakdown issues)
  const handleRejectAction = async (action: ActionItem) => {
    if (action.sourceType === 'REPAIR' && action.rawTicket) {
      try {
        await rejectRepairTicket(
          action.rawTicket.id,
          user?.name || 'Administrator',
          'False alarm / cleared via pending actions queue'
        );
        setCompletedItemIds((prev) => new Set([...prev, action.id]));
        setClearedTodayCount((prev) => prev + 1);
        showToast(`Work order ${action.rawTicket.id} rejected. Machine restored to ACTIVE service.`, 'info');
      } catch (err) {
        console.error('Failed to reject action:', err);
        showToast('Error rejecting action. Please try again.', 'error');
      }
    }
  };

  // Open reschedule modal
  const handleOpenReschedule = (action: ActionItem) => {
    setRescheduleModalItem(action);
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    setNewRequestedDate(futureDate.toISOString().slice(0, 10));
    setRescheduleReason('Awaiting spare parts from tool crib / high priority garment run on floor');
  };

  // Submit date change request
  const handleSubmitReschedule = () => {
    if (!rescheduleModalItem) return;
    showToast(
      `Date extension requested for "${rescheduleModalItem.taskTitle}". Rescheduled to: ${newRequestedDate}`,
      'success'
    );
    setRescheduleModalItem(null);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 p-6 md:p-8 font-sans">
      {/* ─── PROGRESS & SUMMARY CARD ─── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
          <div className="font-bold text-slate-900 flex items-center gap-2">
            <span>{totalToGoCount} pending actions to go</span>
            <span className="text-slate-400">·</span>
            <span className="text-emerald-700">{clearedTodayCount} cleared today</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-xs font-semibold text-slate-500 font-mono">{progressPercent}% resolved</div>

            {/* Layout Toggle & Refresh */}
            <div className="flex items-center gap-2 no-print">
              <div className="bg-slate-100 p-0.5 rounded-xl flex items-center text-xs font-bold border border-slate-200">
                <button
                  type="button"
                  onClick={() => setViewLayout('CARDS')}
                  className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                    viewLayout === 'CARDS'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Cards
                </button>
                <button
                  type="button"
                  onClick={() => setViewLayout('TABLE')}
                  className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                    viewLayout === 'TABLE'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Table
                </button>
              </div>

              <button
                type="button"
                onClick={() => showToast(`Synced: ${totalToGoCount} pending maintenance actions loaded`, 'info')}
                className="p-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-xl transition shadow-2xs cursor-pointer"
                title="Refresh pending actions"
              >
                <RotateCw className="w-4 h-4 text-slate-600 hover:text-slate-900" />
              </button>
            </div>
          </div>
        </div>
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mt-3">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* ─── 3. FILTER PILLS TABS (MAINTENANCE DOMAIN) ─── */}
      <div className="flex items-center gap-2.5 mb-6 overflow-x-auto pb-1 scrollbar-thin">
        {/* All Pill */}
        <button
          onClick={() => setActiveTab('ALL')}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer shrink-0 ${
            activeTab === 'ALL'
              ? 'bg-[#00897b] text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          All Actions ({totalToGoCount})
        </button>

        {/* Overdue PPMs Pill */}
        <button
          onClick={() => setActiveTab('OVERDUE')}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
            activeTab === 'OVERDUE'
              ? 'bg-[#00897b] text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <span>Overdue PPMs</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
            activeTab === 'OVERDUE' ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-800'
          }`}>
            {overduePpmCount}
          </span>
        </button>

        {/* Critical Line Halts Pill */}
        <button
          onClick={() => setActiveTab('CRITICAL')}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
            activeTab === 'CRITICAL'
              ? 'bg-[#00897b] text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <span>Critical Halts</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
            activeTab === 'CRITICAL' ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-800'
          }`}>
            {criticalCount}
          </span>
        </button>

        {/* Breakdown Repairs Pill */}
        <button
          onClick={() => setActiveTab('BREAKDOWN')}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
            activeTab === 'BREAKDOWN'
              ? 'bg-[#00897b] text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <span>Breakdown Repairs</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
            activeTab === 'BREAKDOWN' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-900'
          }`}>
            {breakdownCount}
          </span>
        </button>

        {/* Store Indents Pill */}
        <button
          onClick={() => setActiveTab('REQUISITION')}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer shrink-0 flex items-center gap-1.5 ${
            activeTab === 'REQUISITION'
              ? 'bg-[#00897b] text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <span>Store Indents</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black ${
            activeTab === 'REQUISITION' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-800'
          }`}>
            {requisitionCount}
          </span>
        </button>
      </div>

      {/* ─── 4. FILTER & SEARCH TOOLBAR (MAINTENANCE DOMAIN) ─── */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 mb-6 bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
        {/* Search input */}
        <div className="col-span-12 md:col-span-4 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search machine ID, model, fault, line, station, or technician..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm placeholder:text-slate-400 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
          />
        </div>

        {/* Dropdown: Maintenance Action Type */}
        <div className="col-span-6 md:col-span-2 relative">
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="w-full appearance-none pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
          >
            <option value="ALL">All Action Types</option>
            <option value="PPM">PPM Overhauls</option>
            <option value="Breakdown">Breakdown Repairs</option>
            <option value="Electrical">Electrical Overhauls</option>
            <option value="Requisition">Store Indents</option>
          </select>
          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Dropdown: Process In-Charge / Technician */}
        <div className="col-span-6 md:col-span-2 relative">
          <select
            value={selectedInCharge}
            onChange={(e) => setSelectedInCharge(e.target.value)}
            className="w-full appearance-none pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
          >
            <option value="ALL">All In-Charges</option>
            {uniqueInCharges.map((tech) => (
              <option key={tech} value={tech}>
                {tech}
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Dropdown: Factory Floor Line */}
        <div className="col-span-6 md:col-span-2 relative">
          <select
            value={selectedLine}
            onChange={(e) => setSelectedLine(e.target.value)}
            className="w-full appearance-none pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
          >
            <option value="ALL">All Factory Lines</option>
            {uniqueLines.map((line) => (
              <option key={line} value={line}>
                {line}
              </option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Dropdown: Sort by */}
        <div className="col-span-6 md:col-span-2 relative">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="w-full appearance-none pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer"
          >
            <option value="NEWEST">Newest First</option>
            <option value="URGENT">Most Urgent First</option>
            <option value="DUE">Due Date Soonest</option>
            <option value="NAME">Task Name A-Z</option>
          </select>
          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {/* ─── 5. CONTENT AREA: CARDS OR TABLE VIEW ─── */}
      {viewLayout === 'CARDS' ? (
        /* ─── Action Cards List (Exact matching visual design, adapted to CMMS) ─── */
        <div className="space-y-4">
          {filteredActions.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center shadow-2xs">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-800">All maintenance actions cleared!</h3>
              <p className="text-xs text-slate-500 mt-1">
                There are no pending maintenance actions or PPM schedules matching your active filters.
              </p>
            </div>
          ) : (
            paginatedActions.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs relative transition-all hover:shadow-xs border-l-4 border-l-rose-500"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left Content Area */}
                  <div className="space-y-2 min-w-0 flex-1">
                    {/* Top Line: Badge, Reference, In-charge, Target, Urgency */}
                    <div className="flex flex-wrap items-center gap-2.5 text-xs">
                      {/* Red/Amber Overdue Badge */}
                      <span className={`font-bold text-[11px] px-2.5 py-0.5 rounded-md border ${item.tagColor}`}>
                        {item.tag}
                      </span>

                      {/* Machine Reference: Asset ID · Line (St) · Machine Model */}
                      <span className="font-extrabold text-slate-900 tracking-tight text-sm font-mono">
                        {item.ref}
                      </span>

                      {/* In-Charge with user icon */}
                      <div className="flex items-center gap-1 text-slate-700 font-medium ml-1">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          In-charge: <strong className="font-bold text-slate-900">{item.inCharge}</strong>
                        </span>
                      </div>

                      {/* Target date */}
                      <span className="text-slate-500 font-medium">
                        {item.targetDate}
                      </span>

                      {/* Urgency Pill */}
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                          item.urgency === 'Critical'
                            ? 'bg-rose-100 text-rose-700 border border-rose-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {item.urgency}
                      </span>
                    </div>

                    {/* Second Line: Task Title, Status Badge */}
                    <div className="flex items-center gap-2 text-xs flex-wrap">
                      <span className="font-extrabold text-slate-900 text-sm">
                        {item.taskTitle}
                      </span>
                      <span className="bg-[#eff6ff] text-[#2563eb] font-semibold text-[11px] px-2.5 py-0.5 rounded-full border border-blue-200">
                        {item.statusBadge}
                      </span>
                    </div>

                    {/* Third Line: Due date & Overdue tag */}
                    <div className="text-xs text-slate-700">
                      <span>
                        Due date: <strong className="text-slate-900">{item.dueDate}</strong> (planned{' '}
                        {item.plannedDate})
                      </span>
                      {item.overdueDays > 0 ? (
                        <span className="text-rose-600 font-bold ml-1.5">
                          +{item.overdueDays}d overdue
                        </span>
                      ) : (
                        <span className="text-emerald-600 font-semibold ml-1.5">
                          Due today
                        </span>
                      )}
                    </div>

                    {/* Fourth Line: Secondary Details / Floor Location */}
                    <div className="text-xs text-slate-500 font-medium flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{item.details}</span>
                    </div>

                    {/* Fifth Line: Caption / Action Hint */}
                    <div className="text-[11px] text-slate-400 font-normal pt-1">
                      {item.hint}
                    </div>
                  </div>

                  {/* Right Side Buttons Matching Reference Screenshot */}
                  <div className="flex items-center gap-3 shrink-0 pt-2 lg:pt-0">
                    {/* Complete Button (Teal / Emerald) */}
                    <button
                      onClick={() => handleCompleteAction(item)}
                      className="px-5 py-2 bg-[#00897b] hover:bg-[#00796b] text-white font-bold text-xs rounded-xl shadow-2xs hover:shadow-xs transition cursor-pointer"
                    >
                      Complete
                    </button>

                    {/* Request New Date Button (White with border) */}
                    <button
                      onClick={() => handleOpenReschedule(item)}
                      className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-bold text-xs rounded-xl shadow-2xs hover:shadow-xs transition cursor-pointer"
                    >
                      Request New Date
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* ─── Table View ─── */
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-x-auto min-h-[420px] scrollbar-thin">
            <table className="w-full text-left border-collapse border border-slate-300 text-xs">
              <thead className="sticky top-0 bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider z-20 shadow-xs select-none">
                <tr className="border-b border-slate-300">
                  <th className="py-3 px-3 w-12 text-center bg-slate-200/80 border-r border-b border-slate-300 text-slate-600 font-mono">#</th>
                  <th className="py-3 px-3 whitespace-nowrap bg-slate-100 border-r border-b border-slate-300 font-mono">Target Due</th>
                  <th className="py-3 px-3.5 whitespace-nowrap bg-slate-100 border-r border-b border-slate-300 min-w-[170px]">Machine &amp; Location</th>
                  <th className="py-3 px-3.5 bg-slate-100 border-r border-b border-slate-300 min-w-[240px]">Task / Action Description</th>
                  <th className="py-3 px-3 whitespace-nowrap bg-slate-100 border-r border-b border-slate-300 text-center">Urgency</th>
                  <th className="py-3 px-3 whitespace-nowrap bg-slate-100 border-r border-b border-slate-300 text-center">Status</th>
                  <th className="py-3 px-3.5 whitespace-nowrap bg-slate-100 border-r border-b border-slate-300">Process In-Charge</th>
                  <th className="py-3 px-3 whitespace-nowrap bg-slate-100 border-r border-b border-slate-300 font-mono text-center">Overdue</th>
                  <th className="py-3 px-3 text-right bg-slate-100 border-b border-slate-300 no-print min-w-[160px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredActions.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center text-slate-400 space-y-2 border-b border-slate-200">
                      <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                      <p className="font-bold text-slate-700 text-sm">All actions cleared!</p>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto">
                        No pending maintenance tasks matching your criteria.
                      </p>
                    </td>
                  </tr>
                ) : (
                  paginatedActions.map((item, idx) => {
                    const globalIdx = (currentPage - 1) * pageSize + idx + 1;
                    return (
                      <tr key={item.id} className="hover:bg-blue-50/60 even:bg-slate-50/40 transition-colors group">
                        <td className="py-2.5 px-3 font-mono font-semibold text-slate-500 bg-slate-50/80 group-hover:bg-blue-50/60 text-center border-r border-b border-slate-200 select-none align-top">
                          {globalIdx}
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap align-top border-r border-b border-slate-200">
                          <div className="font-bold text-slate-900 font-mono text-[11px] tabular-nums flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{item.dueDate}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            Planned: {item.plannedDate}
                          </div>
                        </td>
                        <td className="py-2.5 px-3.5 whitespace-nowrap align-top border-r border-b border-slate-200">
                          <div className="font-mono font-bold text-slate-900 text-xs">
                            {item.machineId}
                          </div>
                          <div className="text-[11px] text-slate-600 truncate max-w-[170px]">
                            {item.machineName}
                          </div>
                          <div className="text-[10px] text-indigo-700 font-bold font-mono mt-0.5">
                            {item.line} ({item.stationNo})
                          </div>
                        </td>
                        <td className="py-2.5 px-3.5 align-top border-r border-b border-slate-200">
                          <div className="font-bold text-slate-800 text-xs">
                            {item.taskTitle}
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                            {item.details}
                          </p>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap text-center align-top border-r border-b border-slate-200">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              item.urgency === 'Critical'
                                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                : 'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {item.urgency}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap text-center align-top border-r border-b border-slate-200">
                          <span className="bg-[#eff6ff] text-[#2563eb] font-semibold text-[10px] px-2 py-0.5 rounded-full border border-blue-200">
                            {item.statusBadge}
                          </span>
                        </td>
                        <td className="py-2.5 px-3.5 whitespace-nowrap align-top border-r border-b border-slate-200">
                          <div className="font-bold text-slate-900 leading-tight">
                            {item.inCharge}
                          </div>
                          <div className="text-[10px] text-slate-400 font-medium">
                            {item.inChargeRole}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap text-center align-top font-mono font-bold border-r border-b border-slate-200 tabular-nums">
                          {item.overdueDays > 0 ? (
                            <span className="text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 text-xs">
                              +{item.overdueDays}d
                            </span>
                          ) : (
                            <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-xs">
                              Due
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right whitespace-nowrap align-top border-b border-slate-200 no-print space-x-1.5">
                          {item.sourceType === 'REPAIR' && (
                            <button
                              type="button"
                              onClick={() => handleRejectAction(item)}
                              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[11px] rounded-lg border border-rose-200 transition cursor-pointer shadow-2xs"
                              title="Reject false breakdown alarm"
                            >
                              Reject
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleOpenReschedule(item)}
                            className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 font-bold text-[11px] rounded-lg border border-slate-300 transition cursor-pointer shadow-2xs"
                          >
                            Reschedule
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCompleteAction(item)}
                            className="px-3 py-1 bg-[#00897b] hover:bg-[#00796b] text-white font-bold text-[11px] rounded-lg transition cursor-pointer shadow-2xs"
                          >
                            Complete
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── 6. PAGINATION CONTROLS ─── */}
      <div className="mt-4 p-3 bg-white rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600 select-none shadow-2xs">
        <div className="flex items-center gap-3">
          <span>
            Showing <strong className="font-mono text-slate-900">{filteredActions.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</strong> to{' '}
            <strong className="font-mono text-slate-900">{Math.min(currentPage * pageSize, filteredActions.length)}</strong> of{' '}
            <strong className="font-mono text-slate-900">{filteredActions.length}</strong> actions
          </span>

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
                        ? 'bg-[#00897b] text-white shadow-2xs'
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

      {/* ─── 7. RESCHEDULE / REQUEST NEW DATE MODAL (MAINTENANCE DOMAIN) ─── */}
      {rescheduleModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Request New Maintenance Target Date</h3>
              <button
                onClick={() => setRescheduleModalItem(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="bg-slate-50 p-3 rounded-xl text-xs space-y-1 border border-slate-200/60">
                <div className="text-slate-500 font-medium">Target Machine &amp; Task:</div>
                <div className="font-bold text-slate-900 font-mono">{rescheduleModalItem.ref}</div>
                <div className="text-slate-700 font-bold">{rescheduleModalItem.taskTitle}</div>
                <div className="text-indigo-700 font-semibold">In-Charge: {rescheduleModalItem.inCharge}</div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  New Requested Target Date
                </label>
                <input
                  type="date"
                  value={newRequestedDate}
                  onChange={(e) => setNewRequestedDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Justification / Delay Reason
                </label>
                <textarea
                  rows={3}
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  placeholder="Explain why the PPM or repair task is being rescheduled..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 bg-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRescheduleModalItem(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmitReschedule}
                  className="px-5 py-2 bg-[#00897b] hover:bg-[#00796b] text-white text-xs font-bold rounded-xl transition shadow-2xs cursor-pointer"
                >
                  Submit Reschedule Request
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
