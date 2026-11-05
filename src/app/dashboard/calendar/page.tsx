'use client';

import { textValue } from '@/lib/textValue';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  CalendarDays,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Clock,
  Wrench,
  CheckCheck,
  CheckCircle2,
  Check,
  UserCheck,
  ArrowRightLeft,
  X,
  Plus,
  BellRing,
  Filter,
  Layers,
  ListOrdered,
  CalendarRange,
  Flame,
  ShieldCheck,
  Tag,
  ArrowRight,
  Info,
  Users,
  Search,
  Truck,
  Zap,
} from 'lucide-react';
import { RepairTicket, RepairUrgency, Machine, SparePart, PPMSchedule } from '@/types/cmms';
import {
  subscribeRepairs,
  subscribeMachines,
  subscribeParts,
  subscribePPMSchedules,
  resolveRepairTicket,
  completePPMTask,
  createPPMSchedule,
  assignRepairTicket,
  assignMechanicTask,
} from '@/lib/services/cmmsService';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import { matchesUnit, isUserAdmin, getUserScopedUnit } from '@/lib/constants/units';
import { TeamScheduleModal } from '@/components/calendar/TeamScheduleModal';
import { MaintenanceMilestonesAndTasks } from '@/components/dashboard/MaintenanceMilestonesAndTasks';
import { FACTORY_MECHANICS_ROSTER, MechanicDuty, userToMechanicDuty } from '@/lib/constants/mechanics';
import { filterSparesForMachine, detectMachineCategory } from '@/lib/utils/spareMapping';

// Helper to format Date to 'YYYY-MM-DD'
function toDateKey(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export default function CalendarPage() {
  const { showToast } = useToast();
  const { user, role } = useAuth();
  const isAdmin = isUserAdmin(role);
  const effectiveUnit = getUserScopedUnit(user, role);

  const [repairs, setRepairs] = useState<RepairTicket[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [spareParts, setSpareParts] = useState<SparePart[]>([]);
  const [ppmSchedules, setPpmSchedules] = useState<PPMSchedule[]>([]);

  // Navigation & View state
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string>(() => toDateKey(new Date()));
  const [viewMode, setViewMode] = useState<'month' | 'agenda' | 'milestones'>('milestones');
  const [filterType, setFilterType] = useState<'ALL' | 'CRITICAL' | 'REPAIRS' | 'PPM' | 'COMPLETED'>('ALL');

  // Refs to prevent repetitive auto-popup re-triggering during background poll intervals
  const initialDispatchHandledRef = useRef(false);
  const openedTicketIdRef = useRef<string | null>(null);

  // Handle URL params and set default view to milestones for all persons
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const viewParam = params.get('view');
      if (viewParam === 'month' || viewParam === 'agenda') {
        setViewMode(viewParam);
      } else {
        setViewMode('milestones');
      }

      const actionParam = params.get('action') || params.get('tab');
      if (
        !initialDispatchHandledRef.current &&
        (actionParam === 'dispatch' ||
          actionParam === 'assign' ||
          actionParam === 'move' ||
          params.get('assign') === 'true')
      ) {
        initialDispatchHandledRef.current = true;
        setIsInlineDispatchOpen(true);
        if (actionParam === 'move') {
          setDispatchTab('move');
        } else {
          setDispatchTab('assign');
        }

        // Clean query parameters from URL immediately so background poll ticks don't re-open it every 5s
        const url = new URL(window.location.href);
        url.searchParams.delete('action');
        url.searchParams.delete('tab');
        url.searchParams.delete('assign');
        window.history.replaceState({}, '', url.toString());
      }
    }
  }, []);

  // When ticketId is in search params, auto-open that ticket in the modal
  useEffect(() => {
    if (typeof window !== 'undefined' && repairs.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const ticketId = params.get('ticketId');
      if (ticketId && openedTicketIdRef.current !== ticketId) {
        const ticket = repairs.find((r) => r.id === ticketId);
        if (ticket) {
          openedTicketIdRef.current = ticketId;
          const tDate = ticket.reportedAt ? ticket.reportedAt.slice(0, 10) : toDateKey(new Date());
          setSelectedDate(tDate);
          setSelectedTicket(ticket);
          const startMs = ticket.startedAt ? new Date(ticket.startedAt).getTime() : new Date(ticket.reportedAt).getTime();
          const elapsed = Math.max(1, Math.round((Date.now() - startMs) / 60000));
          setDowntimeMinutes(elapsed);
          setActionTaken('');
          setSelectedPartId('');
          setSelectedPartQty(1);
          setIsResolveOpen(true);
        }
      }
    }
  }, [repairs]);

  // Senior Mechanic and Senior Electrician have authority to schedule new PPM overhauls
  const canSchedulePPM = role === 'SENIOR_MECHANIC' || role === 'SENIOR_ELECTRICIAN';
  const isMechanicRole = role === 'MECHANIC' || role === 'SENIOR_MECHANIC' || role === 'ELECTRICIAN' || role === 'SENIOR_ELECTRICIAN';

  // Resolve Repair modal state
  const [isResolveOpen, setIsResolveOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<RepairTicket | null>(null);
  const [downtimeMinutes, setDowntimeMinutes] = useState<number>(30);
  const [actionTaken, setActionTaken] = useState<string>('');
  const [selectedPartId, setSelectedPartId] = useState<string>('');
  const [selectedPartQty, setSelectedPartQty] = useState<number>(1);
  const [showAllSparesOverride, setShowAllSparesOverride] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New PPM Schedule modal state
  const [isSchedulePPMOpen, setIsSchedulePPMOpen] = useState(false);
  const [newPPMMachineId, setNewPPMMachineId] = useState('');
  const [newPPMTask, setNewPPMTask] = useState('');
  const [newPPMFrequency, setNewPPMFrequency] = useState<'Weekly' | 'Monthly' | '6-Month'>('Monthly');
  const [newPPMDueDate, setNewPPMDueDate] = useState<string>(() => toDateKey(new Date()));
  const [newPPMAssignee, setNewPPMAssignee] = useState(() =>
    role === 'SENIOR_ELECTRICIAN' ? 'Vijay Kumar' : 'Suresh Babu'
  );
  const [isCreatingPPM, setIsCreatingPPM] = useState(false);

  // Senior Mechanic Team Work Schedule Pop-up state
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);

  // Senior Mechanic / Electrician Direct Assign / Move Task Desk State
  const [isInlineDispatchOpen, setIsInlineDispatchOpen] = useState(false);
  const [dispatchTab, setDispatchTab] = useState<'assign' | 'move'>('assign');
  const [moveSearchQuery, setMoveSearchQuery] = useState('');
  const [moveAssigneeMap, setMoveAssigneeMap] = useState<Record<string, string>>({});
  const [inlineMachineId, setInlineMachineId] = useState('');
  const [inlineTaskTitle, setInlineTaskTitle] = useState('');
  const [inlineAssignee, setInlineAssignee] = useState(() =>
    role === 'SENIOR_ELECTRICIAN' ? 'Anand Kumar' : 'ROBERT'
  );
  const [inlineUrgency, setInlineUrgency] = useState<RepairUrgency>('WARNING');
  const [isSubmittingInline, setIsSubmittingInline] = useState(false);

  // Real-time subscriptions
  useEffect(() => {
    const unsubR = subscribeRepairs((data) => setRepairs(data));
    const unsubM = subscribeMachines((data) => setMachines(data));
    const unsubP = subscribeParts((data) => setSpareParts(data));
    const unsubPPM = subscribePPMSchedules((data) => setPpmSchedules(data));

    return () => {
      unsubR();
      unsubM();
      unsubP();
      unsubPPM();
    };
  }, []);

  // In calendar & dispatch, include plant floor machinery scoped to user's unit for non-admins
  const displayMachines = useMemo(() => {
    if (isAdmin) return machines;
    return machines.filter((m) => matchesUnit(m.unit, effectiveUnit));
  }, [machines, isAdmin, effectiveUnit]);

  // Map of scoped machines by ID
  const machineMap = useMemo(() => new Map(displayMachines.map((m) => [m.id, m])), [displayMachines]);

  const targetMachineForResolve = useMemo(() => {
    if (!selectedTicket) return null;
    return displayMachines.find((m) => m.id === selectedTicket.machineId) || null;
  }, [selectedTicket, displayMachines]);

  const detectedMachineCategory = useMemo(() => {
    if (!selectedTicket) return '';
    return detectMachineCategory(targetMachineForResolve || selectedTicket.machineType || selectedTicket.machineId);
  }, [selectedTicket, targetMachineForResolve]);

  const compatibleSparesForResolve = useMemo(() => {
    if (!selectedTicket || showAllSparesOverride) return spareParts;
    return filterSparesForMachine(spareParts, targetMachineForResolve || selectedTicket.machineType || selectedTicket.machineId);
  }, [selectedTicket, showAllSparesOverride, spareParts, targetMachineForResolve]);

  const [registeredTechs, setRegisteredTechs] = useState<MechanicDuty[]>([]);

  useEffect(() => {
    fetch('/api/users')
      .then((r) => r.json())
      .then((data) => {
        if (data.users && Array.isArray(data.users)) {
          let techs = data.users.filter((u: any) =>
            ['MECHANIC', 'SENIOR_MECHANIC', 'ELECTRICIAN', 'SENIOR_ELECTRICIAN'].includes(u.role)
          );
          if (!isAdmin) {
            techs = techs.filter((u: any) => matchesUnit(u.unit, effectiveUnit));
          }
          if (techs.length > 0) {
            setRegisteredTechs(techs.map(userToMechanicDuty));
          }
        }
      })
      .catch(() => {});
  }, [isAdmin, effectiveUnit]);

  const activeStaffRoster = registeredTechs.length > 0 ? registeredTechs : FACTORY_MECHANICS_ROSTER;

  // Floor technicians available for assignment (supervisor assigns technicians, NOT himself)
  const relevantTechnicians = useMemo(() => {
    const currentName = textValue((user?.name || '')).trim().toLowerCase();
    const isFloorCandidate = (m: MechanicDuty) => {
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
    };

    if (role === 'SENIOR_ELECTRICIAN') {
      return activeStaffRoster.filter((m) => m.trade === 'ELECTRICIAN' && isFloorCandidate(m));
    }
    if (role === 'SENIOR_MECHANIC') {
      return activeStaffRoster.filter((m) => m.trade === 'MECHANIC' && isFloorCandidate(m));
    }
    // For Admin / General: show all floor mechanics and electricians, excluding self and supervisors
    return activeStaffRoster.filter((m) => isFloorCandidate(m));
  }, [role, activeStaffRoster, user?.name]);

  // Set default machine for PPM and inline dispatch once machines load
  useEffect(() => {
    if (displayMachines.length > 0 && !newPPMMachineId) {
      setNewPPMMachineId(displayMachines[0].id);
    }
    if (displayMachines.length > 0 && !inlineMachineId) {
      setInlineMachineId(displayMachines[0].id);
    }
  }, [displayMachines, newPPMMachineId, inlineMachineId]);

  // Sync modal date when selectedDate changes
  useEffect(() => {
    setNewPPMDueDate(selectedDate);
  }, [selectedDate]);

  // Derived current month information
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthLabel = `${monthNames[month]} ${year}`;

  const todayKey = useMemo(() => toDateKey(new Date()), []);

  // Floor repairs and PPM schedules scoped to user's unit for non-admins
  const scopedRepairs = useMemo(() => {
    if (isAdmin) return repairs;
    const allowedMachineIds = new Set(displayMachines.map((m) => textValue(m.id).toLowerCase()));
    return repairs.filter((r) => {
      if (r.machineId && allowedMachineIds.has(textValue(r.machineId).toLowerCase())) return true;
      if (r.unit && matchesUnit(r.unit, effectiveUnit)) return true;
      return false;
    });
  }, [repairs, displayMachines, isAdmin, effectiveUnit]);

  const scopedPpmSchedules = useMemo(() => {
    if (isAdmin) return ppmSchedules;
    const allowedMachineIds = new Set(displayMachines.map((m) => textValue(m.id).toLowerCase()));
    return ppmSchedules.filter((p) => {
      if (p.machineId && allowedMachineIds.has(textValue(p.machineId).toLowerCase())) return true;
      if (p.unit && matchesUnit(p.unit, effectiveUnit)) return true;
      return false;
    });
  }, [ppmSchedules, displayMachines, isAdmin, effectiveUnit]);

  // Open tickets eligible for Move / Reassignment
  const openTicketsForMove = useMemo(
    () => scopedRepairs.filter((r) => r.status !== 'COMPLETED'),
    [scopedRepairs]
  );

  const filteredTicketsForMove = useMemo(() => {
    if (!moveSearchQuery.trim()) return openTicketsForMove;
    const q = moveSearchQuery.toLowerCase();
    return openTicketsForMove.filter(
      (t) =>
        textValue(t.id).toLowerCase().includes(q) ||
        textValue(t.machineId).toLowerCase().includes(q) ||
        (t.machineType && textValue(t.machineType).toLowerCase().includes(q)) ||
        (t.line && textValue(t.line).toLowerCase().includes(q)) ||
        (t.faultCategory && textValue(t.faultCategory).toLowerCase().includes(q)) ||
        (t.faultDetails && textValue(t.faultDetails).toLowerCase().includes(q)) ||
        (t.attendedBy && textValue(t.attendedBy).toLowerCase().includes(q))
    );
  }, [openTicketsForMove, moveSearchQuery]);

  // Events grouped by date string ('YYYY-MM-DD')
  const eventsByDate = useMemo(() => {
    const map = new Map<string, { repairs: RepairTicket[]; ppms: PPMSchedule[] }>();

    const getBucket = (key: string) => {
      if (!map.has(key)) {
        map.set(key, { repairs: [], ppms: [] });
      }
      return map.get(key)!;
    };

    // Index repairs by reportedAt, resolvedAt, and active tickets on todayKey
    for (const r of scopedRepairs) {
      const dateKey = r.reportedAt ? r.reportedAt.slice(0, 10) : todayKey;
      if (dateKey) {
        const bucket = getBucket(dateKey);
        if (!bucket.repairs.some((existing) => existing.id === r.id)) {
          bucket.repairs.push(r);
        }
      }
      // If ticket is an active critical breakdown and reported date is NOT today,
      // ALSO ensure it shows in today's bucket so technicians immediately see open emergencies!
      if (r.urgency === 'CRITICAL' && r.status !== 'COMPLETED' && dateKey !== todayKey) {
        const todayBucket = getBucket(todayKey);
        if (!todayBucket.repairs.some((existing) => existing.id === r.id)) {
          todayBucket.repairs.push(r);
        }
      }
      // Also index resolved date if different and resolved
      if (r.status === 'COMPLETED' && r.resolvedAt) {
        const resKey = r.resolvedAt.slice(0, 10);
        if (resKey && resKey !== dateKey) {
          const resBucket = getBucket(resKey);
          if (!resBucket.repairs.some((existing) => existing.id === r.id)) {
            resBucket.repairs.push(r);
          }
        }
      }
    }

    // Index PPMs by nextDue
    for (const ppm of scopedPpmSchedules) {
      const dateKey = ppm.nextDue ? ppm.nextDue.slice(0, 10) : '';
      if (dateKey) {
        const bucket = getBucket(dateKey);
        if (!bucket.ppms.some((existing) => existing.id === ppm.id)) {
          bucket.ppms.push(ppm);
        }
      }
    }

    return map;
  }, [scopedRepairs, scopedPpmSchedules, todayKey]);

  // Monthly KPI Statistics
  const stats = useMemo(() => {
    const currentMonthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    const monthRepairs = scopedRepairs.filter(
      (r) => r.reportedAt?.startsWith(currentMonthPrefix) || r.resolvedAt?.startsWith(currentMonthPrefix)
    );
    const monthPPMs = scopedPpmSchedules.filter((p) => p.nextDue?.startsWith(currentMonthPrefix));

    // Live active critical emergency tickets across plant
    const critical = scopedRepairs.filter((r) => r.urgency === 'CRITICAL' && r.status !== 'COMPLETED').length;
    const completed = monthRepairs.filter((r) => r.status === 'COMPLETED').length;
    const dueSoonPPM = monthPPMs.filter((p) => p.status === 'DUE_SOON' || p.status === 'OVERDUE').length;

    return {
      totalMonthJobs: monthRepairs.length + monthPPMs.length,
      critical,
      completed,
      dueSoonPPM,
      totalPPM: monthPPMs.length,
    };
  }, [scopedRepairs, scopedPpmSchedules, year, month]);

  // Calendar matrix generator (42 cells: 6 weeks x 7 days)
  const calendarCells = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1);
    const startDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sun, 1 = Mon ... 6 = Sat
    const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const cells: Array<{
      date: Date;
      dateString: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
      isWeekend: boolean;
      repairs: RepairTicket[];
      ppms: PPMSchedule[];
      hasCritical: boolean;
    }> = [];

    // 1. Previous month trailing days
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const d = new Date(year, month - 1, dayNum);
      const dKey = toDateKey(d);
      const b = eventsByDate.get(dKey) || { repairs: [], ppms: [] };
      const hasCrit = b.repairs.some((r) => r.urgency === 'CRITICAL' && r.status !== 'COMPLETED');

      cells.push({
        date: d,
        dateString: dKey,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isToday: dKey === todayKey,
        isSelected: dKey === selectedDate,
        isWeekend: d.getDay() === 0 || d.getDay() === 6,
        repairs: b.repairs,
        ppms: b.ppms,
        hasCritical: hasCrit,
      });
    }

    // 2. Current month days
    for (let dayNum = 1; dayNum <= daysInCurrentMonth; dayNum++) {
      const d = new Date(year, month, dayNum);
      const dKey = toDateKey(d);
      const b = eventsByDate.get(dKey) || { repairs: [], ppms: [] };
      const hasCrit = b.repairs.some((r) => r.urgency === 'CRITICAL' && r.status !== 'COMPLETED');

      cells.push({
        date: d,
        dateString: dKey,
        dayNumber: dayNum,
        isCurrentMonth: true,
        isToday: dKey === todayKey,
        isSelected: dKey === selectedDate,
        isWeekend: d.getDay() === 0 || d.getDay() === 6,
        repairs: b.repairs,
        ppms: b.ppms,
        hasCritical: hasCrit,
      });
    }

    // 3. Next month leading days to complete 42 cells (uniform 6 rows)
    const remaining = 42 - cells.length;
    for (let dayNum = 1; dayNum <= remaining; dayNum++) {
      const d = new Date(year, month + 1, dayNum);
      const dKey = toDateKey(d);
      const b = eventsByDate.get(dKey) || { repairs: [], ppms: [] };
      const hasCrit = b.repairs.some((r) => r.urgency === 'CRITICAL' && r.status !== 'COMPLETED');

      cells.push({
        date: d,
        dateString: dKey,
        dayNumber: dayNum,
        isCurrentMonth: false,
        isToday: dKey === todayKey,
        isSelected: dKey === selectedDate,
        isWeekend: d.getDay() === 0 || d.getDay() === 6,
        repairs: b.repairs,
        ppms: b.ppms,
        hasCritical: hasCrit,
      });
    }

    return cells;
  }, [year, month, eventsByDate, todayKey, selectedDate]);

  // Agenda view items (all events in current month sorted by date)
  const agendaMonthItems = useMemo(() => {
    const currentMonthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    const grouped = new Map<string, { dateStr: string; dateObj: Date; repairs: RepairTicket[]; ppms: PPMSchedule[] }>();

    for (let dayNum = 1; dayNum <= 31; dayNum++) {
      const dKey = `${currentMonthPrefix}-${String(dayNum).padStart(2, '0')}`;
      const bucket = eventsByDate.get(dKey);
      if (bucket && (bucket.repairs.length > 0 || bucket.ppms.length > 0)) {
        let rep = bucket.repairs;
        let ppm = bucket.ppms;

        if (filterType === 'CRITICAL') {
          rep = rep.filter((r) => r.urgency === 'CRITICAL');
          ppm = [];
        } else if (filterType === 'REPAIRS') {
          ppm = [];
        } else if (filterType === 'PPM') {
          rep = [];
        } else if (filterType === 'COMPLETED') {
          rep = rep.filter((r) => r.status === 'COMPLETED');
          ppm = ppm.filter((p) => p.status === 'COMPLETED');
        }

        if (rep.length > 0 || ppm.length > 0) {
          grouped.set(dKey, {
            dateStr: dKey,
            dateObj: new Date(`${dKey}T00:00:00`),
            repairs: rep,
            ppms: ppm,
          });
        }
      }
    }

    return Array.from(grouped.values()).sort((a, b) => a.dateStr.localeCompare(b.dateStr));
  }, [year, month, eventsByDate, filterType]);

  // Calendar Navigation Handlers
  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    const now = new Date();
    setCurrentDate(now);
    setSelectedDate(toDateKey(now));
  };

  // Open Resolve Repair Modal
  const handleOpenResolveModal = (ticket: RepairTicket) => {
    setSelectedTicket(ticket);
    const startMs = ticket.startedAt ? new Date(ticket.startedAt).getTime() : new Date(ticket.reportedAt).getTime();
    const elapsed = Math.max(1, Math.round((Date.now() - startMs) / 60000));
    setDowntimeMinutes(elapsed);
    setActionTaken('');
    setSelectedPartId('');
    setSelectedPartQty(1);
    setShowAllSparesOverride(false);
    setIsResolveOpen(true);
  };

  // Submit Resolve Repair
  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket) return;
    setIsSubmitting(true);

    try {
      const partsUsedList: Array<{ partId: string; quantity: number }> = [];
      if (selectedPartId && selectedPartQty > 0) {
        partsUsedList.push({ partId: selectedPartId, quantity: selectedPartQty });
      }

      await resolveRepairTicket(
        selectedTicket.id,
        downtimeMinutes,
        actionTaken.trim() || 'Adjusted clearance, cleaned lint, and verified stitch balance.',
        user?.name || 'Ramesh Kumar',
        partsUsedList
      );

      showToast(
        `Machine ${selectedTicket.machineId} returned to service! Inventory updated atomically.`,
        'success'
      );
      setIsResolveOpen(false);
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.delete('ticketId');
        window.history.replaceState({}, '', url.toString());
      }
      setSelectedTicket(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(`Error resolving ticket: ${msg}`, 'error');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // One-Click Complete PPM Task
  const handleCompletePPM = async (scheduleId: string, taskName: string, machineId: string) => {
    try {
      await completePPMTask(scheduleId, user?.name || 'Ramesh Kumar');
      showToast(`PPM Task Completed: ${taskName} for ${machineId}`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to complete PPM schedule', 'error');
    }
  };

  // Direct 1-Click Move Task to Mechanic or Myself (No popup)
  const handleDirectMoveTask = async (ticketId: string, targetMechanicName: string) => {
    try {
      const assignedByTitle = role === 'SENIOR_ELECTRICIAN' ? 'Senior Electrician' : 'Senior Mechanic';
      const assignerName = `${user?.name || (role === 'SENIOR_ELECTRICIAN' ? 'Anand Kumar' : 'Ramesh Kumar')} (${assignedByTitle})`;
      await assignRepairTicket(ticketId, targetMechanicName, assignerName);
      showToast(
        `Work Order #${ticketId} dispatched directly to ${targetMechanicName}!`,
        'success'
      );
    } catch (err) {
      console.error(err);
      showToast('Error moving task to mechanic', 'error');
    }
  };

  // Inline Quick Dispatch (No popup)
  const handleInlineAssignTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetMachineId = inlineMachineId || (machines.length > 0 ? machines[0].id : '');
    if (!targetMachineId) {
      showToast('Please select a machine.', 'error');
      return;
    }
    const taskText = inlineTaskTitle.trim() || 'Breakdown Inspection & Looper Timing';

    setIsSubmittingInline(true);
    try {
      const targetMachine = machines.find((m) => m.id === targetMachineId);
      const assignedByTitle = role === 'SENIOR_ELECTRICIAN' ? 'Senior Electrician' : 'Senior Mechanic';
      const assignerName = `${user?.name || 'Plant Administrator & Supervisor'} (${assignedByTitle})`;
      const targetAssignee = inlineAssignee || (relevantTechnicians[0]?.name || 'Floor Mechanic');
      const ticketId = await assignMechanicTask({
        machineId: targetMachineId,
        machineType: targetMachine?.typeName || targetMachine?.type || 'Sewing Machine',
        line: targetMachine?.area || targetMachine?.currentLine || 'Line 01',
        taskTitle: taskText,
        faultDetails: `Direct dispatch from ${assignedByTitle}. Scheduled for ${selectedDate}.`,
        urgency: inlineUrgency,
        assignedTo: targetAssignee,
        assignedBy: assignerName,
        scheduledDate: selectedDate,
        shift: 'Shift A (07:00 - 15:30)',
      });

      showToast(
        `Work Order #${ticketId} created & dispatched to ${targetAssignee}!`,
        'success'
      );
      setInlineTaskTitle('');
      setIsInlineDispatchOpen(false);
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.delete('action');
        url.searchParams.delete('tab');
        url.searchParams.delete('assign');
        window.history.replaceState({}, '', url.toString());
      }
    } catch (err) {
      console.error(err);
      showToast('Failed to assign task', 'error');
    } finally {
      setIsSubmittingInline(false);
    }
  };

  // Submit New PPM Schedule
  const handleCreatePPMSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPPMMachineId || !newPPMTask.trim()) {
      showToast('Please select a machine and enter task details.', 'error');
      return;
    }
    setIsCreatingPPM(true);

    const intervalMap: Record<'Weekly' | 'Monthly' | '6-Month', number> = {
      Weekly: 7,
      Monthly: 30,
      '6-Month': 180,
    };

    const newSchedule: PPMSchedule = {
      id: `PPM-${Date.now().toString().slice(-4)}`,
      machineId: newPPMMachineId,
      task: newPPMTask.trim(),
      intervalDays: intervalMap[newPPMFrequency],
      frequency: newPPMFrequency,
      lastServiced: toDateKey(new Date()),
      nextDue: newPPMDueDate,
      status: 'PENDING',
      assignedTo: newPPMAssignee,
      assignedBy: user?.name || (role === 'SENIOR_ELECTRICIAN' ? 'Anand Kumar' : 'Ramesh Kumar'),
    };

    try {
      await createPPMSchedule(newSchedule);
      showToast(`Preventive Maintenance Task scheduled for ${newPPMMachineId}!`, 'success');
      setIsSchedulePPMOpen(false);
      setNewPPMTask('');
    } catch (err) {
      console.error(err);
      showToast('Failed to schedule PPM task.', 'error');
    } finally {
      setIsCreatingPPM(false);
    }
  };

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="space-y-4 pb-12">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-[#059669] text-white flex items-center justify-center shadow-xs shrink-0">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Pending Actions Desk
              </h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                {repairs.filter((r) => r.status !== 'COMPLETED').length} Issues • {ppmSchedules.filter((p) => p.status !== 'COMPLETED').length} PPM Pending
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Live breakdown issues entered by plant floor personnel and scheduled preventive maintenance (PPM) overhauls.
            </p>
          </div>
        </div>

        {/* Senior Supervisor Action Controls */}
        {canSchedulePPM && (
          <div className="flex items-center justify-end flex-wrap gap-2 shrink-0">
            <button
              onClick={() => setIsInlineDispatchOpen(true)}
              className="px-3.5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm shadow-emerald-600/25 cursor-pointer"
              title="Open Assign / Move Task Desk for floor work orders"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>⚡ Assign / Move Task</span>
            </button>
            <button
              onClick={() => setIsTeamModalOpen(true)}
              className="px-3.5 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm shadow-indigo-600/25 cursor-pointer"
              title="View all mechanics scheduled work for any date"
            >
              <Users className="w-3.5 h-3.5" />
              <span>👥 Everyone&apos;s Work Board</span>
            </button>
            <button
              onClick={() => setIsSchedulePPMOpen(true)}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Schedule PPM</span>
            </button>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────────────────
          UPPER HORIZONTAL TABS BAR (Pending Issues, PPM Schedule, Calendar, Dispatch)
      ────────────────────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-6 border-b border-slate-200 overflow-x-auto select-none pt-1">
        <button
          type="button"
          onClick={() => {
            setViewMode('milestones');
            setFilterType('ALL');
          }}
          className={`flex items-center gap-2 pb-2.5 text-xs sm:text-sm font-semibold transition cursor-pointer shrink-0 border-b-2 ${
            viewMode === 'milestones' && filterType === 'ALL'
              ? 'border-[#059669] text-[#065f46] font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock className={`w-4 h-4 ${viewMode === 'milestones' && filterType === 'ALL' ? 'text-[#059669]' : 'text-slate-400'}`} />
          <span>All Pending Actions</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setViewMode('milestones');
            setFilterType('REPAIRS');
          }}
          className={`flex items-center gap-2 pb-2.5 text-xs sm:text-sm font-semibold transition cursor-pointer shrink-0 border-b-2 ${
            viewMode === 'milestones' && filterType === 'REPAIRS'
              ? 'border-[#059669] text-[#065f46] font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Wrench className={`w-4 h-4 ${viewMode === 'milestones' && filterType === 'REPAIRS' ? 'text-[#059669]' : 'text-slate-400'}`} />
          <span>Reported Issues ({repairs.filter((r) => r.status !== 'COMPLETED').length})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setViewMode('milestones');
            setFilterType('PPM');
          }}
          className={`flex items-center gap-2 pb-2.5 text-xs sm:text-sm font-semibold transition cursor-pointer shrink-0 border-b-2 ${
            viewMode === 'milestones' && filterType === 'PPM'
              ? 'border-[#059669] text-[#065f46] font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldCheck className={`w-4 h-4 ${viewMode === 'milestones' && filterType === 'PPM' ? 'text-[#059669]' : 'text-slate-400'}`} />
          <span>PPM Schedule ({ppmSchedules.filter((p) => p.status !== 'COMPLETED').length})</span>
        </button>

        <button
          type="button"
          onClick={() => setViewMode('month')}
          className={`flex items-center gap-2 pb-2.5 text-xs sm:text-sm font-semibold transition cursor-pointer shrink-0 border-b-2 ${
            viewMode === 'month'
              ? 'border-[#059669] text-[#065f46] font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CalendarDays className={`w-4 h-4 ${viewMode === 'month' ? 'text-[#059669]' : 'text-slate-400'}`} />
          <span>Monthly Calendar</span>
        </button>
      </div>

      {/* 3. Monthly Metrics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Month Jobs</div>
            <div className="text-xl font-extrabold text-slate-900 mt-0.5">{stats.totalMonthJobs}</div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
            <CalendarIcon className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-rose-200 shadow-sm flex items-center justify-between bg-rose-50/20">
          <div>
            <div className="text-[11px] font-bold text-rose-600 uppercase tracking-wider flex items-center gap-1">
              {stats.critical > 0 && <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-ping" />}
              <span>Critical Active</span>
            </div>
            <div className="text-xl font-extrabold text-rose-700 mt-0.5">{stats.critical}</div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
            <Flame className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">PPM Schedules</div>
            <div className="text-xl font-extrabold text-blue-700 mt-0.5">{stats.totalPPM}</div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            <ShieldCheck className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Completed Fixes</div>
            <div className="text-xl font-extrabold text-emerald-700 mt-0.5">{stats.completed}</div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* 4. Main Body: Milestones & Tasks, Monthly Calendar Grid, or Agenda View */}
      {viewMode === 'milestones' ? (
        <MaintenanceMilestonesAndTasks
          repairs={scopedRepairs}
          ppmSchedules={scopedPpmSchedules}
          machines={displayMachines}
          userName={user?.name || (role === 'SENIOR_ELECTRICIAN' ? 'Anand Kumar' : 'Ramesh Kumar')}
          role={role || 'MECHANIC'}
          onOpenResolve={handleOpenResolveModal}
          onCompletePPM={(ppmId, machineId) => handleCompletePPM(ppmId, 'PPM Maintenance', machineId)}
          onOpenCalendarDate={(dStr) => {
            setSelectedDate(dStr);
          }}
          onOpenFullCalendar={() => setViewMode('month')}
        />
      ) : viewMode === 'month' ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Weekday column headers */}
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/75 text-center text-xs font-bold text-slate-600 py-2.5 select-none">
            {weekdays.map((w, idx) => (
              <div
                key={w}
                className={`uppercase tracking-wider ${
                  idx === 0 || idx === 6 ? 'text-slate-400' : 'text-slate-700'
                }`}
              >
                {w}
              </div>
            ))}
          </div>

          {/* 42-Cell Monthly Calendar Grid with Reduced Height */}
          <div className="grid grid-cols-7 border-b border-r border-slate-200">
            {calendarCells.map((cell) => {
              const isSelected = cell.dateString === selectedDate;
              const isToday = cell.isToday;

              // Filter events based on filterType
              let displayRepairs = cell.repairs;
              let displayPpms = cell.ppms;

              if (filterType === 'CRITICAL') {
                displayRepairs = displayRepairs.filter((r) => r.urgency === 'CRITICAL');
                displayPpms = [];
              } else if (filterType === 'REPAIRS') {
                displayPpms = [];
              } else if (filterType === 'PPM') {
                displayRepairs = [];
              } else if (filterType === 'COMPLETED') {
                displayRepairs = displayRepairs.filter((r) => r.status === 'COMPLETED');
                displayPpms = displayPpms.filter((p) => p.status === 'COMPLETED');
              }

              const totalEvents = displayRepairs.length + displayPpms.length;
              const criticalCount = displayRepairs.filter((r) => r.urgency === 'CRITICAL' && r.status !== 'COMPLETED').length;

              return (
                <div
                  key={cell.dateString}
                  onClick={() => {
                    setSelectedDate(cell.dateString);
                  }}
                  className={`min-h-[58px] sm:min-h-[66px] md:min-h-[72px] p-1.5 border-t border-l border-slate-200 flex flex-col justify-between transition group cursor-pointer relative hover:shadow-xs ${
                    !cell.isCurrentMonth
                      ? 'bg-slate-50/50 text-slate-300'
                      : cell.isWeekend
                      ? 'bg-slate-50/25'
                      : 'bg-white'
                  } ${
                    isSelected
                      ? 'ring-2 ring-indigo-600 bg-indigo-50/40 z-10'
                      : 'hover:bg-indigo-50/30'
                  }`}
                >
                  {/* Date Number Header */}
                  <div className="flex items-center justify-between mb-0.5">
                    <span
                      className={`text-[11px] font-bold inline-flex items-center justify-center w-5 h-5 rounded-full transition ${
                        isToday
                          ? 'bg-indigo-600 text-white shadow-xs ring-2 ring-indigo-200'
                          : isSelected
                          ? 'bg-slate-900 text-white'
                          : cell.isCurrentMonth
                          ? 'text-slate-800 group-hover:text-indigo-600'
                          : 'text-slate-300'
                      }`}
                    >
                      {cell.dayNumber}
                    </span>

                    {/* Prominent badge for critical line stoppage */}
                    {cell.hasCritical && (
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-rose-600 text-white text-[9px] font-extrabold rounded-full shadow-xs animate-pulse"
                        title="Critical Breakdown Stoppage"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                        <span>🚨 {criticalCount > 1 ? `${criticalCount} CRIT` : 'CRIT'}</span>
                      </span>
                    )}
                  </div>

                  {/* Compact Event Chips */}
                  <div className="space-y-0.5 overflow-hidden flex-1">
                    {/* 1. Critical Breakdown Chips */}
                    {displayRepairs
                      .filter((r) => r.urgency === 'CRITICAL' && r.status !== 'COMPLETED')
                      .slice(0, 1)
                      .map((r) => (
                        <div
                          key={r.id}
                          className="bg-rose-100/90 text-rose-950 border border-rose-300 rounded px-1.5 py-0.5 text-[9px] font-extrabold truncate flex items-center gap-1 shadow-2xs"
                          title={`🚨 CRITICAL: ${r.machineId} - ${r.faultCategory}`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-600 shrink-0" />
                          <span className="truncate">{r.machineId}</span>
                        </div>
                      ))}

                    {/* 2. Routine Repair Chips */}
                    {displayRepairs
                      .filter((r) => r.urgency !== 'CRITICAL' && r.status !== 'COMPLETED')
                      .slice(0, 1)
                      .map((r) => {
                        const isAssigned = r.status === 'ASSIGNED';
                        return (
                          <div
                            key={r.id}
                            className={`rounded px-1.5 py-0.5 text-[9px] font-semibold truncate flex items-center gap-1 ${
                              isAssigned
                                ? 'bg-violet-100 text-violet-900 border border-violet-300 font-bold'
                                : 'bg-amber-50 text-amber-900 border border-amber-200'
                            }`}
                            title={`${r.machineId}: ${r.faultCategory}`}
                          >
                            {isAssigned ? (
                              <UserCheck className="w-2.5 h-2.5 text-violet-600 shrink-0" />
                            ) : (
                              <Wrench className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                            )}
                            <span className="truncate">{r.machineId}</span>
                          </div>
                        );
                      })}

                    {/* 3. PPM Schedule Chips */}
                    {displayPpms.slice(0, 1).map((ppm) => (
                      <div
                        key={ppm.id}
                        className="bg-blue-50 text-blue-900 border border-blue-200 rounded px-1.5 py-0.5 text-[9px] font-semibold truncate flex items-center gap-1"
                        title={`PPM: ${ppm.task} (${ppm.machineId})`}
                      >
                        <ShieldCheck className="w-2.5 h-2.5 text-blue-600 shrink-0" />
                        <span className="truncate">{ppm.machineId}</span>
                      </div>
                    ))}

                    {/* 4. Completed Repair Chips */}
                    {displayRepairs
                      .filter((r) => r.status === 'COMPLETED')
                      .slice(0, 1)
                      .map((r) => (
                        <div
                          key={r.id}
                          className="bg-emerald-50 text-emerald-800 border border-emerald-200 rounded px-1.5 py-0.5 text-[9px] font-medium truncate flex items-center gap-1 opacity-75"
                          title={`Completed: ${r.machineId}`}
                        >
                          <CheckCheck className="w-2.5 h-2.5 text-emerald-600 shrink-0" />
                          <span className="truncate">{r.machineId}</span>
                        </div>
                      ))}

                    {/* "+N More" Indicator */}
                    {totalEvents > 2 && (
                      <div className="text-[8px] font-extrabold text-indigo-600 px-1 py-0.2 rounded hover:text-indigo-800 text-right">
                        +{totalEvents - 2} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Legend & Interactive Guide */}
          <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between text-[11px] text-slate-600 gap-2">
            <div className="flex items-center flex-wrap gap-3">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-rose-500" />
                <span className="font-semibold text-slate-700">Critical Breakdown</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-amber-400" />
                <span className="font-semibold text-slate-700">Routine Repair</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-violet-500" />
                <span className="font-semibold text-slate-700">Assigned Work</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-blue-500" />
                <span className="font-semibold text-slate-700">PPM Service</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded bg-emerald-500" />
                <span className="font-semibold text-slate-700">Completed</span>
              </span>
            </div>
            <div className="text-slate-500 font-semibold text-xs flex items-center gap-1.5">
              <span>Selected date: <strong className="text-slate-800">{selectedDate}</strong></span>
            </div>
          </div>
        </div>
      ) : (
        /* 5. Agenda View (Chronological Feed) */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Monthly Agenda Feed • {monthLabel}
              </h3>
              <p className="text-xs text-slate-500">
                Chronological list of all breakdown work orders and preventive tasks in {monthNames[month]}.
              </p>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              {agendaMonthItems.length} Scheduled Days
            </span>
          </div>

          {agendaMonthItems.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
              <div className="text-sm font-bold text-slate-800">All Lines Clear for this Month</div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                No active breakdown tickets or upcoming PPM maintenance tasks match your filter.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {agendaMonthItems.map((group) => {
                const isTodayGroup = group.dateStr === todayKey;
                const formattedHeader = group.dateObj.toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                });

                return (
                  <div key={group.dateStr} className="space-y-3">
                    {/* Date Header Strip */}
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDate(group.dateStr);
                        }}
                        className={`text-xs font-extrabold px-3 py-1 rounded-xl border transition cursor-pointer hover:shadow-xs flex items-center gap-1.5 ${
                          isTodayGroup
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                            : 'bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-200'
                        }`}
                        title="Selected date"
                      >
                        <span>{formattedHeader}</span>
                        {isTodayGroup && <span>• TODAY</span>}
                      </button>
                      <div className="flex-1 h-px bg-slate-200" />
                      <span className="text-[11px] font-semibold text-slate-400">
                        {group.repairs.length + group.ppms.length} items
                      </span>
                    </div>

                    {/* Events Grid for this Date */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                      {/* Repairs */}
                      {group.repairs.map((r) => {
                        const isCritical = r.urgency === 'CRITICAL';
                        const isDone = r.status === 'COMPLETED';

                        return (
                          <div
                            key={r.id}
                            className={`p-4 rounded-xl border shadow-2xs space-y-2.5 ${
                              isDone
                                ? 'bg-slate-50 border-slate-200 opacity-80'
                                : isCritical
                                ? 'bg-rose-50/50 border-rose-200 ring-1 ring-rose-200'
                                : 'bg-white border-slate-200'
                            }`}
                          >
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span
                                  className={`text-[9px] font-extrabold uppercase px-2 py-0.5 rounded ${
                                    isDone
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : r.status === 'ASSIGNED'
                                      ? 'bg-violet-100 text-violet-800 border border-violet-200'
                                      : isCritical
                                      ? 'bg-rose-100 text-rose-800'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {isDone ? 'RESOLVED' : r.status === 'ASSIGNED' ? 'ASSIGNED' : r.urgency} • {r.faultCategory}
                                </span>
                                {r.status === 'ASSIGNED' && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold bg-violet-50 text-violet-700 border border-violet-200">
                                    <UserCheck className="w-2.5 h-2.5 text-violet-600" />
                                    <span>Assigned by {r.assignedBy || (role === 'SENIOR_ELECTRICIAN' ? 'Senior Electrician' : 'Senior Mechanic')}</span>
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono">#{r.id}</span>
                            </div>

                            <div>
                              <div className="font-extrabold text-sm text-slate-900 font-mono">{r.machineId}</div>
                              <div className="text-[11px] text-slate-500">
                                {r.machineType} • <span className="font-semibold text-indigo-700">{r.line}</span>
                              </div>
                            </div>

                            <p className="text-[11px] text-slate-600 bg-white p-2 rounded-lg border border-slate-100">
                              {r.faultDetails}
                            </p>

                            <div className="flex items-center justify-between pt-1">
                              <span className="text-[10px] text-slate-400">Reported by: {r.reportedBy}</span>
                              {!isDone && (
                                <button
                                  onClick={() => handleOpenResolveModal(r)}
                                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                                >
                                  <Wrench className="w-3 h-3" />
                                  <span>Attend</span>
                                </button>
                              )}
                            </div>

                            {/* Direct 1-Click Move Buttons (Myself + Mechanics) */}
                            <div className="pt-2 border-t border-slate-200/60 space-y-1.5">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                  <ArrowRightLeft className="w-3 h-3 text-indigo-500" />
                                  <span>Move Task To:</span>
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  Assigned: <strong className="text-slate-800 font-bold">{r.attendedBy || 'Unassigned'}</strong>
                                  {r.assignedBy && (
                                    <span className="text-violet-700 font-medium ml-1">({r.assignedBy})</span>
                                  )}
                                </span>
                              </div>

                              {canSchedulePPM && !isDone && (
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {/* Direct Move to Floor Technicians */}
                                  {relevantTechnicians.map((mech) => {
                                    const isCurrent = textValue(r.attendedBy)?.toLowerCase().includes(textValue(mech.name).toLowerCase());
                                    const firstName = mech.name.split(' ')[0];

                                    return (
                                      <button
                                        key={mech.id}
                                        onClick={() => handleDirectMoveTask(r.id, mech.name)}
                                        className={`px-2 py-1 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer ${
                                          isCurrent
                                            ? 'bg-emerald-600 text-white shadow-xs ring-1 ring-emerald-500 font-extrabold'
                                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 hover:text-slate-900'
                                        }`}
                                        title={`Move task directly to ${mech.name} (${mech.role})`}
                                      >
                                        <span>{isCurrent ? `✓ ${firstName}` : `Move to ${firstName}`}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {/* PPMs */}
                      {group.ppms.map((ppm) => (
                        <div
                          key={ppm.id}
                          className="p-4 rounded-xl border border-blue-200 bg-blue-50/30 shadow-2xs space-y-2.5"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                              PPM • {ppm.frequency}
                            </span>
                            <span className="text-[10px] text-blue-600 font-bold">Every {ppm.intervalDays}d</span>
                          </div>

                          <div>
                            <div className="font-extrabold text-sm text-slate-900 font-mono">{ppm.machineId}</div>
                            <div className="text-[11px] text-slate-600">{ppm.task}</div>
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            <span className="text-[10px] text-slate-400">Due: {ppm.nextDue}</span>
                            <button
                              onClick={() => handleCompletePPM(ppm.id, ppm.task, ppm.machineId)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                            >
                              <CheckCheck className="w-3 h-3" />
                              <span>Complete</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}


      {/* 6. Attend & Resolve Repair Modal (With Downtime and Spare Parts Inventory Deduction) */}
      {isResolveOpen && selectedTicket && (
        <div className="fixed inset-0 z-[60] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 px-5 py-4 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center font-bold">
                  <Wrench className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold">Resolve Ticket & Log Spare Parts</h4>
                  <p className="text-[10px] text-slate-400">Ticket #{selectedTicket.id}</p>
                </div>
              </div>
              <button
                onClick={() => setIsResolveOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleResolveSubmit} className="p-5 space-y-4">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1.5">
                <div className="flex justify-between font-bold text-slate-800">
                  <span>{selectedTicket.machineId} ({selectedTicket.machineType})</span>
                  <span className="text-rose-600">{selectedTicket.faultCategory}</span>
                </div>
                <div className="text-[11px] text-slate-500">
                  Location: {selectedTicket.line} • {selectedTicket.faultDetails}
                </div>
                {selectedTicket.status === 'ASSIGNED' && (
                  <div className="pt-2 mt-1 border-t border-slate-200 flex items-center justify-between text-[11px] bg-violet-50/80 px-2.5 py-1.5 rounded-lg border border-violet-200 text-violet-900">
                    <span className="font-bold flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-violet-600" />
                      <span>Status: ASSIGNED ({selectedTicket.attendedBy || 'Technician'})</span>
                    </span>
                    <span className="font-semibold text-violet-700">
                      Assigned by: <strong>{selectedTicket.assignedBy || 'Senior Mechanic'}</strong>
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-bold text-emerald-950">
                      Auto-Calculated Downtime
                    </label>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded border border-emerald-300">
                      Auto
                    </span>
                  </div>
                  <div className="mt-1 flex items-baseline gap-1.5">
                    <span className="text-base font-mono font-black text-emerald-950">
                      {downtimeMinutes}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">minutes</span>
                  </div>
                  <div className="text-[10px] text-emerald-700 mt-0.5 font-medium">
                    Calculated automatically from work start to finish
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Attending Mechanic
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={user?.name || 'Ramesh Kumar'}
                    className="w-full px-3 py-2 text-xs bg-slate-100 border border-slate-200 rounded-xl font-medium text-slate-700 outline-none cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Root Cause & Action Taken *
                </label>
                <textarea
                  required
                  rows={2}
                  value={actionTaken}
                  onChange={(e) => setActionTaken(e.target.value)}
                  placeholder="e.g. Realigned upper looper clearance to 0.05mm, buffed feed dog edge, and oiled hook..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800"
                />
              </div>

              <div className="border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between mb-1.5 flex-wrap gap-1">
                  <div className="flex items-center gap-1.5">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Spare Parts Consumed
                    </label>
                    {detectedMachineCategory && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        🎯 {detectedMachineCategory} Spares
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAllSparesOverride(!showAllSparesOverride)}
                      className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold hover:underline cursor-pointer"
                    >
                      {showAllSparesOverride ? `Filtered (${compatibleSparesForResolve.length})` : `Show all (${spareParts.length})`}
                    </button>
                    <span className="text-[10px] text-slate-500 font-medium">
                      Auto-decrements Inventory
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-8">
                    <select
                      value={selectedPartId}
                      onChange={(e) => setSelectedPartId(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800 font-medium"
                    >
                      <option value="">None / No parts replaced</option>
                      {compatibleSparesForResolve.map((p) => (
                        <option key={p.partId} value={p.partId}>
                          [{p.machineType || 'GENERAL'}] {p.name} (Stock: {p.stock} {p.unit})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-4">
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={selectedPartQty}
                      onChange={(e) => setSelectedPartQty(parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 font-bold"
                      placeholder="Qty"
                    />
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Atomic transaction updates repair ticket, deducts stock, and marks machine ACTIVE.
                </span>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsResolveOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <CheckCheck className="w-4 h-4" />
                  <span>Complete Repair & Put In-Service</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Schedule Preventive Maintenance (PPM) Modal */}
      {isSchedulePPMOpen && (
        <div className="fixed inset-0 z-[60] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 px-5 py-4 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold">Schedule Preventive Maintenance</h4>
                  <p className="text-[10px] text-slate-400">Creates recurring PPM task on Cloud Calendar</p>
                </div>
              </div>
              <button
                onClick={() => setIsSchedulePPMOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePPMSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Target Machine *
                </label>
                <select
                  required
                  value={newPPMMachineId}
                  onChange={(e) => setNewPPMMachineId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800"
                >
                  {displayMachines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.id} - {m.brand} {m.model} ({m.area || m.currentLine})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  PPM Task Description *
                </label>
                <input
                  type="text"
                  required
                  value={newPPMTask}
                  onChange={(e) => setNewPPMTask(e.target.value)}
                  placeholder="e.g. Monthly Oil Filter Screen Cleaning & Wick Flush"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Frequency
                  </label>
                  <select
                    value={newPPMFrequency}
                    onChange={(e) => setNewPPMFrequency(e.target.value as typeof newPPMFrequency)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800 font-semibold"
                  >
                    <option value="Weekly">Weekly (7 Days)</option>
                    <option value="Monthly">Monthly (30 Days)</option>
                    <option value="6-Month">Semi-Annual (180 Days)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Scheduled Due Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={newPPMDueDate}
                    onChange={(e) => setNewPPMDueDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800 font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Assign Junior Technician *
                </label>
                <select
                  value={newPPMAssignee}
                  onChange={(e) => setNewPPMAssignee(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800 font-semibold"
                >
                  {relevantTechnicians.map((tech) => (
                    <option key={tech.name} value={tech.name}>
                      {tech.name} ({tech.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsSchedulePPMOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingPPM}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create PPM Schedule</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 8. Senior Mechanic: Team Work Schedule Pop-up Modal */}
      <TeamScheduleModal
        isOpen={isTeamModalOpen}
        onClose={() => setIsTeamModalOpen(false)}
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        repairs={scopedRepairs}
        ppmSchedules={scopedPpmSchedules}
        machines={displayMachines}
        onOpenResolveModal={handleOpenResolveModal}
      />

      {/* 9. Senior Supervisor: Assign / Move Task Desk Modal */}
      {isInlineDispatchOpen && (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-scale-in">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center font-bold shadow-md shadow-emerald-500/20">
                  <Zap className="w-5 h-5 fill-slate-950" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                    Assign / Move Task Desk
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Floor Dispatch
                    </span>
                  </h3>
                  <p className="text-xs text-slate-300">
                    Direct floor dispatch &amp; work order reassignment for floor supervisors
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsInlineDispatchOpen(false);
                  if (typeof window !== 'undefined') {
                    const url = new URL(window.location.href);
                    url.searchParams.delete('action');
                    url.searchParams.delete('tab');
                    url.searchParams.delete('assign');
                    window.history.replaceState({}, '', url.toString());
                  }
                }}
                className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 transition cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Tab Bar */}
            <div className="flex items-center border-b border-slate-200 bg-slate-50 px-4 sm:px-6 pt-2 shrink-0 gap-2">
              <button
                type="button"
                onClick={() => setDispatchTab('assign')}
                className={`flex items-center gap-2 pb-2.5 px-3 border-b-2 font-bold text-xs transition cursor-pointer ${
                  dispatchTab === 'assign'
                    ? 'border-emerald-600 text-emerald-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>⚡ Assign New Task</span>
              </button>

              <button
                type="button"
                onClick={() => setDispatchTab('move')}
                className={`flex items-center gap-2 pb-2.5 px-3 border-b-2 font-bold text-xs transition cursor-pointer ${
                  dispatchTab === 'move'
                    ? 'border-indigo-600 text-indigo-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>🔄 Move / Reassign Active Tasks</span>
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700">
                  {openTicketsForMove.length}
                </span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
              {dispatchTab === 'assign' ? (
                <form onSubmit={handleInlineAssignTask} className="space-y-4">
                  {/* Target Machine */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Target Machine / Station *
                    </label>
                    <select
                      value={inlineMachineId}
                      onChange={(e) => setInlineMachineId(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-slate-800 font-medium"
                    >
                      {displayMachines.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.id} - {m.brand} {m.model} ({m.area || m.currentLine})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Quick Preset Chips */}
                  <div>
                    <div className="text-[11px] font-semibold text-slate-500 mb-1.5 flex items-center gap-1">
                      <Tag className="w-3 h-3 text-emerald-600" />
                      <span>Quick Common Issue Presets:</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        'Looper & Needle Timing Out of Sync',
                        'Tension Disk Jam / Thread Snapping',
                        'Feed Dog Height & Pitch Alignment',
                        'Motor Bearing Noise / Overheating',
                        'Electrical Sensor / Pedal Interlock Fault',
                        'Oil Filter Screen Cleaning & Wick Flush',
                      ].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setInlineTaskTitle(preset)}
                          className="px-2.5 py-1 text-[11px] font-medium bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 rounded-lg border border-slate-200 transition cursor-pointer"
                        >
                          + {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Task Title / Fault Details */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Task Description / Fault Details *
                    </label>
                    <input
                      type="text"
                      required
                      value={inlineTaskTitle}
                      onChange={(e) => setInlineTaskTitle(e.target.value)}
                      placeholder="e.g. Needle bar loose, replace hook or adjust timing"
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-slate-800"
                    />
                  </div>

                  {/* Technician Assignee */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Assign To Technician *
                      </label>
                      <select
                        value={inlineAssignee}
                        onChange={(e) => setInlineAssignee(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-slate-800 font-semibold"
                      >
                        {relevantTechnicians.map((t) => (
                          <option key={t.id} value={t.name}>
                            {t.name} ({t.role} - {t.assignedLines})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Urgency */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Urgency Priority *
                      </label>
                      <select
                        value={inlineUrgency}
                        onChange={(e) => setInlineUrgency(e.target.value as RepairUrgency)}
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-slate-800 font-semibold"
                      >
                        <option value="NORMAL">NORMAL - Routine Maintenance</option>
                        <option value="WARNING">WARNING - Moderate Defect / Minor Delay</option>
                        <option value="CRITICAL">CRITICAL - Line Stopped / Emergency</option>
                      </select>
                    </div>
                  </div>

                  {/* Date & Shift */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Scheduled Date *
                      </label>
                      <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-slate-800 font-semibold"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Target Shift
                      </label>
                      <div className="px-3 py-2 text-xs bg-slate-100 border border-slate-200 rounded-xl text-slate-700 font-medium">
                        Shift A (07:00 - 15:30)
                      </div>
                    </div>
                  </div>

                  {/* Form Footer */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => setIsInlineDispatchOpen(false)}
                      className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingInline}
                      className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Zap className="w-4 h-4" />
                      <span>{isSubmittingInline ? 'Dispatching...' : 'Dispatch & Assign Work Order'}</span>
                    </button>
                  </div>
                </form>
              ) : (
                /* Move / Reassign Active Tasks Tab */
                <div className="space-y-3.5">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={moveSearchQuery}
                        onChange={(e) => setMoveSearchQuery(e.target.value)}
                        placeholder="Search active tickets by ID, machine, issue, or mechanic..."
                        className="w-full pl-8 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800"
                      />
                    </div>
                    <span className="text-xs text-slate-500 font-semibold whitespace-nowrap">
                      {filteredTicketsForMove.length} tickets
                    </span>
                  </div>

                  {filteredTicketsForMove.length === 0 ? (
                    <div className="py-12 text-center text-slate-500 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                      <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
                      <p className="text-xs font-semibold text-slate-700">No active tickets found</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        All work orders are completed or match no search query.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pr-1">
                      {filteredTicketsForMove.map((ticket) => {
                        const targetAssignee =
                          moveAssigneeMap[ticket.id] ||
                          relevantTechnicians[0]?.name ||
                          'Floor Mechanic';

                        return (
                          <div
                            key={ticket.id}
                            className="p-3.5 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200 transition space-y-2.5"
                          >
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold text-slate-900">
                                  #{ticket.id}
                                </span>
                                <span
                                  className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${
                                    ticket.urgency === 'CRITICAL'
                                      ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                      : ticket.urgency === 'WARNING'
                                      ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                      : 'bg-sky-100 text-sky-800 border border-sky-200'
                                  }`}
                                >
                                  {ticket.urgency}
                                </span>
                                <span className="text-[11px] font-bold text-slate-700">
                                  {ticket.machineId} ({ticket.line})
                                </span>
                              </div>

                              <div className="text-[11px] text-slate-500">
                                Assigned to:{' '}
                                <span className="font-bold text-slate-800">
                                  {ticket.attendedBy || 'Unassigned'}
                                </span>
                              </div>
                            </div>

                            <div className="text-xs text-slate-700">
                              <span className="font-semibold">{ticket.faultCategory}: </span>
                              <span>{ticket.faultDetails}</span>
                            </div>

                            <div className="pt-2 border-t border-slate-200/80 flex items-center justify-end gap-2 flex-wrap">
                              <div className="flex items-center gap-1.5 ml-auto">
                                <select
                                  value={targetAssignee}
                                  onChange={(e) =>
                                    setMoveAssigneeMap((prev) => ({
                                      ...prev,
                                      [ticket.id]: e.target.value,
                                    }))
                                  }
                                  className="px-2.5 py-1 text-xs bg-white border border-slate-300 rounded-lg outline-none text-slate-800 font-medium"
                                >
                                  {relevantTechnicians.map((t) => (
                                    <option key={t.id} value={t.name}>
                                      {t.name} ({t.assignedLines})
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  onClick={() => handleDirectMoveTask(ticket.id, targetAssignee)}
                                  className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition shadow-xs cursor-pointer"
                                >
                                  Dispatch to Technician
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
