'use client';

import { textValue } from '@/lib/textValue';

import React, { useState, useEffect, useMemo } from 'react';
import {
  CalendarCheck,
  Calendar,
  Clock,
  Wrench,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Play,
  RotateCw,
  Search,
  Filter,
  Plus,
  Users,
  Building2,
  ChevronRight,
  Layers,
  Sparkles,
  Camera,
  Check,
  X,
  SlidersHorizontal,
  ChevronDown,
  LayoutGrid,
  ListFilter,
  ArrowRight,
  CheckCheck,
} from 'lucide-react';
import { Machine, PPMSchedule, PPMFrequency, PPMStatus } from '@/types/cmms';
import {
  subscribeMachines,
  subscribePPMSchedules,
  createPPMSchedule,
  completePPMTask,
} from '@/lib/services/cmmsService';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import { matchesUnit, isUserAdmin, getUserScopedUnit } from '@/lib/constants/units';

// Format Date helper
function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function PPMSchedulerPage() {
  const { showToast } = useToast();
  const { user, role } = useAuth();
  const isAdmin = isUserAdmin(role);

  const [machines, setMachines] = useState<Machine[]>([]);
  const [ppmSchedules, setPpmSchedules] = useState<PPMSchedule[]>([]);
  const [techUsers, setTechUsers] = useState<any[]>([]);

  // Facility Unit Filter
  const [selectedUnit, setSelectedUnit] = useState<string>(() => {
    if (isUserAdmin(role)) return 'ALL';
    return getUserScopedUnit(user, role);
  });
  const effectiveUnit = getUserScopedUnit(user, role, selectedUnit === 'ALL' ? null : selectedUnit);

  useEffect(() => {
    if (!isUserAdmin(role)) {
      setSelectedUnit(getUserScopedUnit(user, role));
    }
  }, [user, role]);

  // View state & filters
  const [activeTab, setActiveTab] = useState<'ALL' | 'ACTIVE' | 'OVERDUE' | 'DUE_SOON' | 'COMPLETED'>('ALL');
  const [viewMode, setViewMode] = useState<'GRID' | 'TABLE'>('GRID');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLine, setSelectedLine] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Single Machine Schedule Modal State
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [selectedMachineForSchedule, setSelectedMachineForSchedule] = useState<Machine | null>(null);
  const [taskName, setTaskName] = useState('Routine Preventative Maintenance & Lubrication');
  const [frequency, setFrequency] = useState<PPMFrequency>('Monthly');
  const [intervalDays, setIntervalDays] = useState<number>(30);
  const [nextDueDate, setNextDueDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return toDateKey(d);
  });
  const [assignedTechnician, setAssignedTechnician] = useState<string>('');
  const [isSubmittingSchedule, setIsSubmittingSchedule] = useState(false);

  // Bulk Schedule Modal State ("Schedule PPM for Every Machine")
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [bulkFrequency, setBulkFrequency] = useState<PPMFrequency>('Monthly');
  const [bulkIntervalDays, setBulkIntervalDays] = useState<number>(30);
  const [bulkTaskName, setBulkTaskName] = useState('Comprehensive Multi-Point Machinery Overhaul');
  const [bulkStartDate, setBulkStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return toDateKey(d);
  });
  const [bulkAssignedTechnician, setBulkAssignedTechnician] = useState<string>('');
  const [isSubmittingBulk, setIsSubmittingBulk] = useState(false);

  // Complete PPM Modal State
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [selectedPpmForComplete, setSelectedPpmForComplete] = useState<PPMSchedule | null>(null);
  const [completionNotes, setCompletionNotes] = useState('');
  const [completionDuration, setCompletionDuration] = useState<number>(30);
  const [completionProofImg, setCompletionProofImg] = useState<string | null>(null);
  const [isSubmittingComplete, setIsSubmittingComplete] = useState(false);

  // Fetch registered users to populate technician assignment dropdowns
  useEffect(() => {
    fetch('/api/users')
      .then((r) => r.json())
      .then((data) => {
        if (data.users && Array.isArray(data.users)) {
          const techs = data.users.filter((u: any) =>
            ['MECHANIC', 'ELECTRICIAN', 'SENIOR_MECHANIC', 'SENIOR_ELECTRICIAN'].includes(textValue((u.role || '')).toUpperCase())
          );
          setTechUsers(techs);
        }
      })
      .catch((err) => console.warn('Failed to load tech users:', err));
  }, []);

  // Subscriptions
  useEffect(() => {
    const unsubM = subscribeMachines((data) => setMachines(data));
    const unsubP = subscribePPMSchedules((data) => setPpmSchedules(data));

    return () => {
      unsubM();
      unsubP();
    };
  }, []);

  // Filter machines based on selected unit
  const scopedMachines = useMemo(() => {
    if (isAdmin && selectedUnit === 'ALL') return machines;
    return machines.filter((m) => matchesUnit(m.unit, effectiveUnit));
  }, [machines, isAdmin, selectedUnit, effectiveUnit]);

  // Filter PPM schedules based on selected unit
  const scopedPpm = useMemo(() => {
    if (isAdmin && selectedUnit === 'ALL') return ppmSchedules;
    const allowedMachineIds = new Set(scopedMachines.map((m) => textValue(m.id).toLowerCase()));
    return ppmSchedules.filter((p) => {
      if (p.machineId && allowedMachineIds.has(textValue(p.machineId).toLowerCase())) return true;
      if (p.unit && matchesUnit(p.unit, effectiveUnit)) return true;
      return false;
    });
  }, [ppmSchedules, scopedMachines, isAdmin, selectedUnit, effectiveUnit]);

  // Group all available technicians by unit
  const groupedTechnicians = useMemo(() => {
    const groups: Record<string, any[]> = {};
    techUsers.forEach((t) => {
      const u = t.unit || 'All Units';
      if (!groups[u]) groups[u] = [];
      groups[u].push(t);
    });
    return groups;
  }, [techUsers]);

  // Map each machine with its active / latest PPM schedule
  const machinesWithPpm = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    return scopedMachines.map((machine) => {
      // Find active (non-completed) or most recent PPM for this machine
      const machinePpms = scopedPpm.filter(
        (p) => textValue(p.machineId).toLowerCase() === textValue(machine.id).toLowerCase()
      );

      const activePpm =
        machinePpms.find((p) => p.status !== 'COMPLETED') ||
        machinePpms[0] ||
        null;

      let ppmStatusCategory: 'NONE' | 'OVERDUE' | 'DUE_SOON' | 'ACTIVE' | 'COMPLETED' = 'NONE';
      let diffDays = 0;

      if (activePpm) {
        if (activePpm.status === 'COMPLETED') {
          ppmStatusCategory = 'COMPLETED';
        } else {
          const due = new Date(activePpm.nextDue);
          due.setHours(0, 0, 0, 0);
          diffDays = Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

          if (diffDays < 0) {
            ppmStatusCategory = 'OVERDUE';
          } else if (diffDays <= 7) {
            ppmStatusCategory = 'DUE_SOON';
          } else {
            ppmStatusCategory = 'ACTIVE';
          }
        }
      }

      return {
        machine,
        activePpm,
        ppmStatusCategory,
        diffDays,
      };
    });
  }, [scopedMachines, scopedPpm]);

  // Filtered list
  const filteredMachines = useMemo(() => {
    return machinesWithPpm.filter((item) => {
      // Tab filter
      if (activeTab === 'ACTIVE' && item.ppmStatusCategory === 'NONE') return false;
      if (activeTab === 'OVERDUE' && item.ppmStatusCategory !== 'OVERDUE') return false;
      if (activeTab === 'DUE_SOON' && item.ppmStatusCategory !== 'DUE_SOON') return false;
      if (activeTab === 'COMPLETED' && item.ppmStatusCategory !== 'COMPLETED') return false;

      // Line filter
      if (selectedLine !== 'ALL') {
        const line = item.machine.currentLine || item.machine.area || '';
        if (line !== selectedLine) return false;
      }

      // Category filter
      if (selectedCategory !== 'ALL') {
        const cat = item.machine.category || 'MACHINE';
        if (cat !== selectedCategory) return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesId = textValue(item.machine.id).toLowerCase().includes(q);
        const matchesBrand = textValue((item.machine.brand || '')).toLowerCase().includes(q);
        const matchesModel = textValue((item.machine.model || '')).toLowerCase().includes(q);
        const matchesType = textValue((item.machine.typeName || item.machine.type || '')).toLowerCase().includes(q);
        const matchesTech = textValue((item.activePpm?.assignedTo || '')).toLowerCase().includes(q);
        const matchesTask = textValue((item.activePpm?.task || '')).toLowerCase().includes(q);

        if (!matchesId && !matchesBrand && !matchesModel && !matchesType && !matchesTech && !matchesTask) {
          return false;
        }
      }

      return true;
    });
  }, [machinesWithPpm, activeTab, selectedLine, selectedCategory, searchQuery]);

  // Unique lines
  const availableLines = useMemo(() => {
    const set = new Set<string>();
    scopedMachines.forEach((m) => {
      if (m.currentLine) set.add(m.currentLine);
      else if (m.area) set.add(m.area);
    });
    return Array.from(set).sort();
  }, [scopedMachines]);

  // KPI Metrics
  const stats = useMemo(() => {
    const total = machinesWithPpm.length;
    const scheduled = machinesWithPpm.filter((m) => m.activePpm && m.activePpm.status !== 'COMPLETED').length;
    const overdue = machinesWithPpm.filter((m) => m.ppmStatusCategory === 'OVERDUE').length;
    const dueSoon = machinesWithPpm.filter((m) => m.ppmStatusCategory === 'DUE_SOON').length;
    const completed = scopedPpm.filter((p) => p.status === 'COMPLETED').length;
    const unscheduled = total - scheduled;

    return { total, scheduled, overdue, dueSoon, completed, unscheduled };
  }, [machinesWithPpm, scopedPpm]);

  // Open Schedule Modal for a single machine
  const handleOpenScheduleModal = (machine: Machine, existingPpm?: PPMSchedule | null) => {
    setSelectedMachineForSchedule(machine);
    if (existingPpm) {
      setTaskName(existingPpm.task || 'Routine Preventative Maintenance');
      setFrequency(existingPpm.frequency || 'Monthly');
      setIntervalDays(existingPpm.intervalDays || 30);
      setNextDueDate(existingPpm.nextDue || toDateKey(new Date()));
      setAssignedTechnician(existingPpm.assignedTo || '');
    } else {
      const isOverlock = textValue((machine.type || '')).toUpperCase().includes('OVERLOCK');
      const defaultTask = isOverlock
        ? 'Overlock Looper Clearance & Oil Circulator Overhaul'
        : `${machine.brand || 'Machinery'} Routine Preventive Maintenance & Calibration`;
      setTaskName(defaultTask);
      setFrequency('Monthly');
      setIntervalDays(30);
      const d = new Date();
      d.setDate(d.getDate() + 30);
      setNextDueDate(toDateKey(d));
      setAssignedTechnician('');
    }
    setIsScheduleModalOpen(true);
  };

  // Submit Single Schedule
  const handleSubmitSingleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMachineForSchedule) return;
    setIsSubmittingSchedule(true);

    try {
      const newPpm: PPMSchedule = {
        id: `PPM-${selectedMachineForSchedule.id}-${Date.now().toString().slice(-4)}`,
        machineId: selectedMachineForSchedule.id,
        unit: selectedMachineForSchedule.unit || selectedUnit,
        task: taskName.trim() || 'Preventative Maintenance Routine',
        intervalDays,
        frequency,
        lastServiced: toDateKey(new Date()),
        nextDue: nextDueDate,
        status: 'PENDING',
        assignedTo: assignedTechnician.trim() || undefined,
        assignedBy: user?.name || 'PPM Superintendent',
      };

      await createPPMSchedule(newPpm);
      showToast(`⚡ PPM successfully scheduled for machine ${selectedMachineForSchedule.id}! Due: ${nextDueDate}`, 'success');
      setIsScheduleModalOpen(false);
      setSelectedMachineForSchedule(null);
    } catch (err) {
      console.error(err);
      showToast('Failed to schedule PPM', 'error');
    } finally {
      setIsSubmittingSchedule(false);
    }
  };

  // Submit Bulk Schedule for Every Machine
  const handleSubmitBulkSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (filteredMachines.length === 0) {
      showToast('No machines found matching the active filters to schedule.', 'warning');
      return;
    }
    setIsSubmittingBulk(true);

    try {
      let createdCount = 0;
      for (const item of filteredMachines) {
        const m = item.machine;
        const newPpm: PPMSchedule = {
          id: `PPM-${m.id}-${Date.now().toString().slice(-4)}`,
          machineId: m.id,
          unit: m.unit || selectedUnit,
          task: bulkTaskName.trim() || `${bulkFrequency} Plant Preventative Maintenance`,
          intervalDays: bulkIntervalDays,
          frequency: bulkFrequency,
          lastServiced: toDateKey(new Date()),
          nextDue: bulkStartDate,
          status: 'PENDING',
          assignedTo: bulkAssignedTechnician.trim() || undefined,
          assignedBy: user?.name || 'PPM Superintendent',
        };
        await createPPMSchedule(newPpm);
        createdCount++;
      }

      showToast(`🎉 Bulk PPM successfully generated for ${createdCount} machines! Target Due: ${bulkStartDate}`, 'success');
      setIsBulkModalOpen(false);
    } catch (err) {
      console.error(err);
      showToast('Failed to complete bulk PPM generation', 'error');
    } finally {
      setIsSubmittingBulk(false);
    }
  };

  // Open Complete Modal
  const handleOpenCompleteModal = (ppm: PPMSchedule) => {
    setSelectedPpmForComplete(ppm);
    setCompletionNotes(ppm.technicianNotes || '');
    setCompletionDuration(ppm.actualDurationMinutes || 30);
    setCompletionProofImg(ppm.completionProofImage || null);
    setIsCompleteModalOpen(true);
  };

  // Submit Complete PPM
  const handleSubmitCompletePPM = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPpmForComplete) return;
    setIsSubmittingComplete(true);

    try {
      await completePPMTask(
        selectedPpmForComplete.id,
        user?.name || selectedPpmForComplete.assignedTo || 'Technician',
        completionProofImg || undefined,
        completionDuration,
        completionNotes.trim() || 'Routine inspection completed with photo verification.'
      );
      showToast(`✅ PPM Work Order ${selectedPpmForComplete.id} signed off as COMPLETED!`, 'success');
      setIsCompleteModalOpen(false);
      setSelectedPpmForComplete(null);
    } catch (err) {
      console.error(err);
      showToast('Failed to complete PPM', 'error');
    } finally {
      setIsSubmittingComplete(false);
    }
  };

  // Handle Photo proof file upload
  const handleProofFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file (JPG, PNG, WebP)', 'warning');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setCompletionProofImg(result);
      showToast('Photo proof attached successfully!', 'success');
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 p-6 md:p-8 space-y-6">
      {/* ─── 1. TOP HEADER & FACILITY UNIT CONTROLS ───────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-amber-400 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <span>PPM Scheduler &amp; Preventive Overhaul</span>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
                  Fleet Maintenance
                </span>
              </h1>
              <p className="text-xs text-slate-500">
                Schedule, assign, and track scheduled preventive maintenance routines for every plant machinery asset across UNIT - 1 &amp; UNIT-2
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls & Unit Filter */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Facility Unit Tabs */}
          {isAdmin && (
            <div className="inline-flex p-1 bg-slate-100 rounded-2xl border border-slate-200 text-xs font-bold">
              {['ALL', 'UNIT - 1', 'UNIT-2'].map((u) => (
                <button
                  key={u}
                  onClick={() => setSelectedUnit(u)}
                  className={`px-3 py-1.5 rounded-xl transition cursor-pointer ${
                    selectedUnit === u
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {u === 'ALL' ? 'All Units' : u}
                </button>
              ))}
            </div>
          )}

          {/* Schedule PPM for Every Machine Button (Bulk) */}
          <button
            onClick={() => setIsBulkModalOpen(true)}
            className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/25 transition cursor-pointer flex items-center gap-2"
            title="Schedule PPM for every machine in current view"
          >
            <Sparkles className="w-4 h-4 text-amber-300" />
            <span>Schedule PPM for Every Machine ({filteredMachines.length})</span>
          </button>
        </div>
      </div>

      {/* ─── 2. KPI SUMMARY METRICS ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Assets */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Machinery</div>
          <div className="text-2xl font-black text-slate-900 font-mono">{stats.total}</div>
          <div className="text-[11px] text-slate-500 font-medium">{selectedUnit === 'ALL' ? 'Entire Plant Fleet' : selectedUnit}</div>
        </div>

        {/* Active Scheduled */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">Active Scheduled</div>
          <div className="text-2xl font-black text-indigo-600 font-mono">{stats.scheduled}</div>
          <div className="text-[11px] text-slate-500 font-medium">Under active routine</div>
        </div>

        {/* Overdue */}
        <div className="bg-rose-50/70 p-4 rounded-2xl border border-rose-200 shadow-2xs space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-rose-700">Overdue Overhauls</div>
          <div className="text-2xl font-black text-rose-700 font-mono">{stats.overdue}</div>
          <div className="text-[11px] text-rose-600 font-medium">Requires immediate action</div>
        </div>

        {/* Due Soon */}
        <div className="bg-amber-50/70 p-4 rounded-2xl border border-amber-200 shadow-2xs space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Due in 7 Days</div>
          <div className="text-2xl font-black text-amber-700 font-mono">{stats.dueSoon}</div>
          <div className="text-[11px] text-amber-700 font-medium">Upcoming preventive tasks</div>
        </div>

        {/* Completed */}
        <div className="bg-emerald-50/70 p-4 rounded-2xl border border-emerald-200 shadow-2xs space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Completed PPMs</div>
          <div className="text-2xl font-black text-emerald-700 font-mono">{stats.completed}</div>
          <div className="text-[11px] text-emerald-700 font-medium">Serviced with photo proof</div>
        </div>

        {/* Unscheduled */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Needs Scheduling</div>
          <div className="text-2xl font-black text-slate-700 font-mono">{stats.unscheduled}</div>
          <div className="text-[11px] text-slate-400 font-medium">Zero pending schedules</div>
        </div>
      </div>

      {/* ─── 3. FILTER TABS & SEARCH CONTROLS ───────────────────────────── */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Status Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 flex-1">
          {[
            { id: 'ALL', label: `All Machines (${stats.total})` },
            { id: 'ACTIVE', label: `Scheduled (${stats.scheduled})` },
            { id: 'OVERDUE', label: `Overdue (${stats.overdue})`, isRed: stats.overdue > 0 },
            { id: 'DUE_SOON', label: `Due Soon (${stats.dueSoon})`, isAmber: stats.dueSoon > 0 },
            { id: 'COMPLETED', label: `Completed (${stats.completed})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${
                activeTab === tab.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : tab.isRed
                  ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                  : tab.isAmber
                  ? 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filters & Search */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search M/C ID, model, tech..."
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Line Filter */}
          <select
            value={selectedLine}
            onChange={(e) => setSelectedLine(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 outline-none cursor-pointer"
          >
            <option value="ALL">All Lines</option>
            {availableLines.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>

          {/* View Toggle */}
          <div className="flex items-center p-0.5 bg-slate-100 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode('GRID')}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                viewMode === 'GRID' ? 'bg-white shadow-2xs text-indigo-600' : 'text-slate-400 hover:text-slate-700'
              }`}
              title="Grid Cards View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('TABLE')}
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                viewMode === 'TABLE' ? 'bg-white shadow-2xs text-indigo-600' : 'text-slate-400 hover:text-slate-700'
              }`}
              title="Table View"
            >
              <ListFilter className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ─── 4. MACHINERY FLEET DISPLAY (GRID OR TABLE) ───────────────── */}
      {viewMode === 'GRID' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredMachines.map(({ machine, activePpm, ppmStatusCategory, diffDays }) => {
            const isOverdue = ppmStatusCategory === 'OVERDUE';
            const isDueSoon = ppmStatusCategory === 'DUE_SOON';
            const isCompleted = ppmStatusCategory === 'COMPLETED';
            const hasActivePpm = activePpm && activePpm.status !== 'COMPLETED';

            return (
              <div
                key={machine.id}
                className={`bg-white rounded-2xl border transition-all duration-200 p-4 flex flex-col justify-between gap-3 shadow-2xs hover:shadow-md ${
                  isOverdue
                    ? 'border-rose-300 hover:border-rose-400'
                    : isDueSoon
                    ? 'border-amber-300 hover:border-amber-400'
                    : 'border-slate-200 hover:border-indigo-300'
                }`}
              >
                {/* Top: Machine ID & Category Visual */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-slate-800 text-xs border border-slate-200">
                        <Wrench className="w-4 h-4 text-indigo-600" />
                      </div>
                      <div>
                        <span className="font-mono font-black text-slate-900 text-sm block leading-tight">
                          {machine.id}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {machine.unit || 'UNIT - 1'}
                        </span>
                      </div>
                    </div>

                    {/* Status Pill */}
                    {isOverdue ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">
                        Overdue by {Math.abs(diffDays)}d
                      </span>
                    ) : isDueSoon ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                        Due in {diffDays}d
                      </span>
                    ) : hasActivePpm ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {activePpm.frequency} PPM
                      </span>
                    ) : isCompleted ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Completed
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                        No Schedule
                      </span>
                    )}
                  </div>

                  {/* Machine Specs & Location */}
                  <div>
                    <div className="text-xs font-bold text-slate-900 truncate">
                      {machine.brand} {machine.model}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {machine.typeName || machine.type || 'Apparel Sewing Machine'}
                    </div>
                  </div>

                  <div className="text-[11px] text-slate-400 flex items-center gap-2 pt-1 border-t border-slate-100">
                    <span>Line: <strong className="text-slate-700">{machine.currentLine || machine.area || 'Line 01'}</strong></span>
                    <span>•</span>
                    <span>Station: <strong className="text-slate-700">{machine.stationNo || 'Station 01'}</strong></span>
                  </div>

                  {/* Active PPM Details Card */}
                  {hasActivePpm && (
                    <div className={`p-2.5 rounded-xl border text-xs space-y-1 ${
                      isOverdue
                        ? 'bg-rose-50/60 border-rose-200 text-rose-950'
                        : isDueSoon
                        ? 'bg-amber-50/60 border-amber-200 text-amber-950'
                        : 'bg-slate-50 border-slate-200 text-slate-900'
                    }`}>
                      <div className="font-semibold text-[11px] line-clamp-1">
                        📋 {activePpm.task}
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                        <span>Due: <b className="text-slate-800">{activePpm.nextDue}</b></span>
                        <span>Tech: <b className="text-indigo-600">{activePpm.assignedTo || 'Unassigned'}</b></span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Bottom Actions */}
                <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenScheduleModal(machine, activePpm)}
                    className="flex-1 py-1.5 px-3 rounded-xl text-xs font-bold bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{hasActivePpm ? 'Update PPM' : 'Schedule PPM'}</span>
                  </button>

                  {hasActivePpm && (
                    <button
                      type="button"
                      onClick={() => handleOpenCompleteModal(activePpm)}
                      className="py-1.5 px-3 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition cursor-pointer flex items-center justify-center gap-1"
                      title="Inspect & Sign Off Completed PPM"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Sign Off</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Machine ID</th>
                  <th className="py-3 px-4">Brand / Model</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">PPM Status</th>
                  <th className="py-3 px-4">Scheduled Task</th>
                  <th className="py-3 px-4">Next Due Date</th>
                  <th className="py-3 px-4">Assigned Tech</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredMachines.map(({ machine, activePpm, ppmStatusCategory, diffDays }) => {
                  const isOverdue = ppmStatusCategory === 'OVERDUE';
                  const isDueSoon = ppmStatusCategory === 'DUE_SOON';
                  const hasActivePpm = activePpm && activePpm.status !== 'COMPLETED';

                  return (
                    <tr key={machine.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">
                        {machine.id}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900">
                        {machine.brand} {machine.model}
                      </td>
                      <td className="py-3 px-4 text-slate-500 truncate max-w-[150px]">
                        {machine.typeName || machine.type}
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {machine.currentLine || machine.area} • {machine.stationNo}
                      </td>
                      <td className="py-3 px-4">
                        {isOverdue ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                            Overdue {Math.abs(diffDays)}d
                          </span>
                        ) : isDueSoon ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            Due in {diffDays}d
                          </span>
                        ) : hasActivePpm ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            Scheduled
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-400">
                            None
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800 max-w-[200px] truncate">
                        {activePpm?.task || '—'}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">
                        {activePpm?.nextDue || '—'}
                      </td>
                      <td className="py-3 px-4 font-semibold text-indigo-600">
                        {activePpm?.assignedTo || 'Unassigned'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenScheduleModal(machine, activePpm)}
                            className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
                          >
                            Schedule
                          </button>
                          {hasActivePpm && (
                            <button
                              type="button"
                              onClick={() => handleOpenCompleteModal(activePpm)}
                              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition cursor-pointer"
                            >
                              Sign Off
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── MODAL 1: SCHEDULE PPM FOR SINGLE MACHINE ─────────────────── */}
      {isScheduleModalOpen && selectedMachineForSchedule && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md">
                  <CalendarCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Schedule Preventive Maintenance (PPM)</h3>
                  <p className="text-[11px] text-slate-400">
                    Machine {selectedMachineForSchedule.id} • {selectedMachineForSchedule.brand} {selectedMachineForSchedule.model}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsScheduleModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitSingleSchedule} className="p-5 space-y-4 text-xs">
              {/* Routine Task Description */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 uppercase tracking-wider block">
                  PPM Overhaul Task Description *
                </label>
                <input
                  type="text"
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                  required
                  placeholder="e.g. Monthly Looper &amp; Rotary Hook Timing Overhaul"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Frequency & Interval */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 uppercase tracking-wider block">
                    Frequency *
                  </label>
                  <select
                    value={frequency}
                    onChange={(e) => {
                      const f = e.target.value as PPMFrequency;
                      setFrequency(f);
                      const days = f === 'Weekly' ? 7 : f === 'Monthly' ? 30 : 180;
                      setIntervalDays(days);
                      const d = new Date();
                      d.setDate(d.getDate() + days);
                      setNextDueDate(toDateKey(d));
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-800 outline-none cursor-pointer"
                  >
                    <option value="Weekly">Weekly Routine (7 Days)</option>
                    <option value="Monthly">Monthly Overhaul (30 Days)</option>
                    <option value="6-Month">6-Month Deep Service (180 Days)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 uppercase tracking-wider block">
                    Next Due Date *
                  </label>
                  <input
                    type="date"
                    value={nextDueDate}
                    onChange={(e) => setNextDueDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-800 outline-none"
                  >
                  </input>
                </div>
              </div>

              {/* Assign to Technician across All Units */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-700 uppercase tracking-wider block">
                    Assign In-Charge Technician (All Units)
                  </label>
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                    {techUsers.length} available
                  </span>
                </div>
                <select
                  value={assignedTechnician}
                  onChange={(e) => setAssignedTechnician(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-800 outline-none cursor-pointer"
                >
                  <option value="">-- Select In-Charge Technician (All Units) --</option>
                  {Object.entries(groupedTechnicians).map(([unitGroup, techs]) => (
                    <optgroup key={unitGroup} label={`📍 ${unitGroup}`}>
                      {techs.map((t: any) => (
                        <option key={t.uid || t.id || t.name} value={t.name}>
                          {t.name} ({t.role || 'Mechanic'}) • {t.unit || unitGroup}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {/* Actions */}
              <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsScheduleModalOpen(false)}
                  className="px-4 py-2 rounded-xl font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSchedule}
                  className="px-5 py-2.5 rounded-xl font-bold bg-amber-500 hover:bg-amber-600 text-white transition shadow-lg shadow-amber-500/25 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <CalendarCheck className="w-4 h-4" />
                  <span>{isSubmittingSchedule ? 'Scheduling...' : 'Confirm PPM Schedule'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: BULK SCHEDULE PPM FOR EVERY MACHINE ───────────────── */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center shadow-md">
                  <Sparkles className="w-5 h-5 text-amber-300" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Schedule PPM for Every Machine</h3>
                  <p className="text-[11px] text-indigo-200">
                    Auto-generate preventive schedules for {filteredMachines.length} machinery assets in current view
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBulkModalOpen(false)}
                className="p-1.5 text-indigo-200 hover:text-white rounded-xl hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitBulkSchedule} className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-2xl text-indigo-950 font-medium">
                This will automatically attach a new preventative maintenance work order to all <b>{filteredMachines.length} filtered machines</b> ({selectedUnit === 'ALL' ? 'All Units' : selectedUnit}).
              </div>

              {/* Bulk Task Name */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 uppercase tracking-wider block">
                  Routine Title *
                </label>
                <input
                  type="text"
                  value={bulkTaskName}
                  onChange={(e) => setBulkTaskName(e.target.value)}
                  required
                  placeholder="e.g. Monthly Machinery Lubrication &amp; Mechanical Timing Inspection"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Bulk Frequency & Start Date */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 uppercase tracking-wider block">
                    Frequency *
                  </label>
                  <select
                    value={bulkFrequency}
                    onChange={(e) => {
                      const f = e.target.value as PPMFrequency;
                      setBulkFrequency(f);
                      const days = f === 'Weekly' ? 7 : f === 'Monthly' ? 30 : 180;
                      setBulkIntervalDays(days);
                      const d = new Date();
                      d.setDate(d.getDate() + days);
                      setBulkStartDate(toDateKey(d));
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-800 outline-none cursor-pointer"
                  >
                    <option value="Weekly">Weekly Routine (7 Days)</option>
                    <option value="Monthly">Monthly Overhaul (30 Days)</option>
                    <option value="6-Month">6-Month Deep Service (180 Days)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700 uppercase tracking-wider block">
                    Initial Target Due Date *
                  </label>
                  <input
                    type="date"
                    value={bulkStartDate}
                    onChange={(e) => setBulkStartDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-800 outline-none"
                  >
                  </input>
                </div>
              </div>

              {/* Bulk Assign Technician */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 uppercase tracking-wider block">
                  Default Lead Technician (Optional)
                </label>
                <select
                  value={bulkAssignedTechnician}
                  onChange={(e) => setBulkAssignedTechnician(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-800 outline-none cursor-pointer"
                >
                  <option value="">-- Leave Unassigned / Floor Dispatch Later --</option>
                  {Object.entries(groupedTechnicians).map(([unitGroup, techs]) => (
                    <optgroup key={unitGroup} label={`📍 ${unitGroup}`}>
                      {techs.map((t: any) => (
                        <option key={t.uid || t.id || t.name} value={t.name}>
                          {t.name} ({t.role || 'Mechanic'}) • {t.unit || unitGroup}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {/* Actions */}
              <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsBulkModalOpen(false)}
                  className="px-4 py-2 rounded-xl font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingBulk || filteredMachines.length === 0}
                  className="px-5 py-2.5 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-lg shadow-indigo-600/25 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>{isSubmittingBulk ? 'Generating Schedules...' : `Generate PPM for All (${filteredMachines.length})`}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 3: COMPLETE PPM WORK ORDER WITH PROOF ──────────────── */}
      {isCompleteModalOpen && selectedPpmForComplete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="bg-emerald-950 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-md">
                  <CheckCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Complete &amp; Sign Off PPM Routine</h3>
                  <p className="text-[11px] text-emerald-300 font-mono">
                    {selectedPpmForComplete.id} • Machine {selectedPpmForComplete.machineId}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCompleteModalOpen(false)}
                className="p-1.5 text-emerald-300 hover:text-white rounded-xl hover:bg-white/10 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitCompletePPM} className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                <div className="font-bold text-slate-800">
                  {selectedPpmForComplete.task}
                </div>
                <div className="text-[11px] text-slate-500 flex items-center justify-between">
                  <span>Frequency: {selectedPpmForComplete.frequency}</span>
                  <span>Target Due: {selectedPpmForComplete.nextDue}</span>
                </div>
              </div>

              {/* Duration in Minutes */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 uppercase tracking-wider block">
                  Work Duration (Minutes) *
                </label>
                <input
                  type="number"
                  min="5"
                  max="480"
                  value={completionDuration}
                  onChange={(e) => setCompletionDuration(parseInt(e.target.value) || 30)}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold font-mono text-slate-800 outline-none"
                />
              </div>

              {/* Photo Proof Upload */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 uppercase tracking-wider block">
                  Inspection / Overhaul Photo Proof
                </label>
                <div className="flex items-center gap-3">
                  <label className="flex-1 py-2.5 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-300 border-dashed rounded-xl cursor-pointer text-center text-slate-600 transition flex items-center justify-center gap-2">
                    <Camera className="w-4 h-4 text-slate-500" />
                    <span>Upload Machine Proof Image</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleProofFileChange}
                      className="hidden"
                    />
                  </label>
                  {completionProofImg && (
                    <div className="w-12 h-12 rounded-xl overflow-hidden border border-slate-200 shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={completionProofImg}
                        alt="Proof"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Technician Service Notes */}
              <div className="space-y-1">
                <label className="font-bold text-slate-700 uppercase tracking-wider block">
                  Technician Service Notes
                </label>
                <textarea
                  rows={3}
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  placeholder="e.g. Cleaned needle plate lint, flushed oil sump, adjusted looper timing..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              {/* Actions */}
              <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCompleteModalOpen(false)}
                  className="px-4 py-2 rounded-xl font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingComplete}
                  className="px-5 py-2.5 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-lg shadow-emerald-600/25 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                  <CheckCheck className="w-4 h-4" />
                  <span>{isSubmittingComplete ? 'Signing Off...' : 'Complete & Sign Off'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
