'use client';

import { textValue } from '@/lib/textValue';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Wrench,
  ShieldAlert,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Users,
  Flame,
  CalendarCheck,
  ArrowRight,
  Search,
  Filter,
  Plus,
  RefreshCw,
  Layers,
  ExternalLink,
  UserCheck,
  Timer,
  ChevronRight,
  Phone,
  Boxes,
  FileText,
  Check,
  CheckCheck,
  X,
  Sparkles,
  Zap,
  TrendingUp,
  Cpu,
  BadgeAlert,
  ArrowUpRight,
  Radio,
  SlidersHorizontal,
  ClipboardList,
  XCircle,
  Package,
  Play,
  Pause,
} from 'lucide-react';
import {
  Machine,
  RepairTicket,
  PPMSchedule,
  SparePart,
  PartRequisition,
  RepairUrgency,
} from '@/types/cmms';
import { FACTORY_MECHANICS_ROSTER, MechanicDuty, userToMechanicDuty } from '@/lib/constants/mechanics';
import {
  createBreakdownTicket,
  assignRepairTicket,
  resolveRepairTicket,
  completePPMTask,
  rejectRepairTicket,
  startRepairTicket,
  stopRepairTicket,
} from '@/lib/services/cmmsService';
import { filterSparesForMachine } from '@/lib/utils/spareMapping';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { matchesUnit } from '@/lib/constants/units';
import { WidgetDrilldownDrawer, DrillDownType, DrillDownMeta } from './WidgetDrilldownDrawer';
import { MaintenanceMilestonesAndTasks } from './MaintenanceMilestonesAndTasks';
import { LineAvailabilityWidget } from './LineAvailabilityWidget';

interface SeniorMechanicDashboardProps {
  machines: Machine[];
  repairs: RepairTicket[];
  ppmSchedules: PPMSchedule[];
  parts: SparePart[];
  requisitions: PartRequisition[];
  lastRefresh: Date;
  onRefresh: () => void;
  isLoading?: boolean;
}

function getActiveRepairMinutes(ticket: RepairTicket) {
  if (ticket.status !== 'IN_PROGRESS') return 0;
  const startMs = new Date(ticket.startedAt || ticket.reportedAt).getTime();
  return Number.isFinite(startMs)
    ? Math.max(0, Math.round((Date.now() - startMs) / 60000))
    : 0;
}

const CUSTOM_SPARE_PART_ID = '__CUSTOM_SPARE__';

export function SeniorMechanicDashboard({
  machines,
  repairs,
  ppmSchedules,
  parts,
  requisitions,
  lastRefresh,
  onRefresh,
  isLoading = false,
}: SeniorMechanicDashboardProps) {
  const router = useRouter();
  const { user, role } = useAuth();
  const { showToast } = useToast();
  const companySlug = textValue((user?.companySlug || 'esstee')).toLowerCase();

  const isElectrician = role === 'SENIOR_ELECTRICIAN';
  const tradeFilter = isElectrician ? 'ELECTRICIAN' : 'MECHANIC';

  // UI state
  const [ticketSearch, setTicketSearch] = useState('');
  const [ticketFilter, setTicketFilter] = useState<'ALL' | 'CRITICAL' | 'IN_PROGRESS' | 'UNASSIGNED' | 'COMPLETED'>('ALL');
  const [lineFilter, setLineFilter] = useState<string>('ALL');
  const [rosterTradeFilter, setRosterTradeFilter] = useState<'ALL' | 'MECHANIC' | 'ELECTRICIAN'>(
    isElectrician ? 'ELECTRICIAN' : 'ALL'
  );

  // Modals
  const [isNewTicketModalOpen, setIsNewTicketModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedTicketForAssign, setSelectedTicketForAssign] = useState<RepairTicket | null>(null);
  const [selectedTicketToResolve, setSelectedTicketToResolve] = useState<RepairTicket | null>(null);
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const [isSubmittingResolve, setIsSubmittingResolve] = useState(false);
  const [resolveDowntimeMinutes, setResolveDowntimeMinutes] = useState(1);
  const [resolveIssuesIdentified, setResolveIssuesIdentified] = useState('');
  const [resolveActionTaken, setResolveActionTaken] = useState('');
  const [isSpareModalOpen, setIsSpareModalOpen] = useState(false);
  const [ticketToStart, setTicketToStart] = useState<RepairTicket | null>(null);
  const [startSpareParts, setStartSpareParts] = useState<
    { partId: string; qty: number; customName: string }[]
  >([]);
  const [startShowAllSpares, setStartShowAllSpares] = useState(false);
  const [isStartingWork, setIsStartingWork] = useState(false);
  const [stoppingTicketId, setStoppingTicketId] = useState<string | null>(null);

  // Form state for New Breakdown Ticket
  const [newMachineId, setNewMachineId] = useState('');
  const [newFaultCategory, setNewFaultCategory] = useState('Skipping Stitches');
  const [newFaultDetails, setNewFaultDetails] = useState('');
  const [newUrgency, setNewUrgency] = useState<RepairUrgency>('CRITICAL');
  const [newAssignee, setNewAssignee] = useState('');
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);

  // Form state for Second Problem on Same Machine
  const [hasSecondProblem, setHasSecondProblem] = useState(false);
  const [secondFaultCategory, setSecondFaultCategory] = useState('Motor Electrical Noise');
  const [secondFaultDetails, setSecondFaultDetails] = useState('');
  const [secondUrgency, setSecondUrgency] = useState<RepairUrgency>('WARNING');
  const [secondAssignee, setSecondAssignee] = useState('');

  // Form state for Quick Assign
  const [assigneeName, setAssigneeName] = useState('');
  const [isSubmittingAssign, setIsSubmittingAssign] = useState(false);

  const ticketToStartMachine = useMemo(
    () => machines.find((machine) => machine.id === ticketToStart?.machineId) || null,
    [machines, ticketToStart]
  );
  const startCompatibleSpares = useMemo(() => {
    if (!ticketToStart || startShowAllSpares) return parts;
    return filterSparesForMachine(
      parts,
      ticketToStartMachine || ticketToStart.machineType || ticketToStart.machineId
    );
  }, [parts, startShowAllSpares, ticketToStart, ticketToStartMachine]);

  // Widget Drilldown Drawer State
  const [drillDownState, setDrillDownState] = useState<{
    isOpen: boolean;
    type: DrillDownType | null;
    title?: string;
    meta?: DrillDownMeta;
  }>({
    isOpen: false,
    type: null,
  });

  const openDrillDown = (type: DrillDownType, title?: string, meta?: DrillDownMeta) => {
    setDrillDownState({
      isOpen: true,
      type,
      title,
      meta,
    });
  };

  const closeDrillDown = () => {
    setDrillDownState((prev) => ({ ...prev, isOpen: false }));
  };

  const [registeredTechs, setRegisteredTechs] = useState<MechanicDuty[]>([]);

  useEffect(() => {
    fetch('/api/users')
      .then((r) => r.json())
      .then((data) => {
        if (data.users && Array.isArray(data.users)) {
          const techs = data.users.filter((u: any) =>
            ['MECHANIC', 'SENIOR_MECHANIC', 'ELECTRICIAN', 'SENIOR_ELECTRICIAN'].includes(u.role)
          );
          if (techs.length > 0) {
            setRegisteredTechs(techs.map(userToMechanicDuty));
          }
        }
      })
      .catch(() => {});
  }, []);

  const activeStaffRoster = registeredTechs.length > 0 ? registeredTechs : FACTORY_MECHANICS_ROSTER;

  // Floor technicians available for task dispatch (supervisor assigns floor technicians, NEVER himself)
  const assignableTechnicians = useMemo(() => {
    const currentName = textValue((user?.name || '')).trim().toLowerCase();
    return activeStaffRoster.filter((m) => {
      const lower = textValue(m.role).toLowerCase();
      const mName = textValue(m.name).trim().toLowerCase();
      const isSelf = currentName && (mName === currentName || mName.includes(currentName) || currentName.includes(mName));
      const isSeniorOrAdmin =
        lower.includes('senior') ||
        lower.includes('admin') ||
        lower.includes('supervisor') ||
        lower.includes('director') ||
        lower.includes('manager');
      return !isSelf && !isSeniorOrAdmin;
    });
  }, [activeStaffRoster, user?.name]);
  const roster = useMemo(() => {
    return activeStaffRoster.filter((m) => {
      if (rosterTradeFilter === 'ALL') return true;
      return m.trade === rosterTradeFilter;
    });
  }, [activeStaffRoster, rosterTradeFilter]);

  // ─── Active Floor Breakdowns ──────────────────────────────────────────
  const activeBreakdowns = useMemo(() => {
    return machines.filter((m) => m.status === 'BREAKDOWN' || m.status === 'UNDER_MAINTENANCE');
  }, [machines]);

  // ─── Derived Metrics ──────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const openTickets = repairs.filter((r) => r.status !== 'COMPLETED');
    const criticalTickets = openTickets.filter((r) => r.urgency === 'CRITICAL');
    const inProgressTickets = openTickets.filter((r) => r.status === 'IN_PROGRESS');
    const unassignedTickets = openTickets.filter((r) => !r.attendedBy);

    const completed = repairs.filter((r) => r.status === 'COMPLETED');
    const completedWithDowntime = completed.filter((r) => r.downtimeMinutes > 0);
    const avgMTTR =
      completedWithDowntime.length > 0
        ? Math.round(
            completedWithDowntime.reduce((s, r) => s + r.downtimeMinutes, 0) /
              completedWithDowntime.length
          )
        : 0;

    // SLA compliance (% of completed tickets under 60 mins)
    const onTime = completed.filter((r) => (r.downtimeMinutes || 0) <= 60).length;
    const slaRate = completed.length > 0 ? Math.round((onTime / completed.length) * 100) : 100;

    const ppmDueThisWeek = ppmSchedules.filter(
      (p) => p.status === 'DUE_SOON' || p.status === 'OVERDUE' || p.status === 'PENDING'
    );
    const ppmOverdue = ppmSchedules.filter((p) => p.status === 'OVERDUE');

    const onDutyMechanics = activeStaffRoster.filter((m) => m.status === 'ON_DUTY').length;

    // Assigned active tasks across mechanics
    const activeTasksCount = openTickets.filter((r) => !!r.attendedBy).length;

    return {
      openTicketsCount: openTickets.length,
      criticalCount: criticalTickets.length,
      inProgressCount: inProgressTickets.length,
      unassignedCount: unassignedTickets.length,
      breakdownsCount: activeBreakdowns.length,
      avgMTTR,
      slaRate,
      ppmDueCount: ppmDueThisWeek.length,
      ppmOverdueCount: ppmOverdue.length,
      onDutyMechanics,
      activeTasksCount,
    };
  }, [repairs, ppmSchedules, activeBreakdowns]);

  // ─── Filtered Tickets Table ───────────────────────────────────────────
  const filteredTickets = useMemo(() => {
    return repairs.filter((r) => {
      // Search
      const searchMatch =
        ticketSearch === '' ||
        textValue(r.id).toLowerCase().includes(ticketSearch.toLowerCase()) ||
        textValue(r.machineId).toLowerCase().includes(ticketSearch.toLowerCase()) ||
        textValue(r.line).toLowerCase().includes(ticketSearch.toLowerCase()) ||
        (r.attendedBy && textValue(r.attendedBy).toLowerCase().includes(ticketSearch.toLowerCase())) ||
        textValue(r.faultCategory).toLowerCase().includes(ticketSearch.toLowerCase());

      if (!searchMatch) return false;

      // Line filter
      if (lineFilter !== 'ALL' && r.line !== lineFilter) return false;

      // Status tab
      if (ticketFilter === 'CRITICAL') return r.urgency === 'CRITICAL' && r.status !== 'COMPLETED';
      if (ticketFilter === 'IN_PROGRESS') return r.status === 'IN_PROGRESS';
      if (ticketFilter === 'UNASSIGNED') return !r.attendedBy && r.status !== 'COMPLETED';
      if (ticketFilter === 'COMPLETED') return r.status === 'COMPLETED';

      // ALL: show open tickets first, then completed
      return true;
    });
  }, [repairs, ticketSearch, ticketFilter, lineFilter]);

  // Unique lines in repair records
  const availableLines = useMemo(() => {
    const set = new Set<string>();
    repairs.forEach((r) => {
      if (r.line) set.add(r.line);
    });
    machines.forEach((m) => {
      if (m.currentLine) set.add(m.currentLine);
    });
    return Array.from(set).sort();
  }, [repairs, machines]);

  // ─── Handle Create Breakdown Ticket ──────────────────────────────────
  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMachineId.trim()) {
      showToast('Please select or enter a Machine ID', 'warning');
      return;
    }

    const machine = machines.find((m) => m.id === newMachineId.trim());
    const line = machine?.currentLine || 'Line 01';
    const machineType = machine?.type || 'OVERLOCK_4_THREAD';

    setIsSubmittingTicket(true);
    try {
      const ticketId = await createBreakdownTicket({
        machineId: newMachineId.trim(),
        machineType,
        line,
        reportedAt: new Date().toISOString(),
        reportedBy: user?.name || 'Senior Mechanic',
        faultCategory: newFaultCategory,
        faultDetails: newFaultDetails || `Urgent floor breakdown reported by supervisor`,
        urgency: newUrgency,
        attendedBy: newAssignee || null,
        assignedBy: user?.name || 'Senior Mechanic',
      });

      let secondTicketId = '';
      if (hasSecondProblem) {
        secondTicketId = await createBreakdownTicket({
          machineId: newMachineId.trim(),
          machineType,
          line,
          reportedAt: new Date().toISOString(),
          reportedBy: user?.name || 'Senior Mechanic',
          faultCategory: secondFaultCategory,
          faultDetails: secondFaultDetails || `Secondary issue detected simultaneously on ${newMachineId.trim()}`,
          urgency: secondUrgency,
          attendedBy: secondAssignee || null,
          assignedBy: user?.name || 'Senior Mechanic',
        });
      }

      if (hasSecondProblem && secondTicketId) {
        showToast(
          `2 distinct tickets logged for ${newMachineId.trim()}: #${ticketId} (${newAssignee || 'Unassigned'}) & #${secondTicketId} (${secondAssignee || 'Unassigned'})!`,
          'success'
        );
      } else {
        showToast(`Breakdown Work Order ${ticketId} created! Machine set to BREAKDOWN.`, 'success');
      }

      setIsNewTicketModalOpen(false);
      setNewMachineId('');
      setNewFaultDetails('');
      setNewAssignee('');
      setHasSecondProblem(false);
      setSecondFaultDetails('');
      setSecondAssignee('');
      onRefresh();
    } catch {
      showToast('Failed to create ticket', 'error');
    } finally {
      setIsSubmittingTicket(false);
    }
  };

  // ─── Handle Assign Mechanic ──────────────────────────────────────────
  const handleAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicketForAssign || !assigneeName) {
      showToast('Please select a mechanic to assign', 'warning');
      return;
    }

    setIsSubmittingAssign(true);
    try {
      await assignRepairTicket(selectedTicketForAssign.id, assigneeName);
      showToast(`Work order ${selectedTicketForAssign.id} assigned to ${assigneeName}!`, 'success');
      setIsAssignModalOpen(false);
      setSelectedTicketForAssign(null);
      setAssigneeName('');
      onRefresh();
    } catch {
      showToast('Failed to assign ticket', 'error');
    } finally {
      setIsSubmittingAssign(false);
    }
  };

  const handleOpenResolve = (ticket: RepairTicket) => {
    setSelectedTicketToResolve(ticket);
    setResolveDowntimeMinutes(
      Math.max(1, (ticket.downtimeMinutes || 0) + getActiveRepairMinutes(ticket))
    );
    setResolveIssuesIdentified(ticket.issuesIdentified || ticket.faultDetails || '');
    setResolveActionTaken(ticket.actionTaken || '');
    setIsResolveModalOpen(true);
  };

  const handleStartRepair = async (ticket: RepairTicket) => {
    if (isStartingWork) return;
    if (ticket.downtimeMinutes > 0) {
      setIsStartingWork(true);
      try {
        await startRepairTicket(ticket.id, user?.name || 'Senior Mechanic');
        showToast(`Work resumed on ${ticket.id}. Previous work time retained.`, 'success');
        onRefresh();
      } catch {
        showToast('Failed to resume work order', 'error');
      } finally {
        setIsStartingWork(false);
      }
      return;
    }

    setTicketToStart(ticket);
    setStartSpareParts([{ partId: '', qty: 1, customName: '' }]);
    setStartShowAllSpares(false);
    setIsSpareModalOpen(true);
  };

  const handleConfirmStartWithSpares = async () => {
    if (!ticketToStart) return;
    const invalidCustomSpare = startSpareParts.some(
      (row) => row.partId === CUSTOM_SPARE_PART_ID && !row.customName.trim()
    );
    if (invalidCustomSpare) {
      showToast('Enter a name for each custom spare', 'warning');
      return;
    }

    setIsStartingWork(true);
    try {
      const validSpares = startSpareParts
        .filter((row) => row.partId && row.qty > 0)
        .map((row) => row.partId === CUSTOM_SPARE_PART_ID
          ? {
              partId: `CUSTOM:${row.customName.trim()}`,
              quantity: row.qty,
              name: row.customName.trim(),
              sku: 'CUSTOM',
            }
          : { partId: row.partId, quantity: row.qty });

      await startRepairTicket(ticketToStart.id, user?.name || 'Senior Mechanic', validSpares);
      const spareSummary = validSpares
        .map((spare) => {
          const part = parts.find((item) => item.partId === spare.partId);
          return `${'name' in spare ? spare.name : part?.name || spare.partId} × ${spare.quantity}`;
        })
        .join(', ');
      showToast(
        spareSummary
          ? `Work started on ${ticketToStart.id}. Spares recorded: ${spareSummary}`
          : `Work order ${ticketToStart.id} started. No spare parts used.`,
        'success'
      );
      setIsSpareModalOpen(false);
      setTicketToStart(null);
      onRefresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to start repair ticket';
      showToast(message, 'error');
      console.error('Failed to start repair ticket:', err);
    } finally {
      setIsStartingWork(false);
    }
  };

  const handleStopRepair = async (ticket: RepairTicket) => {
    if (stoppingTicketId) return;
    setStoppingTicketId(ticket.id);
    try {
      await stopRepairTicket(ticket.id);
      showToast(`Work stopped on ${ticket.id}. Downtime recorded.`, 'info');
      onRefresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to stop work order';
      showToast(message, 'error');
      console.error('Failed to stop work order:', err);
    } finally {
      setStoppingTicketId(null);
    }
  };

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicketToResolve) return;
    if (!resolveIssuesIdentified.trim() || !resolveActionTaken.trim()) {
      showToast('Please record the root cause and corrective action taken', 'warning');
      return;
    }

    setIsSubmittingResolve(true);
    try {
      await resolveRepairTicket(
        selectedTicketToResolve.id,
        resolveDowntimeMinutes,
        resolveActionTaken.trim(),
        user?.name || 'Senior Mechanic',
        (selectedTicketToResolve.partsUsed || []).map(({ partId, quantity, name, sku }) => ({
          partId,
          quantity,
          name,
          sku,
        })),
        {
          issuesIdentified: resolveIssuesIdentified.trim(),
          completedAt: new Date().toISOString(),
        }
      );
      showToast(`Work order ${selectedTicketToResolve.id} resolved successfully.`, 'success');
      setIsResolveModalOpen(false);
      setSelectedTicketToResolve(null);
      onRefresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to resolve work order';
      showToast(message, 'error');
      console.error('Failed to resolve work order:', err);
    } finally {
      setIsSubmittingResolve(false);
    }
  };

  // ─── Quick Complete PPM ──────────────────────────────────────────────
  const handleQuickCompletePPM = async (ppmId: string, machineId: string) => {
    try {
      await completePPMTask(ppmId, user?.name || 'Senior Mechanic');
      showToast(`PPM Inspection on ${machineId} marked completed!`, 'success');
      onRefresh();
    } catch {
      showToast('Failed to complete PPM task', 'error');
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* ─── 1. CLEAN COMPACT SUPERVISOR HEADER ──────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                {isElectrician ? 'Senior Electrical Supervisor' : 'Senior Mechanic Floor Operations'}
              </h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">
                <Radio className="w-2.5 h-2.5 animate-pulse text-indigo-600" />
                Floor Supervisor
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                Shift A
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Real-time floor dispatch, mechanic workload monitoring, breakdown intervention, and PPM execution oversight.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={() => setIsNewTicketModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Log Breakdown</span>
          </button>

          <button
            onClick={() => {
              const unassigned = repairs.find((r) => !r.attendedBy && r.status !== 'COMPLETED');
              if (unassigned) {
                setSelectedTicketForAssign(unassigned);
                setIsAssignModalOpen(true);
              } else {
                const queueEl = document.getElementById('floor-tickets-queue');
                if (queueEl) queueEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white transition shadow-xs cursor-pointer"
            title="Open Assign / Move Task Desk"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>⚡ Assign Task</span>
          </button>


          <button
            onClick={() => router.push(`/${companySlug}/dashboard/calendar`)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
          >
            <CalendarCheck className="w-3.5 h-3.5 text-indigo-600" />
            <span>Calendar</span>
          </button>

          <button
            onClick={() => router.push(`/${companySlug}/dashboard/inventory`)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
          >
            <Boxes className="w-3.5 h-3.5 text-amber-600" />
            <span>Group Indent</span>
          </button>

          <button
            onClick={onRefresh}
            disabled={isLoading}
            title="Refresh Floor Data"
            className="p-2 text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ─── 2. SUPERVISOR KPI METRIC CARDS ────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {/* Open Work Orders */}
        <div
          onClick={() => {
            setTicketFilter('ALL');
            const queueEl = document.getElementById('floor-tickets-queue');
            if (queueEl) {
              queueEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
              queueEl.classList.add('ring-2', 'ring-indigo-500');
              setTimeout(() => queueEl.classList.remove('ring-2', 'ring-indigo-500'), 1500);
            } else {
              openDrillDown('open_tickets', `Floor Active Tickets & Work Orders (${metrics.openTicketsCount})`);
            }
          }}
          className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm hover:shadow-md hover:border-indigo-400 transition cursor-pointer group"
          title="Click to view Active Tickets in Ticket Queue"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider group-hover:text-indigo-600 transition">Active Tickets</span>
            <span className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 group-hover:scale-110 transition">
              <Wrench className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 group-hover:text-indigo-600 transition">{metrics.openTicketsCount}</div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-rose-500"></span>
            <span>{metrics.criticalCount} Critical</span>
            <span className="text-slate-300">•</span>
            <span>{metrics.unassignedCount} unassigned</span>
          </div>
        </div>

        {/* Floor Breakdowns */}
        <div
          onClick={() => openDrillDown('breakdown_assets', `Live Floor Breakdown Halts (${metrics.breakdownsCount})`)}
          className={`rounded-2xl p-4 border shadow-sm hover:shadow-md hover:border-rose-400 transition cursor-pointer group ${
            metrics.breakdownsCount > 0
              ? 'bg-rose-50/70 border-rose-200 text-rose-950'
              : 'bg-white border-slate-200/80 text-slate-900'
          }`}
          title="Click to view Breakdown Assets in slide-over drawer"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider group-hover:text-rose-600 transition">Floor Breakdowns</span>
            <span
              className={`p-1.5 rounded-lg ${
                metrics.breakdownsCount > 0 ? 'bg-rose-500 text-white animate-pulse' : 'bg-slate-100 text-slate-600'
              }`}
            >
              <Flame className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black group-hover:text-rose-600 transition">{metrics.breakdownsCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            {metrics.breakdownsCount > 0 ? 'Machines halted right now' : 'All lines active'}
          </div>
        </div>

        {/* Avg Resolution MTTR */}
        <div
          onClick={() => openDrillDown('at_risk', `Floor Resolution MTTR & At-Risk Tickets (${metrics.avgMTTR}m avg)`)}
          className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm hover:shadow-md hover:border-blue-400 transition cursor-pointer group"
          title="Click to view MTTR & At-Risk tickets in slide-over drawer"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider group-hover:text-blue-600 transition">Avg Floor MTTR</span>
            <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600 group-hover:scale-110 transition">
              <Timer className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 group-hover:text-blue-600 transition">
            {metrics.avgMTTR} <span className="text-xs font-semibold text-slate-500">mins</span>
          </div>
          <div className="text-[11px] text-emerald-600 font-medium mt-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            <span>Target &lt; 45 mins</span>
          </div>
        </div>

        {/* Floor SLA Compliance */}
        <div
          onClick={() => openDrillDown('resolved', `Floor SLA Resolution Performance (${metrics.slaRate}%)`)}
          className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm hover:shadow-md hover:border-emerald-400 transition cursor-pointer group"
          title="Click to view Resolved Tickets & SLA compliance in slide-over drawer"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider group-hover:text-emerald-600 transition">SLA On-Track</span>
            <span className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 group-hover:scale-110 transition">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 group-hover:text-emerald-600 transition">{metrics.slaRate}%</div>
          <div className="text-[11px] text-slate-500 mt-1">Fixed within target SLA</div>
        </div>

        {/* PPM Due This Week */}
        <div
          onClick={() => openDrillDown('on_schedule', `Floor Preventive Maintenance Schedules (${metrics.ppmDueCount} Due)`)}
          className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm hover:shadow-md hover:border-amber-400 transition cursor-pointer group"
          title="Click to view PPM schedules in slide-over drawer"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider group-hover:text-amber-600 transition">PPM Due</span>
            <span className="p-1.5 rounded-lg bg-amber-50 text-amber-600 group-hover:scale-110 transition">
              <CalendarCheck className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 group-hover:text-amber-600 transition">{metrics.ppmDueCount}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            {metrics.ppmOverdueCount > 0 ? (
              <span className="text-rose-600 font-semibold">{metrics.ppmOverdueCount} Overdue</span>
            ) : (
              'All scheduled on time'
            )}
          </div>
        </div>

        {/* Active Duty Technicians */}
        <div
          onClick={() => openDrillDown('duty_roster', `Shift Floor Technicians & Mechanic Duty Roster (${metrics.onDutyMechanics} on duty)`)}
          className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm hover:shadow-md hover:border-cyan-400 transition cursor-pointer group"
          title="Click to view Technician Duty Roster in slide-over drawer"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider group-hover:text-cyan-600 transition">On-Duty Roster</span>
            <span className="p-1.5 rounded-lg bg-cyan-50 text-cyan-600 group-hover:scale-110 transition">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 group-hover:text-cyan-600 transition">{metrics.onDutyMechanics}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            <span className="text-indigo-600 font-semibold">{metrics.activeTasksCount} assigned</span>
            <span className="text-slate-400"> on active jobs</span>
          </div>
        </div>
      </div>

      {/* ─── 3. CRITICAL FLOOR BREAKDOWN EMERGENCY ALERT STRIP ────────── */}
      {activeBreakdowns.length > 0 ? (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 sm:p-5 shadow-sm max-h-[500px] flex flex-col">
          <div className="flex items-center justify-between mb-3 shrink-0">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-rose-600 text-white animate-pulse">
                <AlertTriangle className="w-4 h-4" />
              </span>
              <h3 className="text-sm font-bold text-rose-950 uppercase tracking-wider">
                Emergency Floor Halt: {activeBreakdowns.length} Machine{activeBreakdowns.length > 1 ? 's' : ''} in Breakdown
              </h3>
            </div>
            <span className="text-xs text-rose-700 font-medium">Requires immediate technician dispatch</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 flex-1 min-h-0 overflow-y-auto pr-1">
            {activeBreakdowns.map((mach) => {
              const activeTicket = repairs.find(
                (r) => r.machineId === mach.id && r.status !== 'COMPLETED'
              );

              return (
                <div
                  key={mach.id}
                  className="bg-white rounded-xl p-3.5 border border-rose-200 shadow-sm flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-xs font-extrabold text-slate-900 font-mono">{mach.id}</span>
                        <div className="text-[11px] text-slate-500 font-medium">
                          {mach.area || mach.currentLine || 'Line 01'} • {mach.stationNo || 'Station'} • {mach.type}
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-700 uppercase">
                        {mach.status}
                      </span>
                    </div>

                    <p className="text-xs text-slate-700 mt-2 line-clamp-2">
                      {activeTicket?.faultCategory ? (
                        <>
                          <span className="font-semibold text-slate-900">{activeTicket.faultCategory}: </span>
                          {activeTicket.faultDetails || 'Mechanical stoppage'}
                        </>
                      ) : (
                        `${mach.brand} ${mach.model} halted on line. Needs immediate inspection.`
                      )}
                    </p>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                    <div className="text-[11px] text-slate-500">
                      {activeTicket?.attendedBy ? (
                        <span className="text-indigo-600 font-semibold flex items-center gap-1">
                          <UserCheck className="w-3.5 h-3.5" />
                          {activeTicket.attendedBy}
                        </span>
                      ) : (
                        <span className="text-rose-600 font-bold">⚠️ Unassigned</span>
                      )}
                    </div>

                    {activeTicket ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await rejectRepairTicket(
                                activeTicket.id,
                                user?.name || 'Senior Mechanic',
                                'False alarm / operator cleared on floor'
                              );
                              showToast(`Breakdown #${activeTicket.id} rejected and machine restored to ACTIVE`, 'info');
                              onRefresh();
                            } catch {
                              showToast('Failed to reject breakdown ticket', 'error');
                            }
                          }}
                          className="px-2 py-1 text-xs font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg transition cursor-pointer flex items-center gap-1"
                          title="Reject false breakdown alarm"
                        >
                          <XCircle className="w-3 h-3 text-rose-600" />
                          <span>Reject</span>
                        </button>
                        <button
                          onClick={() => {
                            setSelectedTicketForAssign(activeTicket);
                            setIsAssignModalOpen(true);
                          }}
                          className="px-2.5 py-1 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition cursor-pointer"
                        >
                          {activeTicket.attendedBy ? 'Reassign' : 'Dispatch Now'}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setNewMachineId(mach.id);
                          setIsNewTicketModalOpen(true);
                        }}
                        className="px-2.5 py-1 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition cursor-pointer"
                      >
                        Create Ticket
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-2xl p-3.5 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="p-1 rounded-full bg-emerald-500 text-white">
              <Check className="w-3.5 h-3.5" />
            </span>
            <span className="text-xs font-semibold text-emerald-900">
              Floor Health Optimal • Zero active machine breakdown halts across all production lines.
            </span>
          </div>
          <span className="text-xs text-emerald-700 font-medium">All lines producing nominally</span>
        </div>
      )}


      {/* ─── 4. DELIVERY SCHEDULE, MY TASKS & ATTENDANCE TODAY (FOR SENIORS) ─── */}
      <MaintenanceMilestonesAndTasks
        repairs={repairs}
        ppmSchedules={ppmSchedules}
        machines={machines}
        userName={user?.name || (isElectrician ? 'Senior Electrician' : 'Senior Mechanic')}
        role={role || (isElectrician ? 'SENIOR_ELECTRICIAN' : 'SENIOR_MECHANIC')}
        compact={true}
        hideAttendance={true}
        onOpenResolve={handleOpenResolve}
        onStartRepair={handleStartRepair}
        onStopRepair={handleStopRepair}
        onReassignRepair={(t) => {
          setSelectedTicketForAssign(t);
          setIsAssignModalOpen(true);
        }}
        onCompletePPM={(ppmId, machineId) => handleQuickCompletePPM(ppmId, machineId)}
        onOpenCalendarDate={(dStr) => router.push(`/dashboard/calendar?date=${dStr}`)}
      />

      {/* ─── 5. MAIN WORKSPACE GRID: TICKETS & ROSTER (65% / 35%) ──────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Team Work Orders (8 cols = ~66%) */}
        <div className="lg:col-span-8 space-y-4">
          <div id="floor-tickets-queue" className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-sm max-h-[500px] flex flex-col transition-all">
            {/* Header & Filter Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-indigo-600" />
                  <span>Floor Work Orders & Ticket Queue</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Manage active repairs, assign mechanics, and review floor tickets ({filteredTickets.length} tickets).
                </p>
              </div>

              {/* Line Filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium">Line:</span>
                <select
                  value={lineFilter}
                  onChange={(e) => setLineFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="ALL">All Floor Lines</option>
                  {availableLines.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Search and Tabs */}
            <div className="py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
              {/* Tab Pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { key: 'ALL', label: 'All Tickets', count: repairs.length },
                  { key: 'CRITICAL', label: 'Critical', count: metrics.criticalCount },
                  { key: 'IN_PROGRESS', label: 'In Progress', count: metrics.inProgressCount },
                  { key: 'UNASSIGNED', label: 'Unassigned', count: metrics.unassignedCount },
                  {
                    key: 'COMPLETED',
                    label: 'Resolved',
                    count: repairs.filter((r) => r.status === 'COMPLETED').length,
                  },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setTicketFilter(tab.key as typeof ticketFilter)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                      ticketFilter === tab.key
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                        ticketFilter === tab.key ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Search box */}
              <div className="relative min-w-[200px]">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search ticket, machine, fault..."
                  value={ticketSearch}
                  onChange={(e) => setTicketSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Tickets Table / List */}
            <div className="mt-2 flex-1 min-h-0 overflow-y-auto overflow-x-auto border border-slate-300 rounded-lg shadow-2xs">
              {filteredTickets.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs bg-white">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500" />
                  No tickets found matching current filters.
                </div>
              ) : (
                <table className="w-full text-left border-collapse border border-slate-300 text-xs">
                  <thead className="sticky top-0 bg-slate-100 z-10 border-b border-slate-300 shadow-xs select-none">
                    <tr className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                      <th className="py-2.5 px-3 bg-slate-100 border-r border-b border-slate-300 font-mono">Ticket</th>
                      <th className="py-2.5 px-3 bg-slate-100 border-r border-b border-slate-300">Machine &amp; Line</th>
                      <th className="py-2.5 px-3 bg-slate-100 border-r border-b border-slate-300 min-w-[180px]">Fault Details</th>
                      <th className="py-2.5 px-3 bg-slate-100 border-r border-b border-slate-300">Assigned Mechanic</th>
                      <th className="py-2.5 px-3 text-center bg-slate-100 border-r border-b border-slate-300">Status</th>
                      <th className="py-2.5 px-3 text-right bg-slate-100 border-b border-slate-300">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs bg-white font-medium">
                    {filteredTickets.map((t) => {
                      const isCritical = t.urgency === 'CRITICAL';
                      const isUnassigned = !t.attendedBy;
                      const isClosed = t.status === 'COMPLETED' || t.status === 'REJECTED';
                      const isCompleted = t.status === 'COMPLETED';

                      return (
                        <tr key={t.id} className="hover:bg-blue-50/60 even:bg-slate-50/40 transition group">
                          {/* Ticket ID & Urgency */}
                          <td
                            className="py-2 px-3 cursor-pointer border-r border-b border-slate-200 group-hover:bg-blue-50/70"
                            onClick={() => {
                              setSelectedTicketForAssign(t);
                              setIsAssignModalOpen(true);
                            }}
                            title="Click to view & manage ticket"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  isCritical ? 'bg-rose-500 animate-pulse' : 'bg-amber-400'
                                }`}
                              />
                              <span className="font-extrabold text-indigo-700 hover:text-indigo-900 underline underline-offset-2 font-mono">{t.id}</span>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {t.reportedAt ? new Date(t.reportedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today'}
                            </div>
                          </td>

                          {/* Machine & Line */}
                          <td className="py-2 px-3 border-r border-b border-slate-200">
                            <div className="font-bold text-slate-900 font-mono">{t.machineId}</div>
                            <div className="text-[11px] text-slate-500">{t.line || 'Line 01'}</div>
                          </td>

                          {/* Fault Category */}
                          <td className="py-2 px-3 max-w-[200px] border-r border-b border-slate-200">
                            <div className="font-semibold text-slate-800 truncate">{t.faultCategory}</div>
                            <div className="text-[11px] text-slate-500 truncate">{t.faultDetails}</div>
                          </td>

                          {/* Assigned Mechanic */}
                          <td className="py-2 px-3 border-r border-b border-slate-200">
                            {t.attendedBy ? (
                              <div className="flex items-center gap-1.5">
                                <span className="w-5 h-5 rounded bg-indigo-100 text-indigo-700 font-bold text-[10px] flex items-center justify-center">
                                  {t.attendedBy.slice(0, 2).toUpperCase()}
                                </span>
                                <span className="font-semibold text-slate-800">{t.attendedBy}</span>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                ⚠️ Unassigned
                              </span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-2 px-3 text-center border-r border-b border-slate-200">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                isCompleted
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                  : t.status === 'IN_PROGRESS'
                                  ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                  : isUnassigned
                                  ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                  : 'bg-amber-100 text-amber-800 border border-amber-200'
                              }`}
                            >
                              {t.status}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-2 px-3 text-right border-b border-slate-200">
                            <div className="flex items-center justify-end gap-1.5">
                              {!isClosed && (
                                <>
                                  <button
                                    onClick={() => {
                                      setNewMachineId(t.machineId);
                                      setNewFaultCategory('Motor Electrical Noise');
                                      setNewFaultDetails(`Second problem on ${t.machineId} alongside active ticket ${t.id} (${t.faultCategory})`);
                                      setIsNewTicketModalOpen(true);
                                    }}
                                    title="Log another problem for this machine and assign to a different person"
                                    className="px-2 py-1 rounded text-[11px] font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition cursor-pointer flex items-center gap-1"
                                  >
                                    <Plus className="w-3 h-3 text-amber-600" />
                                    <span>+2nd Issue</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSelectedTicketForAssign(t);
                                      setIsAssignModalOpen(true);
                                    }}
                                    className="px-2 py-1 rounded text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition cursor-pointer"
                                  >
                                    {t.attendedBy ? 'Reassign' : 'Assign'}
                                  </button>
                                  <button
                                    onClick={() => t.status === 'IN_PROGRESS'
                                      ? handleStopRepair(t)
                                      : handleStartRepair(t)}
                                    disabled={isStartingWork || stoppingTicketId === t.id}
                                    className={`px-2 py-1 rounded text-[11px] font-semibold border transition cursor-pointer disabled:opacity-50 flex items-center gap-1 ${
                                      t.status === 'IN_PROGRESS'
                                        ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
                                        : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                                    }`}
                                  >
                                    {t.status === 'IN_PROGRESS'
                                      ? <><Pause className="w-3 h-3" /><span>{stoppingTicketId === t.id ? 'Stopping...' : 'Stop Work'}</span></>
                                      : <><Play className="w-3 h-3" /><span>{isStartingWork ? 'Starting...' : 'Start Work'}</span></>}
                                  </button>
                                  <button
                                    onClick={() => handleOpenResolve(t)}
                                    className="px-2 py-1 rounded text-[11px] font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 transition cursor-pointer flex items-center gap-1"
                                  >
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>Complete Repair</span>
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => {
                                  setSelectedTicketForAssign(t);
                                  setIsAssignModalOpen(true);
                                }}
                                title="Open & Manage Ticket Details"
                                className="px-2 py-1 rounded text-[11px] font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition cursor-pointer flex items-center gap-1"
                              >
                                <Wrench className="w-3 h-3 text-indigo-600" />
                                <span>Details</span>
                              </button>
                              <button
                                onClick={() => router.push(`/scan/${t.machineId}`)}
                                title="View Asset & Ticket Details"
                                className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Shift Duty Roster & Workload (4 cols = ~34%) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-sm max-h-[500px] flex flex-col">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-600" />
                  <span>Floor Attendance & Shift Duty</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  {roster.filter((m) => m.status === 'ON_DUTY').length} Present • {roster.filter((m) => repairs.some((r) => r.attendedBy === m.name && r.status !== 'COMPLETED')).length} on job • {roster.filter((m) => m.status === 'ON_DUTY' && !repairs.some((r) => r.attendedBy === m.name && r.status !== 'COMPLETED')).length} available
                </p>
              </div>

              {/* Filter trade */}
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[10px] font-semibold">
                <button
                  onClick={() => setRosterTradeFilter('ALL')}
                  className={`px-2 py-0.5 rounded-md ${
                    rosterTradeFilter === 'ALL' ? 'bg-white shadow text-slate-900' : 'text-slate-500'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => setRosterTradeFilter('MECHANIC')}
                  className={`px-2 py-0.5 rounded-md ${
                    rosterTradeFilter === 'MECHANIC' ? 'bg-white shadow text-slate-900' : 'text-slate-500'
                  }`}
                >
                  Mech
                </button>
                <button
                  onClick={() => setRosterTradeFilter('ELECTRICIAN')}
                  className={`px-2 py-0.5 rounded-md ${
                    rosterTradeFilter === 'ELECTRICIAN' ? 'bg-white shadow text-slate-900' : 'text-slate-500'
                  }`}
                >
                  Elec
                </button>
              </div>
            </div>

            {/* Mechanics list with combined attendance & duty info */}
            <div className="divide-y divide-slate-100 mt-2 space-y-1 flex-1 min-h-0 overflow-y-auto pr-1">
              {roster.map((m) => {
                const activeTicket = repairs.find(
                  (r) => r.attendedBy === m.name && r.status !== 'COMPLETED'
                );
                const isBusy = !!activeTicket;
                const isPresent = m.status === 'ON_DUTY';
                const isLeave = m.status === 'ON_LEAVE';

                return (
                  <div key={m.id} className="pt-3 pb-2 flex flex-col gap-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`w-8 h-8 rounded-xl font-bold text-xs flex items-center justify-center ${m.avatarColor}`}
                        >
                          {m.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900">{m.name}</div>
                          <div className="text-[10px] text-slate-500">
                            {m.role} • {m.experienceYears}y exp
                          </div>
                        </div>
                      </div>

                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          isBusy
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : isPresent
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {isBusy ? 'On Job' : isPresent ? 'Present • Available' : 'On Leave'}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-xl space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              isPresent
                                ? isBusy
                                  ? 'bg-amber-500 animate-pulse'
                                  : 'bg-emerald-500'
                                : isLeave
                                ? 'bg-amber-400'
                                : 'bg-slate-400'
                            }`}
                          />
                          <span className="font-semibold text-slate-800">
                            {isPresent
                              ? isBusy
                                ? `Present on floor • Active on ${activeTicket.machineId} (${activeTicket.line})`
                                : 'Present on floor / No task assigned'
                              : isLeave
                              ? 'On Approved Leave • Off-duty'
                              : 'Off Shift'}
                          </span>
                        </div>
                        <a
                          href={`tel:${m.phone}`}
                          className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 font-semibold text-[10px] shrink-0"
                        >
                          <Phone className="w-3 h-3" />
                          Call
                        </a>
                      </div>
                      <div className="text-[10px] text-slate-500 flex items-center justify-between">
                        <span>
                          {isBusy
                            ? `Fault: ${activeTicket.faultCategory}`
                            : `Coverage: ${m.assignedLines} • Shift: ${m.shift}`}
                        </span>
                        {!isBusy && isPresent && (
                          <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200/60">
                            Ready for Task
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 pt-3 border-t border-slate-100 shrink-0">
              <button
                onClick={() => router.push(`/${companySlug}/dashboard/mechanic-roster`)}
                className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-xs rounded-xl transition flex items-center justify-center gap-1 cursor-pointer"
              >
                <span>View Full Mechanics Master Roster</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── 5. SECONDARY WORKSPACE: PPM & REQUISITIONS (50% / 50%) ───── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Upcoming PPM Schedule */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-sm max-h-[500px] flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <CalendarCheck className="w-4 h-4 text-amber-500" />
                <span>PPM Preventive Maintenance Schedule</span>
              </h3>
              <p className="text-xs text-slate-500">Upcoming routine inspections for floor assets ({ppmSchedules.length} schedules)</p>
            </div>
            <button
              onClick={() => router.push(`/${companySlug}/dashboard/calendar`)}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
            >
              <span>Calendar</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-2.5 flex-1 min-h-0 overflow-y-auto pr-1 mt-3">
            {ppmSchedules.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">
                No PPM schedules found.
              </div>
            ) : (
              ppmSchedules.map((ppm) => {
                const isOverdue = ppm.status === 'OVERDUE';
                const isDueSoon = ppm.status === 'DUE_SOON';
                const isDone = ppm.status === 'COMPLETED';

                return (
                  <div
                    key={ppm.id}
                    className="p-3 bg-slate-50 rounded-2xl border border-slate-200/60 flex items-center justify-between gap-3 hover:bg-slate-100/60 transition"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`p-2 rounded-xl text-xs font-bold ${
                          isDone
                            ? 'bg-emerald-100 text-emerald-800'
                            : isOverdue
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        <CalendarCheck className="w-4 h-4" />
                      </span>
                      <div>
                        <div className="text-xs font-bold text-slate-900 font-mono flex items-center gap-2">
                          <span>{ppm.machineId}</span>
                          <span className="text-[10px] font-sans font-medium text-slate-500">
                            {ppm.frequency} • Next: {ppm.nextDue ? new Date(ppm.nextDue).toLocaleDateString() : 'Pending'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          Task: {ppm.task || 'Routine Preventive Check'}
                        </div>
                      </div>
                    </div>

                    {!isDone && (
                      <button
                        onClick={() => handleQuickCompletePPM(ppm.id, ppm.machineId)}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-lg transition cursor-pointer"
                      >
                        Complete
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Spare Parts Requisitions */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200/80 shadow-sm max-h-[500px] flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Boxes className="w-4 h-4 text-emerald-600" />
                <span>Group Indents & Parts Requisitions</span>
              </h3>
              <p className="text-xs text-slate-500">Status of spare requests submitted by team ({requisitions.length} requests)</p>
            </div>
            <button
              onClick={() => router.push(`/${companySlug}/dashboard/inventory`)}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
            >
              <span>+ Indent Parts</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          <div className="space-y-2.5 flex-1 min-h-0 overflow-y-auto pr-1 mt-3">
            {requisitions.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400">
                No active parts requisitions submitted.
              </div>
            ) : (
              requisitions.map((req) => (
                <div
                  key={req.id}
                  className="p-3 bg-slate-50 rounded-2xl border border-slate-200/60 flex items-center justify-between gap-3 hover:bg-slate-100/60 transition"
                >
                  <div className="flex items-center gap-3">
                    <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                      <FileText className="w-4 h-4" />
                    </span>
                    <div>
                      <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                        <span>{req.id}</span>
                        <span className="text-[10px] text-slate-500">
                          {req.partName || (req.items && req.items[0]?.partName) || 'Spare Part Kit'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Qty: {req.quantity || req.itemCount} • By: {req.requestedBy}
                      </div>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      req.status === 'FULFILLED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : req.status === 'PENDING_CEO_APPROVAL'
                        ? 'bg-rose-100 text-rose-800'
                        : req.status === 'APPROVED_BY_CEO'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {req.status.replace(/_/g, ' ')}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ─── MODAL 1: LOG FLOOR BREAKDOWN ──────────────────────────────── */}
      {isNewTicketModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-rose-100 text-rose-700">
                  <Flame className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Log Floor Machine Breakdown</h3>
                  <p className="text-xs text-slate-500">Halt asset and dispatch maintenance technician</p>
                </div>
              </div>
              <button
                onClick={() => setIsNewTicketModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-4">
              {/* Machine ID Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Target Machine Asset
                </label>
                <select
                  value={newMachineId}
                  onChange={(e) => setNewMachineId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  <option value="">Select Machine Asset...</option>
                  {machines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.id} — {m.type} ({m.area || m.currentLine || 'Line 01'}) [{m.status}]
                    </option>
                  ))}
                </select>
              </div>

              {/* Fault Category */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Fault Category
                </label>
                <select
                  value={newFaultCategory}
                  onChange={(e) => setNewFaultCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Skipping Stitches">Skipping Stitches / Timing Slip</option>
                  <option value="Needle Breakage">Frequent Needle Breakage</option>
                  <option value="Thread Breakage">Thread Snapping / Looper Burr</option>
                  <option value="Motor Electrical Noise">Motor Overheating / Drive Fault</option>
                  <option value="Oil Leakage / Seal Fail">Oil Leakage / Sump Depletion</option>
                  <option value="Feed Dog Jamming">Fabric Jam / Feed Dog Damage</option>
                  <option value="Pneumatic Valve Loss">Air Pressure / Pneumatic Valve Fault</option>
                  <option value="Emergency Stop Tripped">Safety Guard / E-Stop Fault</option>
                  <option value="Other Breakdown">Other Machine Breakdown</option>
                </select>
              </div>

              {/* Urgency */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Urgency</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewUrgency('CRITICAL')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      newUrgency === 'CRITICAL'
                        ? 'bg-rose-50 border-rose-500 text-rose-700 shadow-sm'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <Flame className="w-3.5 h-3.5" />
                    <span>CRITICAL (Halt Line)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewUrgency('WARNING')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      newUrgency === 'WARNING'
                        ? 'bg-amber-50 border-amber-500 text-amber-800 shadow-sm'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>WARNING (Intermittent)</span>
                  </button>
                </div>
              </div>

              {/* Fault Details */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Symptoms & Observations
                </label>
                <textarea
                  rows={2}
                  value={newFaultDetails}
                  onChange={(e) => setNewFaultDetails(e.target.value)}
                  placeholder="Describe the noise, defect, or symptoms observed on the floor..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Immediate Assignee (Optional) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Dispatch Floor Mechanic (Optional)
                </label>
                <select
                  value={newAssignee}
                  onChange={(e) => setNewAssignee(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Leave Unassigned (Floor Queue)</option>
                  {assignableTechnicians.map((m) => (
                    <option key={m.id} value={m.name}>
                      {m.name} — {m.role} ({m.assignedLines})
                    </option>
                  ))}
                </select>
              </div>

              {/* Secondary Simultaneous Problem Section */}
              <div className="pt-2 border-t border-slate-200/80">
                <button
                  type="button"
                  onClick={() => setHasSecondProblem(!hasSecondProblem)}
                  className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-between border cursor-pointer ${
                    hasSecondProblem
                      ? 'bg-amber-50 border-amber-300 text-amber-900 shadow-2xs'
                      : 'bg-slate-50 hover:bg-slate-100 border-dashed border-slate-300 text-slate-700'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center font-bold">
                      2
                    </span>
                    <span>
                      {hasSecondProblem
                        ? 'Simultaneous 2nd Problem Active'
                        : '+ Same Machine 2nd Problem Detected? (e.g. Electrical + Mechanical)'}
                    </span>
                  </span>
                  <span className="text-[10px] font-mono uppercase font-bold text-amber-700">
                    {hasSecondProblem ? 'Remove 2nd Problem' : 'Add 2nd Problem'}
                  </span>
                </button>

                {hasSecondProblem && (
                  <div className="mt-3 p-3.5 bg-amber-50/50 border border-amber-200 rounded-2xl space-y-3 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold text-amber-900 uppercase tracking-wider flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        <span>Problem #2 on this Machine</span>
                      </span>
                      <span className="text-[10px] text-amber-700 font-medium">Can be assigned to a different person</span>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">Problem #2 Category</label>
                      <select
                        value={secondFaultCategory}
                        onChange={(e) => setSecondFaultCategory(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500"
                      >
                        <option value="Motor Electrical Noise">Motor Overheating / Drive Fault (Electrical)</option>
                        <option value="Needle Breakage">Frequent Needle Breakage (Mechanical)</option>
                        <option value="Skipping Stitches">Skipping Stitches / Timing Slip (Mechanical)</option>
                        <option value="Thread Breakage">Thread Snapping / Tension Fault</option>
                        <option value="Oil Leakage / Seal Fail">Oil Leakage / Lubrication Failure</option>
                        <option value="Pneumatic Valve Loss">Pneumatic Air Leak / Sensor Failure</option>
                        <option value="Emergency Stop Tripped">Safety Interlock / Power Failure</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">Problem #2 Observations</label>
                      <input
                        type="text"
                        value={secondFaultDetails}
                        onChange={(e) => setSecondFaultDetails(e.target.value)}
                        placeholder="e.g. Servo motor smoking while looper is also jammed..."
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-700">
                        Dispatch to Different Floor Mechanic / Specialist
                      </label>
                      <select
                        value={secondAssignee}
                        onChange={(e) => setSecondAssignee(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 font-semibold"
                      >
                        <option value="">Leave Unassigned (Floor Queue)</option>
                        {assignableTechnicians.map((m) => (
                          <option key={m.id} value={m.name}>
                            {m.name} — {m.role} ({m.trade} • {m.assignedLines})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-3 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsNewTicketModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingTicket}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition shadow-lg shadow-rose-600/30 cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingTicket ? 'Logging Breakdown...' : 'Confirm Breakdown & Dispatch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isSpareModalOpen && ticketToStart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <span className="p-2 rounded-xl bg-indigo-100 text-indigo-700">
                  <Package className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Select Spares Before Starting</h3>
                  <p className="text-xs text-slate-500 font-mono">
                    {ticketToStart.id} · {ticketToStart.machineId} · {ticketToStart.line || 'Line 01'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSpareModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                aria-label="Close spare selection"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs">
              <div className="font-bold text-amber-900">Fault: {ticketToStart.faultCategory}</div>
              <div className="text-amber-700 mt-0.5">
                {ticketToStart.faultDetails || 'Breakdown reported on floor'}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Spares to Use (optional)</span>
                </label>
                <button
                  type="button"
                  onClick={() => setStartShowAllSpares((showAll) => !showAll)}
                  className="text-[10px] text-indigo-600 hover:underline font-semibold cursor-pointer"
                >
                  {startShowAllSpares
                    ? `Show compatible (${startCompatibleSpares.length})`
                    : `Show all (${parts.length})`}
                </button>
              </div>

              {startSpareParts.map((row, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <select
                      value={row.partId}
                      onChange={(event) => {
                        const partId = event.target.value;
                        setStartSpareParts((previous) => previous.map((item, rowIndex) =>
                          rowIndex === index
                            ? { ...item, partId, customName: partId === CUSTOM_SPARE_PART_ID ? item.customName : '' }
                            : item
                        ));
                      }}
                      className="flex-1 px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value="">-- No spare part --</option>
                      {startCompatibleSpares.map((part) => (
                        <option key={part.partId} value={part.partId}>
                          {part.name} ({part.sku}) — ₹{part.unitCost} · Stock: {part.stock}
                        </option>
                      ))}
                      <option value={CUSTOM_SPARE_PART_ID}>Custom spare (not in inventory)</option>
                    </select>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={row.qty}
                      onChange={(event) => setStartSpareParts((previous) => previous.map((item, rowIndex) =>
                        rowIndex === index
                          ? { ...item, qty: Math.max(1, Number.parseInt(event.target.value, 10) || 1) }
                          : item
                      ))}
                      disabled={!row.partId}
                      className="w-16 px-2 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-center disabled:opacity-40"
                      aria-label={`Quantity for spare ${index + 1}`}
                    />
                    {startSpareParts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setStartSpareParts((previous) =>
                          previous.filter((_, rowIndex) => rowIndex !== index)
                        )}
                        className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                        aria-label={`Remove spare ${index + 1}`}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {row.partId === CUSTOM_SPARE_PART_ID && (
                    <input
                      type="text"
                      value={row.customName}
                      onChange={(event) => setStartSpareParts((previous) => previous.map((item, rowIndex) =>
                        rowIndex === index ? { ...item, customName: event.target.value } : item
                      ))}
                      placeholder="Enter custom spare name"
                      required
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={() => setStartSpareParts((previous) => [
                  ...previous,
                  { partId: '', qty: 1, customName: '' },
                ])}
                className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer hover:underline"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add another spare</span>
              </button>
            </div>

            <p className="text-[10px] text-slate-500 bg-slate-50 rounded-xl p-2.5 border border-slate-200">
              Custom spares are recorded on the breakdown ticket and do not change inventory stock.
            </p>

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setIsSpareModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isStartingWork}
                onClick={handleConfirmStartWithSpares}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-lg shadow-indigo-600/30 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                <Play className="w-4 h-4 fill-white" />
                <span>{isStartingWork ? 'Starting Work...' : 'Confirm & Start Work'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: ASSIGN / REASSIGN MECHANIC ────────────────────────── */}
      {isAssignModalOpen && selectedTicketForAssign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-indigo-100 text-indigo-700">
                  <UserCheck className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Assign Work Order</h3>
                  <p className="text-xs text-slate-500 font-mono">Ticket {selectedTicketForAssign.id}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsAssignModalOpen(false);
                  setSelectedTicketForAssign(null);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-xs space-y-1">
              <div>
                <span className="font-bold text-slate-700">Machine: </span>
                <span className="font-mono text-slate-900 font-semibold">{selectedTicketForAssign.machineId}</span>
                <span className="text-slate-500"> ({selectedTicketForAssign.line})</span>
              </div>
              <div>
                <span className="font-bold text-slate-700">Issue: </span>
                <span className="text-slate-800">{selectedTicketForAssign.faultCategory}</span>
              </div>
            </div>

            <form onSubmit={handleAssignSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Select Floor Technician
                </label>
                <select
                  value={assigneeName}
                  onChange={(e) => setAssigneeName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                >
                  <option value="">Choose technician...</option>
                  {assignableTechnicians.map((m) => (
                    <option key={m.id} value={m.name}>
                      {m.name} ({m.trade} • {m.assignedLines})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsAssignModalOpen(false);
                    setSelectedTicketForAssign(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAssign}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition shadow-lg shadow-indigo-600/30 cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingAssign ? 'Assigning...' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isResolveModalOpen && selectedTicketToResolve && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Resolve Work Order</h3>
                  <p className="text-xs text-slate-500 font-mono">
                    {selectedTicketToResolve.id} • {selectedTicketToResolve.machineId}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsResolveModalOpen(false);
                  setSelectedTicketToResolve(null);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                aria-label="Close resolve work order"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleResolveSubmit} className="space-y-4 text-xs">
              <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                <span className="font-semibold text-emerald-900">Recorded downtime</span>
                <span className="font-mono font-bold text-emerald-800">
                  {resolveDowntimeMinutes} {resolveDowntimeMinutes === 1 ? 'min' : 'mins'}
                </span>
              </div>
              {(selectedTicketToResolve.partsUsed || []).length > 0 && (
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
                  <div className="font-bold text-indigo-900 mb-1">Spares recorded</div>
                  <div className="text-slate-700">
                    {selectedTicketToResolve.partsUsed
                      .map((part) => `${part.name} × ${part.quantity}`)
                      .join(', ')}
                  </div>
                </div>
              )}
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Root cause / issue identified *
                </label>
                <textarea
                  value={resolveIssuesIdentified}
                  onChange={(e) => setResolveIssuesIdentified(e.target.value)}
                  rows={3}
                  required
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Corrective action taken *
                </label>
                <textarea
                  value={resolveActionTaken}
                  onChange={(e) => setResolveActionTaken(e.target.value)}
                  rows={3}
                  required
                  placeholder="Describe the repair and verification performed"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsResolveModalOpen(false);
                    setSelectedTicketToResolve(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingResolve}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
                >
                  {isSubmittingResolve ? 'Resolving...' : 'Confirm Resolution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── WIDGET DRILL-DOWN SIDEBAR (RIGHT TO LEFT) ─────────────── */}
      <WidgetDrilldownDrawer
        isOpen={drillDownState.isOpen}
        onClose={closeDrillDown}
        type={drillDownState.type}
        title={drillDownState.title}
        meta={drillDownState.meta}
        machines={machines}
        repairs={repairs}
        ppmSchedules={ppmSchedules}
        parts={parts}
        requisitions={requisitions}
      />
    </div>
  );
}
