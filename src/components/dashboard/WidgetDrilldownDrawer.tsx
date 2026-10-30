'use client';

import { textValue } from '@/lib/textValue';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  X,
  Search,
  Wrench,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  FileText,
  Package,
  IndianRupee,
  ArrowRight,
  ExternalLink,
  Calendar,
  Layers,
  Check,
  Truck,
  Armchair,
  Zap,
  Users,
  ShieldCheck,
} from 'lucide-react';
import type { Machine, RepairTicket, PPMSchedule, SparePart, PartRequisition } from '@/types/cmms';
import { FACTORY_MECHANICS_ROSTER, MechanicDuty, userToMechanicDuty } from '@/lib/constants/mechanics';

export type DrillDownType =
  | 'open_tickets'
  | 'on_schedule'
  | 'at_risk'
  | 'overdue'
  | 'resolved'
  | 'completed_tasks'
  | 'total_assets'
  | 'operational_assets'
  | 'breakdown_assets'
  | 'maintenance_assets'
  | 'buffer_assets'
  | 'pipeline_stage'
  | 'category_assets'
  | 'fault_category'
  | 'cost_analysis'
  | 'risk_analysis'
  | 'low_stock_parts'
  | 'pending_requisitions'
  | 'toolbox_kit'
  | 'duty_roster';

export interface DrillDownMeta {
  category?: string;
  stageKey?: string;
  fault?: string;
  riskLevel?: 'HIGH' | 'MEDIUM' | 'LOW';
  assignedTo?: string;
  filterDefault?: string;
  kitCode?: string;
  [key: string]: any;
}

interface WidgetDrilldownDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  type: DrillDownType | null;
  title?: string;
  meta?: DrillDownMeta;
  machines?: Machine[];
  repairs?: RepairTicket[];
  ppmSchedules?: PPMSchedule[];
  parts?: SparePart[];
  requisitions?: PartRequisition[];
}

export function WidgetDrilldownDrawer({
  isOpen,
  onClose,
  type,
  title,
  meta,
  machines = [],
  repairs = [],
  ppmSchedules = [],
  parts = [],
  requisitions = [],
}: WidgetDrilldownDrawerProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [liveRoster, setLiveRoster] = useState<MechanicDuty[]>(FACTORY_MECHANICS_ROSTER);

  // Fetch registered users when drawer opens for roster/toolbox
  useEffect(() => {
    if (isOpen && (type === 'duty_roster' || type === 'toolbox_kit')) {
      fetch('/api/users')
        .then((r) => r.json())
        .then((data) => {
          if (data.users && Array.isArray(data.users)) {
            const techs = data.users.filter((u: any) =>
              ['MECHANIC', 'SENIOR_MECHANIC', 'ELECTRICIAN', 'SENIOR_ELECTRICIAN'].includes(u.role)
            );
            if (techs.length > 0) {
              setLiveRoster(techs.map(userToMechanicDuty));
            }
          }
        })
        .catch(() => {});
    }
  }, [isOpen, type]);

  // Reset filters when drawer opens or type changes
  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setActiveFilter(meta?.filterDefault || 'all');
    }
  }, [isOpen, type, meta]);

  // Handle ESC key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // ─── Data Extraction & Filtering ─────────────────────────────────────
  const drawerData = useMemo(() => {
    if (!type) {
      return {
        categoryTitle: 'OPERATIONS DRILL-DOWN',
        mainTitle: 'Widget Drill-Down',
        kpiCards: [],
        filterPills: [],
        tableHeaders: [],
        rows: [],
        bottomAction: { label: 'View Master Records →', url: '/dashboard' },
      };
    }

    // 1. OPEN TICKETS
    if (type === 'open_tickets') {
      const open = repairs.filter((r) => r.status !== 'COMPLETED');
      const assignedToName = textValue(meta?.assignedTo)?.toLowerCase();
      const myOpen = assignedToName
        ? open.filter((r) => r.attendedBy && textValue(r.attendedBy).toLowerCase() === assignedToName)
        : [];
      const criticalCount = open.filter((r) => r.urgency === 'CRITICAL').length;
      const inProgressCount = open.filter((r) => r.status === 'IN_PROGRESS').length;
      const assignedCount = open.filter((r) => r.status === 'ASSIGNED').length;
      const pendingCount = open.filter((r) => r.status === 'PENDING').length;
      const totalDowntime = open.reduce((sum, r) => sum + (r.downtimeMinutes || 0), 0);
      const avgDowntime = open.length > 0 ? Math.round(totalDowntime / open.length) : 0;

      let filtered = open;
      if (activeFilter === 'my_tickets' || activeFilter === 'mine') {
        filtered = myOpen;
      } else if (activeFilter === 'critical') {
        filtered = open.filter((r) => r.urgency === 'CRITICAL');
      } else if (activeFilter === 'in_progress') {
        filtered = open.filter((r) => r.status === 'IN_PROGRESS');
      } else if (activeFilter === 'assigned') {
        filtered = open.filter((r) => r.status === 'ASSIGNED');
      } else if (activeFilter === 'pending') {
        filtered = open.filter((r) => r.status === 'PENDING');
      }

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        filtered = filtered.filter(
          (r) =>
            textValue(r.id).toLowerCase().includes(q) ||
            textValue(r.machineId).toLowerCase().includes(q) ||
            textValue(r.line).toLowerCase().includes(q) ||
            textValue(r.faultCategory)?.toLowerCase().includes(q) ||
            textValue(r.faultDetails)?.toLowerCase().includes(q) ||
            (r.attendedBy && textValue(r.attendedBy).toLowerCase().includes(q))
        );
      }

      const filterPills = [
        ...(assignedToName ? [{ id: 'my_tickets', label: `My Tickets (${myOpen.length})` }] : []),
        { id: 'all', label: `All (${open.length})` },
        { id: 'critical', label: `Critical (${criticalCount})` },
        { id: 'in_progress', label: `In Progress (${inProgressCount})` },
        { id: 'assigned', label: `Assigned (${assignedCount})` },
        { id: 'pending', label: `Pending (${pendingCount})` },
      ];

      return {
        categoryTitle: 'MAINTENANCE DRILL-DOWN',
        mainTitle: title || `Open Tickets: ${open.length}`,
        kpiCards: [
          { label: 'Total Open', value: open.length, color: 'text-indigo-600' },
          { label: 'Critical', value: criticalCount, color: 'text-rose-600' },
          { label: 'In Progress', value: inProgressCount, color: 'text-amber-600' },
          { label: 'Avg Downtime', value: `${avgDowntime}m`, color: 'text-slate-800' },
        ],
        filterPills,
        tableHeaders: ['TICKET ID', 'MACHINE & LINE', 'FAULT CATEGORY', 'PRIORITY', 'STAGE', 'ACTIONS'],
        rows: filtered.map((r) => ({
          id: r.id,
          col1: r.id,
          col2: `${r.machineId} • ${r.line}`,
          col3: r.faultCategory || 'Uncategorized',
          badge1: {
            text: r.urgency,
            bg: r.urgency === 'CRITICAL' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700',
          },
          badge2: {
            text: r.status.replace('_', ' '),
            bg:
              r.status === 'IN_PROGRESS'
                ? 'bg-amber-100 text-amber-800'
                : r.status === 'ASSIGNED'
                ? 'bg-blue-100 text-blue-800'
                : 'bg-slate-100 text-slate-800',
          },
          actionText: 'View Machine & Ticket',
          actionUrl: `/scan/${r.machineId}`,
        })),
        bottomAction: { label: 'Go to Floor Dashboard →', url: '/dashboard' },
      };
    }

    // 2. ON SCHEDULE (PPM)
    if (type === 'on_schedule') {
      const completed = ppmSchedules.filter((p) => p.status === 'COMPLETED').length;
      const dueSoon = ppmSchedules.filter((p) => p.status === 'DUE_SOON').length;
      const overdue = ppmSchedules.filter((p) => p.status === 'OVERDUE').length;
      const pending = ppmSchedules.filter((p) => p.status === 'PENDING').length;
      const complianceRate = ppmSchedules.length > 0 ? Math.round((completed / ppmSchedules.length) * 100) : 100;

      let filtered = ppmSchedules;
      if (activeFilter === 'completed') filtered = ppmSchedules.filter((p) => p.status === 'COMPLETED');
      else if (activeFilter === 'due_soon') filtered = ppmSchedules.filter((p) => p.status === 'DUE_SOON');
      else if (activeFilter === 'overdue') filtered = ppmSchedules.filter((p) => p.status === 'OVERDUE');
      else if (activeFilter === 'pending') filtered = ppmSchedules.filter((p) => p.status === 'PENDING');

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        filtered = filtered.filter(
          (p) =>
            textValue(p.id).toLowerCase().includes(q) ||
            textValue(p.machineId).toLowerCase().includes(q) ||
            textValue(p.task)?.toLowerCase().includes(q) ||
            textValue(p.frequency)?.toLowerCase().includes(q)
        );
      }

      return {
        categoryTitle: 'PREVENTIVE DRILL-DOWN',
        mainTitle: title || `PPM Schedules & Compliance: ${ppmSchedules.length}`,
        kpiCards: [
          { label: 'Total PPM', value: ppmSchedules.length, color: 'text-indigo-600' },
          { label: 'Completed', value: completed, color: 'text-emerald-600' },
          { label: 'Due Soon', value: dueSoon, color: 'text-blue-600' },
          { label: 'Compliance', value: `${complianceRate}%`, color: 'text-emerald-600' },
        ],
        filterPills: [
          { id: 'all', label: `All (${ppmSchedules.length})` },
          { id: 'completed', label: `Completed (${completed})` },
          { id: 'due_soon', label: `Due Soon (${dueSoon})` },
          { id: 'pending', label: `Pending (${pending})` },
          { id: 'overdue', label: `Overdue (${overdue})` },
        ],
        tableHeaders: ['SCHEDULE ID', 'MACHINE ID', 'TASK', 'FREQUENCY', 'STATUS', 'ACTIONS'],
        rows: filtered.map((p) => ({
          id: p.id,
          col1: p.id,
          col2: p.machineId,
          col3: p.task,
          badge1: { text: p.frequency, bg: 'bg-slate-100 text-slate-700' },
          badge2: {
            text: p.status.replace('_', ' '),
            bg:
              p.status === 'COMPLETED'
                ? 'bg-emerald-100 text-emerald-800'
                : p.status === 'DUE_SOON'
                ? 'bg-indigo-100 text-indigo-800'
                : p.status === 'OVERDUE'
                ? 'bg-rose-100 text-rose-800'
                : 'bg-slate-100 text-slate-700',
          },
          actionText: 'View Schedule',
          actionUrl: `/dashboard/calendar`,
        })),
        bottomAction: { label: 'Manage in Maintenance Schedule Calendar →', url: '/dashboard/calendar' },
      };
    }

    // 3. AT RISK TICKETS (>2h MTTR)
    if (type === 'at_risk') {
      const atRisk = repairs.filter(
        (r) => r.status !== 'COMPLETED' && (r.downtimeMinutes >= 120 || r.urgency === 'CRITICAL')
      );
      const criticalCount = atRisk.filter((r) => r.urgency === 'CRITICAL').length;
      const inProgressCount = atRisk.filter((r) => r.status === 'IN_PROGRESS').length;

      let filtered = atRisk;
      if (activeFilter === 'critical') filtered = atRisk.filter((r) => r.urgency === 'CRITICAL');
      else if (activeFilter === 'in_progress') filtered = atRisk.filter((r) => r.status === 'IN_PROGRESS');

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        filtered = filtered.filter(
          (r) =>
            textValue(r.id).toLowerCase().includes(q) ||
            textValue(r.machineId).toLowerCase().includes(q) ||
            textValue(r.line).toLowerCase().includes(q) ||
            textValue(r.faultCategory)?.toLowerCase().includes(q)
        );
      }

      return {
        categoryTitle: 'SLA & RISK DRILL-DOWN',
        mainTitle: title || `At Risk Tickets (>2h MTTR): ${atRisk.length}`,
        kpiCards: [
          { label: 'At Risk', value: atRisk.length, color: 'text-amber-600' },
          { label: 'Critical', value: criticalCount, color: 'text-rose-600' },
          { label: 'In Progress', value: inProgressCount, color: 'text-blue-600' },
          { label: 'SLA Target', value: '< 2h', color: 'text-slate-700' },
        ],
        filterPills: [
          { id: 'all', label: `All (${atRisk.length})` },
          { id: 'critical', label: `Critical (${criticalCount})` },
          { id: 'in_progress', label: `In Progress (${inProgressCount})` },
        ],
        tableHeaders: ['TICKET ID', 'MACHINE & LINE', 'DOWNTIME', 'PRIORITY', 'STATUS', 'ACTIONS'],
        rows: filtered.map((r) => ({
          id: r.id,
          col1: r.id,
          col2: `${r.machineId} • ${r.line}`,
          col3: `${r.downtimeMinutes || 0} mins elapsed`,
          badge1: {
            text: r.urgency,
            bg: r.urgency === 'CRITICAL' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800',
          },
          badge2: {
            text: 'At Risk',
            bg: 'bg-amber-100 text-amber-800 font-bold',
          },
          actionText: 'Accelerate',
          actionUrl: `/dashboard/calendar?ticketId=${r.id}`,
        })),
        bottomAction: { label: 'View in Repairs Master Page →', url: '/dashboard/calendar' },
      };
    }

    // 4. OVERDUE WORK ORDERS & PPM
    if (type === 'overdue') {
      const overduePpm = ppmSchedules.filter((p) => p.status === 'OVERDUE');
      const overdueTickets = repairs.filter(
        (r) => r.status !== 'COMPLETED' && (r.downtimeMinutes >= 240 || r.urgency === 'CRITICAL')
      );
      const totalOverdue = overduePpm.length + overdueTickets.length;

      let filteredTickets = overdueTickets;
      let filteredPpm = overduePpm;

      if (activeFilter === 'ppm') {
        filteredTickets = [];
      } else if (activeFilter === 'tickets') {
        filteredPpm = [];
      }

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        filteredTickets = filteredTickets.filter(
          (r) =>
            textValue(r.id).toLowerCase().includes(q) ||
            textValue(r.machineId).toLowerCase().includes(q) ||
            textValue(r.line).toLowerCase().includes(q)
        );
        filteredPpm = filteredPpm.filter(
          (p) =>
            textValue(p.id).toLowerCase().includes(q) ||
            textValue(p.machineId).toLowerCase().includes(q) ||
            textValue(p.task)?.toLowerCase().includes(q)
        );
      }

      const rows = [
        ...filteredTickets.map((r) => ({
          id: r.id,
          col1: r.id,
          col2: `${r.machineId} • ${r.line}`,
          col3: `Repair Ticket (${r.downtimeMinutes}m)`,
          badge1: { text: 'TICKET', bg: 'bg-rose-100 text-rose-800' },
          badge2: { text: 'OVERDUE', bg: 'bg-rose-600 text-white font-bold' },
          actionText: 'Attend Now',
          actionUrl: `/dashboard/calendar?ticketId=${r.id}`,
        })),
        ...filteredPpm.map((p) => ({
          id: p.id,
          col1: p.id,
          col2: p.machineId,
          col3: `PPM: ${p.task}`,
          badge1: { text: 'PPM', bg: 'bg-purple-100 text-purple-800' },
          badge2: { text: 'OVERDUE', bg: 'bg-rose-600 text-white font-bold' },
          actionText: 'Execute PPM',
          actionUrl: `/dashboard/calendar`,
        })),
      ];

      return {
        categoryTitle: 'ESCALATION DRILL-DOWN',
        mainTitle: title || `Overdue Work Orders & PPM: ${totalOverdue}`,
        kpiCards: [
          { label: 'Total Overdue', value: totalOverdue, color: 'text-rose-600' },
          { label: 'PPM Overdue', value: overduePpm.length, color: 'text-purple-600' },
          { label: 'Tickets > 4h', value: overdueTickets.length, color: 'text-rose-600' },
          { label: 'Resolution SLA', value: 'Immediate', color: 'text-amber-600' },
        ],
        filterPills: [
          { id: 'all', label: `All Overdue (${totalOverdue})` },
          { id: 'tickets', label: `Tickets (${overdueTickets.length})` },
          { id: 'ppm', label: `PPM (${overduePpm.length})` },
        ],
        tableHeaders: ['ITEM ID', 'EQUIPMENT / LINE', 'DESCRIPTION', 'TYPE', 'STATUS', 'ACTIONS'],
        rows,
        bottomAction: { label: 'Resolve Escalations in Calendar →', url: '/dashboard/calendar' },
      };
    }

    // 5. RESOLVED TODAY & COMPLETED
    if (type === 'resolved') {
      const completed = repairs.filter((r) => r.status === 'COMPLETED');
      const assignedToName = textValue(meta?.assignedTo)?.toLowerCase();
      const myResolved = assignedToName
        ? completed.filter((r) => r.attendedBy && textValue(r.attendedBy).toLowerCase() === assignedToName)
        : [];
      const totalDowntime = completed.reduce((sum, r) => sum + (r.downtimeMinutes || 0), 0);
      const avgMTTR = completed.length > 0 ? Math.round(totalDowntime / completed.length) : 0;
      const mechanical = completed.filter((r) => textValue(r.faultCategory)?.toLowerCase().includes('mechanical')).length;
      const electrical = completed.filter((r) => textValue(r.faultCategory)?.toLowerCase().includes('electrical')).length;

      let filtered = completed;
      if (activeFilter === 'my_resolved' || activeFilter === 'mine') {
        filtered = myResolved;
      } else if (activeFilter === 'mechanical') {
        filtered = completed.filter((r) => textValue(r.faultCategory)?.toLowerCase().includes('mechanical'));
      } else if (activeFilter === 'electrical') {
        filtered = completed.filter((r) => textValue(r.faultCategory)?.toLowerCase().includes('electrical'));
      }

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        filtered = filtered.filter(
          (r) =>
            textValue(r.id).toLowerCase().includes(q) ||
            textValue(r.machineId).toLowerCase().includes(q) ||
            textValue(r.line).toLowerCase().includes(q) ||
            textValue(r.actionTaken)?.toLowerCase().includes(q) ||
            (r.attendedBy && textValue(r.attendedBy).toLowerCase().includes(q))
        );
      }

      const filterPills = [
        ...(assignedToName ? [{ id: 'my_resolved', label: `My Resolved (${myResolved.length})` }] : []),
        { id: 'all', label: `All (${completed.length})` },
        { id: 'mechanical', label: `Mechanical (${mechanical})` },
        { id: 'electrical', label: `Electrical (${electrical})` },
      ];

      return {
        categoryTitle: 'PERFORMANCE DRILL-DOWN',
        mainTitle: title || `Resolved Work Orders & Repairs: ${completed.length}`,
        kpiCards: [
          { label: 'Total Resolved', value: completed.length, color: 'text-teal-600' },
          { label: 'Avg MTTR', value: `${avgMTTR}m`, color: 'text-indigo-600' },
          { label: 'Mechanical', value: mechanical, color: 'text-slate-800' },
          { label: 'Electrical', value: electrical, color: 'text-slate-800' },
        ],
        filterPills,
        tableHeaders: ['TICKET ID', 'MACHINE & LINE', 'ACTION TAKEN', 'DOWNTIME', 'STATUS', 'ACTIONS'],
        rows: filtered.map((r) => ({
          id: r.id,
          col1: r.id,
          col2: `${r.machineId} • ${r.line}`,
          col3: r.actionTaken || 'Repair completed and tested',
          badge1: { text: `${r.downtimeMinutes || 0}m`, bg: 'bg-slate-100 text-slate-700' },
          badge2: { text: 'COMPLETED', bg: 'bg-emerald-100 text-emerald-800 font-bold' },
          actionText: 'View Report',
          actionUrl: `/dashboard/calendar?ticketId=${r.id}`,
        })),
        bottomAction: { label: 'View Repairs History in Master Page →', url: '/dashboard/calendar' },
      };
    }

    // 5B. COMPLETED TASKS DRILL-DOWN (ALL COMPLETED WORK ORDERS + PPM ROUTINES)
    if (type === 'completed_tasks') {
      const completedRepairs = repairs.filter((r) => r.status === 'COMPLETED');
      const completedPpms = ppmSchedules.filter((p) => p.status === 'COMPLETED');
      const totalCompletedCount = completedRepairs.length + completedPpms.length;

      const totalDowntimeSaved = completedRepairs.reduce((sum, r) => sum + (r.downtimeMinutes || 0), 0);
      const totalRepairSpend = completedRepairs.reduce((sum, r) => sum + (r.repairCost || 0), 0);

      type UnifiedTask = {
        id: string;
        kind: 'REPAIR' | 'PPM';
        machineId: string;
        line: string;
        taskTitle: string;
        technician: string;
        durationMinutes: number;
        cost: number;
        completedAt: string;
        actionTaken: string;
        hasProof: boolean;
      };

      const unifiedList: UnifiedTask[] = [
        ...completedRepairs.map((r) => ({
          id: r.id,
          kind: 'REPAIR' as const,
          machineId: r.machineId,
          line: r.line,
          taskTitle: r.faultCategory,
          technician: r.attendedBy || 'Technician',
          durationMinutes: r.downtimeMinutes || 0,
          cost: r.repairCost || 0,
          completedAt: r.resolvedAt || r.completedAt || r.reportedAt,
          actionTaken: r.actionTaken || 'Repair completed and tested',
          hasProof: !!r.completionProofImage,
        })),
        ...completedPpms.map((p) => ({
          id: p.id,
          kind: 'PPM' as const,
          machineId: p.machineId,
          line: machines.find((m) => m.id === p.machineId)?.currentLine || 'Floor Line',
          taskTitle: p.task,
          technician: p.assignedTo || 'Technician',
          durationMinutes: p.actualDurationMinutes || 25,
          cost: 450,
          completedAt: p.completedAt || p.lastServiced,
          actionTaken: p.technicianNotes || 'PPM inspection & lubrication completed',
          hasProof: !!p.completionProofImage,
        })),
      ].sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());

      let filteredTasks = unifiedList;
      if (activeFilter === 'repairs') {
        filteredTasks = unifiedList.filter((t) => t.kind === 'REPAIR');
      } else if (activeFilter === 'ppm') {
        filteredTasks = unifiedList.filter((t) => t.kind === 'PPM');
      }

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        filteredTasks = filteredTasks.filter(
          (t) =>
            textValue(t.id).toLowerCase().includes(q) ||
            textValue(t.machineId).toLowerCase().includes(q) ||
            textValue(t.line).toLowerCase().includes(q) ||
            textValue(t.taskTitle).toLowerCase().includes(q) ||
            textValue(t.technician).toLowerCase().includes(q) ||
            textValue(t.actionTaken).toLowerCase().includes(q)
        );
      }

      return {
        categoryTitle: 'TASKS COMPLETED KPI BREAKDOWN',
        mainTitle: title || `Completed Tasks & Overhauls (${totalCompletedCount})`,
        kpiCards: [
          { label: 'Total Completed', value: totalCompletedCount, color: 'text-emerald-600' },
          { label: 'Repairs Fixed', value: completedRepairs.length, color: 'text-teal-600' },
          { label: 'PPM Done', value: completedPpms.length, color: 'text-indigo-600' },
          {
            label: 'Total Spend',
            value: totalRepairSpend > 0 ? `₹${totalRepairSpend.toLocaleString()}` : `${totalDowntimeSaved}m DT`,
            color: 'text-amber-600',
          },
        ],
        filterPills: [
          { id: 'all', label: `All Tasks (${totalCompletedCount})` },
          { id: 'repairs', label: `Repairs (${completedRepairs.length})` },
          { id: 'ppm', label: `Preventive PPM (${completedPpms.length})` },
        ],
        tableHeaders: ['TASK ID', 'ASSET & LINE', 'TECHNICIAN', 'ACTION & RESOLUTION', 'TIME & COST', 'STATUS', 'ACTIONS'],
        rows: filteredTasks.map((t) => ({
          id: t.id,
          col1: t.id,
          col2: `${t.machineId} • ${t.line}`,
          col3: t.technician,
          col4: t.actionTaken,
          badge1: {
            text: `${t.durationMinutes}m${t.cost > 0 ? ` • ₹${t.cost}` : ''}`,
            bg: 'bg-slate-100 text-slate-800 font-semibold',
          },
          badge2: {
            text: t.kind === 'REPAIR' ? 'REPAIR FIXED' : 'PPM DONE',
            bg: t.kind === 'REPAIR' ? 'bg-teal-100 text-teal-800 font-bold' : 'bg-indigo-100 text-indigo-800 font-bold',
          },
          actionText: 'View Proof',
          actionUrl: `/dashboard/calendar?ticketId=${t.id}`,
        })),
        bottomAction: { label: 'View Full Task History in Calendar Master →', url: '/dashboard/calendar' },
      };
    }

    // 6. TOTAL ASSETS / ASSET STATUS DRILL-DOWNS
    if (
      type === 'total_assets' ||
      type === 'operational_assets' ||
      type === 'breakdown_assets' ||
      type === 'maintenance_assets' ||
      type === 'buffer_assets' ||
      type === 'category_assets'
    ) {
      let baseList = machines;
      if (type === 'operational_assets') baseList = machines.filter((m) => m.status === 'ACTIVE');
      else if (type === 'breakdown_assets') baseList = machines.filter((m) => m.status === 'BREAKDOWN');
      else if (type === 'maintenance_assets') baseList = machines.filter((m) => m.status === 'UNDER_MAINTENANCE');
      else if (type === 'buffer_assets') baseList = machines.filter((m) => m.status === 'BUFFER');
      else if (type === 'category_assets' && meta?.category) {
        baseList = machines.filter((m) => {
          if (meta.category === 'MACHINE') return !m.category || m.category === 'MACHINE';
          if (meta.category === 'FURNITURE') return m.category === 'FURNITURE' || m.category === 'TABLE' || m.category === 'CHAIR';
          if (meta.category === 'UTILITY') return m.category === 'UTILITY' || m.category === 'LIGHT' || m.category === 'FAN';
          if (meta.category === 'VEHICLE') return m.category === 'VEHICLE';
          return m.category === meta.category;
        });
      }

      const activeCount = baseList.filter((m) => m.status === 'ACTIVE').length;
      const breakdownCount = baseList.filter((m) => m.status === 'BREAKDOWN').length;
      const maintCount = baseList.filter((m) => m.status === 'UNDER_MAINTENANCE').length;
      const bufferCount = baseList.filter((m) => m.status === 'BUFFER').length;
      const availPct = baseList.length > 0 ? Math.round((activeCount / baseList.length) * 100) : 100;

      let filtered = baseList;
      if (activeFilter === 'active') filtered = baseList.filter((m) => m.status === 'ACTIVE');
      else if (activeFilter === 'breakdown') filtered = baseList.filter((m) => m.status === 'BREAKDOWN');
      else if (activeFilter === 'maintenance') filtered = baseList.filter((m) => m.status === 'UNDER_MAINTENANCE');
      else if (activeFilter === 'buffer') filtered = baseList.filter((m) => m.status === 'BUFFER');

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        filtered = filtered.filter(
          (m) =>
            textValue(m.id).toLowerCase().includes(q) ||
            textValue(m.model)?.toLowerCase().includes(q) ||
            textValue(m.brand)?.toLowerCase().includes(q) ||
            textValue(m.currentLine)?.toLowerCase().includes(q) ||
            textValue(m.stationNo)?.toLowerCase().includes(q)
        );
      }

      return {
        categoryTitle: 'EQUIPMENT ASSET DRILL-DOWN',
        mainTitle: title || `Plant Asset Registry: ${baseList.length}`,
        kpiCards: [
          { label: 'Total Assets', value: baseList.length, color: 'text-indigo-600' },
          { label: 'Active', value: activeCount, color: 'text-emerald-600' },
          { label: 'Breakdown', value: breakdownCount, color: 'text-rose-600' },
          { label: 'Availability', value: `${availPct}%`, color: 'text-emerald-600' },
        ],
        filterPills: [
          { id: 'all', label: `All (${baseList.length})` },
          { id: 'active', label: `Active (${activeCount})` },
          { id: 'breakdown', label: `Breakdown (${breakdownCount})` },
          { id: 'maintenance', label: `Maintenance (${maintCount})` },
          { id: 'buffer', label: `Buffer (${bufferCount})` },
        ],
        tableHeaders: ['ASSET CODE', 'BRAND & MODEL', 'LINE & STATION', 'CATEGORY', 'STATUS', 'ACTIONS'],
        rows: filtered.map((m) => ({
          id: m.id,
          col1: m.id,
          col2: `${m.brand} ${m.model}`,
          col3: [m.unit, m.area || m.currentLine, m.stationNo].filter(Boolean).join(' • '),
          badge1: { text: m.category || 'MACHINE', bg: 'bg-slate-100 text-slate-700' },
          badge2: {
            text: m.status,
            bg:
              m.status === 'ACTIVE'
                ? 'bg-emerald-100 text-emerald-800'
                : m.status === 'BREAKDOWN'
                ? 'bg-rose-100 text-rose-800 font-bold'
                : m.status === 'UNDER_MAINTENANCE'
                ? 'bg-amber-100 text-amber-800'
                : 'bg-blue-100 text-blue-800',
          },
          actionText: 'View Asset',
          actionUrl: `/dashboard/machines?id=${m.id}`,
        })),
        bottomAction: { label: 'View in Equipment Registry Master Page →', url: '/dashboard/machines' },
      };
    }

    // 7. WORKFLOW PIPELINE STAGE
    if (type === 'pipeline_stage') {
      const stageKey = meta?.stageKey || 'logged';
      let stageRepairs = repairs;
      let stagePpm: PPMSchedule[] = [];
      let stageReqs: PartRequisition[] = [];

      if (stageKey === 'logged') stageRepairs = repairs.filter((r) => r.status === 'PENDING');
      else if (stageKey === 'assigned') stageRepairs = repairs.filter((r) => r.status === 'ASSIGNED');
      else if (stageKey === 'in_progress') stageRepairs = repairs.filter((r) => r.status === 'IN_PROGRESS');
      else if (stageKey === 'ppm_due') {
        stageRepairs = [];
        stagePpm = ppmSchedules.filter((p) => p.status === 'DUE_SOON' || p.status === 'PENDING');
      } else if (stageKey === 'ppm_overdue') {
        stageRepairs = [];
        stagePpm = ppmSchedules.filter((p) => p.status === 'OVERDUE');
      } else if (stageKey === 'awaiting_parts') {
        stageRepairs = [];
        stageReqs = requisitions.filter((r) => r.status.startsWith('PENDING'));
      } else if (stageKey === 'qa_signoff') {
        stageRepairs = repairs.filter((r) => r.status === 'COMPLETED').slice(0, 3);
      } else if (stageKey === 'resolved') {
        stageRepairs = repairs.filter((r) => r.status === 'COMPLETED');
      }

      const totalItems = stageRepairs.length + stagePpm.length + stageReqs.length;

      const rows = [
        ...stageRepairs.map((r) => ({
          id: r.id,
          col1: r.id,
          col2: `${r.machineId} • ${r.line}`,
          col3: r.faultCategory || 'Repair Work Order',
          badge1: { text: r.urgency, bg: r.urgency === 'CRITICAL' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700' },
          badge2: { text: r.status, bg: 'bg-indigo-100 text-indigo-800' },
          actionText: 'Open Ticket',
          actionUrl: `/dashboard/calendar?ticketId=${r.id}`,
        })),
        ...stagePpm.map((p) => ({
          id: p.id,
          col1: p.id,
          col2: p.machineId,
          col3: `PPM: ${p.task}`,
          badge1: { text: p.frequency, bg: 'bg-purple-100 text-purple-700' },
          badge2: { text: p.status, bg: 'bg-indigo-100 text-indigo-800' },
          actionText: 'View PPM',
          actionUrl: `/dashboard/calendar`,
        })),
        ...stageReqs.map((req) => ({
          id: req.id,
          col1: req.id,
          col2: `For Machine: ${req.targetMachineId || 'General'}`,
          col3: `Parts Requisition: ${req.items?.length || 1} item(s)`,
          badge1: { text: `₹${(req.estimatedCost || 0).toLocaleString()}`, bg: 'bg-slate-100 text-slate-800' },
          badge2: { text: req.status, bg: 'bg-amber-100 text-amber-800' },
          actionText: 'View Indent',
          actionUrl: `/dashboard/requisition`,
        })),
      ];

      return {
        categoryTitle: 'PIPELINE STAGE DRILL-DOWN',
        mainTitle: title || `Workflow Stage: ${stageKey.toUpperCase()}`,
        kpiCards: [
          { label: 'Stage Items', value: totalItems, color: 'text-indigo-600' },
          { label: 'Work Orders', value: stageRepairs.length, color: 'text-blue-600' },
          { label: 'PPM Tasks', value: stagePpm.length, color: 'text-purple-600' },
          { label: 'Requisitions', value: stageReqs.length, color: 'text-amber-600' },
        ],
        filterPills: [{ id: 'all', label: `All Stage Items (${totalItems})` }],
        tableHeaders: ['RECORD ID', 'EQUIPMENT / TARGET', 'DETAILS', 'TYPE / VALUE', 'STAGE', 'ACTIONS'],
        rows,
        bottomAction: { label: 'View Pipeline in Calendar / Repairs →', url: '/dashboard/calendar' },
      };
    }

    // 8. FAULT CATEGORY / ROOT CAUSE DRILL-DOWN
    if (type === 'fault_category') {
      const fault = meta?.fault || 'Mechanical';
      const faultRepairs = repairs.filter((r) =>
        textValue(r.faultCategory)?.toLowerCase().includes(fault.toLowerCase())
      );
      const totalDowntime = faultRepairs.reduce((s, r) => s + (r.downtimeMinutes || 0), 0);
      const criticalCount = faultRepairs.filter((r) => r.urgency === 'CRITICAL').length;
      const completedCount = faultRepairs.filter((r) => r.status === 'COMPLETED').length;

      return {
        categoryTitle: 'ROOT CAUSE ANALYSIS DRILL-DOWN',
        mainTitle: title || `${fault} Faults Breakdown: ${faultRepairs.length}`,
        kpiCards: [
          { label: 'Total Incidents', value: faultRepairs.length, color: 'text-indigo-600' },
          { label: 'Total Downtime', value: `${totalDowntime}m`, color: 'text-rose-600' },
          { label: 'Critical', value: criticalCount, color: 'text-amber-600' },
          { label: 'Resolved', value: completedCount, color: 'text-emerald-600' },
        ],
        filterPills: [
          { id: 'all', label: `All (${faultRepairs.length})` },
          { id: 'critical', label: `Critical (${criticalCount})` },
          { id: 'completed', label: `Resolved (${completedCount})` },
        ],
        tableHeaders: ['TICKET ID', 'MACHINE & LINE', 'DETAILS', 'DOWNTIME', 'STATUS', 'ACTIONS'],
        rows: faultRepairs.map((r) => ({
          id: r.id,
          col1: r.id,
          col2: `${r.machineId} • ${r.line}`,
          col3: r.faultDetails || r.faultCategory,
          badge1: { text: `${r.downtimeMinutes}m`, bg: 'bg-slate-100 text-slate-700' },
          badge2: { text: r.status, bg: r.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800' },
          actionText: 'Open Ticket',
          actionUrl: `/dashboard/calendar?ticketId=${r.id}`,
        })),
        bottomAction: { label: 'Analyze Root Causes in Master Page →', url: '/dashboard/calendar' },
      };
    }

    // 9. COST & EXPENDITURE ANALYSIS
    if (type === 'cost_analysis') {
      const totalPlantCost = machines.reduce((sum, m) => sum + (m.cost || 45000), 0);
      const totalReqCost = requisitions.reduce((sum, r) => sum + (r.estimatedCost || 0), 0);

      return {
        categoryTitle: 'FINANCIAL & CAPEX DRILL-DOWN',
        mainTitle: title || 'Plant Cost & Expenditure Breakdown',
        kpiCards: [
          { label: 'Asset Capital Value', value: `₹${(totalPlantCost / 100000).toFixed(1)}L`, color: 'text-indigo-600' },
          { label: 'Maintenance Spend', value: `₹${(totalReqCost / 1000).toFixed(0)}k`, color: 'text-amber-600' },
          { label: 'Asset Count', value: machines.length, color: 'text-slate-800' },
          { label: 'Cost Efficiency', value: '96.4%', color: 'text-emerald-600' },
        ],
        filterPills: [
          { id: 'all', label: `All Assets (${machines.length})` },
        ],
        tableHeaders: ['ASSET ID', 'EQUIPMENT / MODEL', 'LINE LOCATION', 'CAPITAL VALUE', 'STATUS', 'ACTIONS'],
        rows: machines.slice(0, 50).map((m) => ({
          id: m.id,
          col1: m.id,
          col2: `${m.brand} ${m.model}`,
          col3: m.area || m.currentLine,
          badge1: { text: `₹${(m.cost || 45000).toLocaleString()}`, bg: 'bg-emerald-50 text-emerald-700 font-bold' },
          badge2: { text: m.status, bg: 'bg-slate-100 text-slate-800' },
          actionText: 'View Valuation',
          actionUrl: `/dashboard/machines?id=${m.id}`,
        })),
        bottomAction: { label: 'View Full Asset Capex Registry →', url: '/dashboard/machines' },
      };
    }

    // 10. LOW STOCK SPARE PARTS
    if (type === 'low_stock_parts') {
      const lowStock = parts.filter((p) => p.stock <= p.minStock);

      return {
        categoryTitle: 'INVENTORY & STORE DRILL-DOWN',
        mainTitle: title || `Low Stock Spare Parts: ${lowStock.length}`,
        kpiCards: [
          { label: 'Low Stock Items', value: lowStock.length, color: 'text-rose-600' },
          { label: 'Total Catalog', value: parts.length, color: 'text-indigo-600' },
          { label: 'Critical Threshold', value: 'Min Stock', color: 'text-slate-700' },
          { label: 'Pending Reqs', value: requisitions.length, color: 'text-purple-600' },
        ],
        filterPills: [{ id: 'all', label: `Low Stock (${lowStock.length})` }],
        tableHeaders: ['PART ID & SKU', 'NAME & COMPATIBILITY', 'CATEGORY', 'CURRENT STOCK', 'STATUS', 'ACTIONS'],
        rows: lowStock.map((p) => ({
          id: p.partId,
          col1: `${p.partId} • ${p.sku}`,
          col2: p.name,
          col3: p.category,
          badge1: { text: `${p.stock} / ${p.minStock} min`, bg: 'bg-rose-100 text-rose-800 font-bold' },
          badge2: { text: 'REORDER NEEDED', bg: 'bg-amber-100 text-amber-800 font-bold' },
          actionText: 'Reorder Part',
          actionUrl: `/dashboard/requisition`,
        })),
        bottomAction: { label: 'Create Purchase Requisition in Store →', url: '/dashboard/requisition' },
      };
    }

    // 11. PENDING REQUISITIONS
    if (type === 'pending_requisitions') {
      const pending = requisitions.filter((r) => r.status.startsWith('PENDING'));

      return {
        categoryTitle: 'APPROVALS & REQUISITIONS DRILL-DOWN',
        mainTitle: title || `Pending Parts Requisitions: ${pending.length}`,
        kpiCards: [
          { label: 'Pending Indents', value: pending.length, color: 'text-amber-600' },
          { label: 'Total Requisitions', value: requisitions.length, color: 'text-indigo-600' },
          { label: 'CEO Approval', value: pending.filter((r) => r.status.includes('CEO')).length, color: 'text-purple-600' },
          { label: 'Manager Review', value: pending.filter((r) => r.status.includes('MANAGER')).length, color: 'text-blue-600' },
        ],
        filterPills: [{ id: 'all', label: `Pending Indents (${pending.length})` }],
        tableHeaders: ['REQUISITION ID', 'TARGET MACHINE', 'REQUESTED BY', 'EST. COST', 'APPROVAL STATUS', 'ACTIONS'],
        rows: pending.map((req) => ({
          id: req.id,
          col1: req.id,
          col2: req.targetMachineId || 'Plant Floor',
          col3: req.requestedBy || 'Store Supervisor',
          badge1: { text: `₹${(req.estimatedCost || 0).toLocaleString()}`, bg: 'bg-slate-100 text-slate-800 font-bold' },
          badge2: { text: req.status.replace(/_/g, ' '), bg: 'bg-amber-100 text-amber-800' },
          actionText: 'Review Indent',
          actionUrl: `/dashboard/requisition`,
        })),
        bottomAction: { label: 'Manage Approvals in Store Desk →', url: '/dashboard/requisition' },
      };
    }

    // 12. TOOLBOX KIT & CUSTODY ITEMS
    if (type === 'toolbox_kit') {
      const kitCode = meta?.kitCode || 'TBX-MEC-08';
      const mechanic =
        liveRoster.find(
          (m) =>
            m.toolbox?.kitCode === kitCode ||
            (meta?.assignedTo && textValue(m.name).toLowerCase() === textValue(meta.assignedTo).toLowerCase())
        ) || liveRoster[0];

      if (!mechanic || !mechanic.toolbox) {
        return {
          categoryTitle: 'TOOL CUSTODY & AUDIT',
          mainTitle: 'Technician Toolbox Kit & Calibration',
          badge: 'Empty Toolkit',
          badgeColor: 'bg-slate-100 text-slate-700',
          kpiCards: [
            { label: 'Assigned Tools', value: 0, color: 'text-slate-800' },
            { label: 'Checked Out', value: 0, color: 'text-amber-600' },
            { label: 'Parts Drawn', value: 0, color: 'text-indigo-600' },
          ],
          filterPills: [{ id: 'all', label: 'All Items (0)' }],
          tableHeaders: ['TOOL CODE / SN', 'NAME & SPECIFICATION', 'CUSTODY & LOCATION', 'CALIBRATION', 'STATUS', 'ACTIONS'],
          rows: [],
          bottomAction: { label: 'Indent Spares or Tools in Crib Catalog →', url: '/dashboard/inventory' },
        };
      }

      const kit = mechanic.toolbox;
      const checkedOut = mechanic.checkedOutTools || [];
      const partsDrawn = mechanic.activePartsDrawn || [];

      let rows: Array<{
        id: string;
        col1: string;
        col2: string;
        col3: string;
        badge1: { text: string; bg: string };
        badge2: { text: string; bg: string };
        actionText: string;
        actionUrl: string;
      }> = [];

      if (activeFilter === 'checked_out') {
        rows = checkedOut.map((tool) => ({
          id: tool.id,
          col1: tool.id,
          col2: `${tool.toolName} (${tool.serialNo})`,
          col3: `Due: ${tool.returnDue} • Loc: ${tool.location}`,
          badge1: { text: tool.condition, bg: 'bg-emerald-100 text-emerald-800' },
          badge2: { text: tool.category, bg: 'bg-blue-100 text-blue-800' },
          actionText: 'Audit Tool',
          actionUrl: '/dashboard/inventory',
        }));
      } else if (activeFilter === 'parts_drawn') {
        rows = partsDrawn.map((p) => ({
          id: p.partId,
          col1: p.sku,
          col2: p.partName,
          col3: `Qty: ${p.quantity} ${p.unit} • For Machine: ${p.forMachineId}`,
          badge1: { text: p.line, bg: 'bg-indigo-100 text-indigo-800' },
          badge2: { text: 'ISSUED', bg: 'bg-emerald-100 text-emerald-800' },
          actionText: 'View Indent',
          actionUrl: '/dashboard/inventory',
        }));
      } else {
        // all tools in kit + custody
        rows = [
          ...kit.items.map((item, idx) => ({
            id: `TOOL-${idx + 1}`,
            col1: `${kit.kitCode}-0${idx + 1}`,
            col2: item,
            col3: `Calibrated Kit: ${kit.kitName}`,
            badge1: { text: 'CALIBRATED', bg: 'bg-emerald-100 text-emerald-800 font-bold' },
            badge2: { text: 'IN TOOLBOX', bg: 'bg-slate-100 text-slate-800' },
            actionText: 'Check Tool',
            actionUrl: '/dashboard/inventory',
          })),
          ...checkedOut.map((tool) => ({
            id: tool.id,
            col1: tool.serialNo,
            col2: tool.toolName,
            col3: `Custody Loan • Due: ${tool.returnDue}`,
            badge1: { text: tool.condition, bg: 'bg-cyan-100 text-cyan-800' },
            badge2: { text: 'CHECKED OUT', bg: 'bg-amber-100 text-amber-800 font-bold' },
            actionText: 'Audit Tool',
            actionUrl: '/dashboard/inventory',
          })),
        ];
      }

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        rows = rows.filter(
          (r) =>
            textValue(r.col1).toLowerCase().includes(q) ||
            textValue(r.col2).toLowerCase().includes(q) ||
            textValue(r.col3).toLowerCase().includes(q)
        );
      }

      return {
        categoryTitle: 'TOOLBOX & ASSET CUSTODY',
        mainTitle: title || `Toolbox Kit: ${kit.kitCode} (${mechanic.name})`,
        kpiCards: [
          { label: 'Kit Code', value: kit.kitCode, color: 'text-indigo-600' },
          { label: 'Standard Tools', value: kit.items.length, color: 'text-slate-800' },
          { label: 'Loaned Tools', value: checkedOut.length, color: 'text-amber-600' },
          { label: 'Drawn Spares', value: partsDrawn.length, color: 'text-emerald-600' },
        ],
        filterPills: [
          { id: 'all', label: `All Tools (${kit.items.length + checkedOut.length})` },
          { id: 'checked_out', label: `Loaned Tools (${checkedOut.length})` },
          { id: 'parts_drawn', label: `Drawn Spares (${partsDrawn.length})` },
        ],
        tableHeaders: ['TOOL CODE / SN', 'NAME & SPECIFICATION', 'CUSTODY & LOCATION', 'CALIBRATION', 'STATUS', 'ACTIONS'],
        rows,
        bottomAction: { label: 'Indent Spares or Tools in Crib Catalog →', url: '/dashboard/inventory' },
      };
    }

    // 13. ON-DUTY MECHANIC & TECHNICIAN ROSTER
    if (type === 'duty_roster') {
      const roster = liveRoster;
      const onDuty = roster.filter((m) => m.status === 'ON_DUTY').length;
      const standby = roster.filter((m) => m.status === 'STANDBY').length;
      const mechanicsCount = roster.filter((m) => m.trade === 'MECHANIC').length;
      const electriciansCount = roster.filter((m) => m.trade === 'ELECTRICIAN').length;

      let filtered = roster;
      if (activeFilter === 'on_duty') filtered = roster.filter((m) => m.status === 'ON_DUTY');
      else if (activeFilter === 'standby') filtered = roster.filter((m) => m.status === 'STANDBY');
      else if (activeFilter === 'mechanic') filtered = roster.filter((m) => m.trade === 'MECHANIC');
      else if (activeFilter === 'electrician') filtered = roster.filter((m) => m.trade === 'ELECTRICIAN');

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        filtered = filtered.filter(
          (m) =>
            textValue(m.name).toLowerCase().includes(q) ||
            textValue(m.role).toLowerCase().includes(q) ||
            textValue(m.assignedLines).toLowerCase().includes(q) ||
            textValue(m.specialty).toLowerCase().includes(q)
        );
      }

      return {
        categoryTitle: 'FLOOR WORKFORCE & ROSTER',
        mainTitle: title || `Technician Duty Roster: ${roster.length} Staff`,
        kpiCards: [
          { label: 'Total Technicians', value: roster.length, color: 'text-slate-800' },
          { label: 'On Duty', value: onDuty, color: 'text-emerald-600' },
          { label: 'Standby / Relief', value: standby, color: 'text-amber-600' },
          { label: 'Electricians', value: electriciansCount, color: 'text-indigo-600' },
        ],
        filterPills: [
          { id: 'all', label: `All (${roster.length})` },
          { id: 'on_duty', label: `On Duty (${onDuty})` },
          { id: 'standby', label: `Standby (${standby})` },
          { id: 'mechanic', label: `Mechanics (${mechanicsCount})` },
          { id: 'electrician', label: `Electricians (${electriciansCount})` },
        ],
        tableHeaders: ['NAME & ID', 'TRADE & ROLE', 'ASSIGNED LINES', 'PHONE / CONTACT', 'STATUS', 'ACTIONS'],
        rows: filtered.map((m) => ({
          id: m.id,
          col1: `${m.name} (${m.id})`,
          col2: `${m.trade || 'MECHANIC'} • ${m.specialty}`,
          col3: `${m.assignedLines} • Kit: ${m.toolbox.kitCode}`,
          badge1: { text: m.phone, bg: 'bg-slate-100 text-slate-800 font-mono' },
          badge2: {
            text: m.status.replace('_', ' '),
            bg: m.status === 'ON_DUTY' ? 'bg-emerald-100 text-emerald-800 font-bold' : 'bg-amber-100 text-amber-800',
          },
          actionText: 'View Roster',
          actionUrl: '/dashboard/mechanic-roster',
        })),
        bottomAction: { label: 'Open Shift Allocation & Roster Desk →', url: '/dashboard/mechanic-roster' },
      };
    }

    // Fallback
    return {
      categoryTitle: 'OPERATIONS DRILL-DOWN',
      mainTitle: title || 'Widget Drill-Down',
      kpiCards: [],
      filterPills: [],
      tableHeaders: [],
      rows: [],
      bottomAction: { label: 'View Master Records →', url: '/dashboard' },
    };
  }, [type, title, meta, machines, repairs, ppmSchedules, parts, requisitions, activeFilter, searchTerm]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden select-none animate-fade-in">
      {/* ─── Backdrop ─────────────────────────────────────────────────── */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300"
      />

      {/* ─── Slide-over Right Panel ──────────────────────────────────── */}
      <div className="fixed inset-y-0 right-0 z-50 w-full sm:max-w-2xl md:max-w-3xl lg:max-w-4xl bg-white shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out">
        {/* TOP BAR: Title & Close Button */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-start justify-between bg-white shrink-0">
          <div>
            <span className="text-[11px] font-bold text-slate-400 tracking-wider uppercase block mb-1">
              {drawerData.categoryTitle}
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {drawerData.mainTitle}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl border border-slate-200 text-slate-400 hover:text-slate-800 hover:bg-slate-50 flex items-center justify-center transition cursor-pointer shrink-0 ml-4"
            title="Close drill-down panel (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* DRAWER CONTENT (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* 1. 4 KPI Summary Cards Grid */}
          {drawerData.kpiCards && drawerData.kpiCards.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {drawerData.kpiCards.map((kpi, idx) => (
                <div
                  key={idx}
                  className="bg-white rounded-2xl border border-slate-200/90 p-3.5 shadow-2xs flex flex-col justify-between"
                >
                  <span className="text-xs font-medium text-slate-500">{kpi.label}</span>
                  <span className={`text-xl sm:text-2xl font-black font-mono mt-1 ${kpi.color || 'text-slate-900'}`}>
                    {kpi.value}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* 2. Filter Pills & Search Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            {/* Filter Pills */}
            {drawerData.filterPills && drawerData.filterPills.length > 1 && (
              <div className="flex items-center flex-wrap gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                {drawerData.filterPills.map((pill) => {
                  const isActive = activeFilter === pill.id;
                  return (
                    <button
                      key={pill.id}
                      onClick={() => setActiveFilter(pill.id)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                      }`}
                    >
                      {pill.label}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Quick Search Box */}
            <div className="relative min-w-[200px] sm:max-w-[260px] w-full">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search records..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500 focus:bg-white transition"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* 3. Detailed Records Table */}
          <div className="bg-white rounded-lg border border-slate-300 shadow-2xs max-h-[500px] flex flex-col overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto">
              <table className="w-full text-left border-collapse border border-slate-300 text-xs">
                <thead className="sticky top-0 bg-slate-100 border-b border-slate-300 z-10 shadow-2xs select-none">
                  <tr className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                    {drawerData.tableHeaders.map((head, idx) => (
                      <th
                        key={idx}
                        className={`py-2 px-3 bg-slate-100 border-r border-b border-slate-300 ${idx === drawerData.tableHeaders.length - 1 ? 'text-right border-r-0' : ''}`}
                      >
                        {head}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {drawerData.rows.length === 0 ? (
                    <tr>
                      <td colSpan={drawerData.tableHeaders.length} className="p-8 text-center text-slate-400 border-b border-slate-200">
                        No matching records found for this drill-down.
                      </td>
                    </tr>
                  ) : (
                    drawerData.rows.map((row) => (
                      <tr key={row.id} className="hover:bg-blue-50/60 even:bg-slate-50/40 transition group">
                        <td
                          onClick={() => {
                            onClose();
                            router.push(row.actionUrl);
                          }}
                          className="py-1.5 px-3 border-r border-b border-slate-200 font-bold text-indigo-600 font-mono cursor-pointer hover:underline"
                          title="Click to view details in Calendar"
                        >
                          {row.col1}
                        </td>
                        <td className="py-1.5 px-3 border-r border-b border-slate-200 font-medium text-slate-800">
                          {row.col2}
                        </td>
                        <td className="py-1.5 px-3 border-r border-b border-slate-200 text-slate-600 truncate max-w-[200px]">
                          {row.col3}
                        </td>
                        {row.badge1 && (
                          <td className="py-1.5 px-3 border-r border-b border-slate-200">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${row.badge1.bg}`}>
                              {row.badge1.text}
                            </span>
                          </td>
                        )}
                        {row.badge2 && (
                          <td className="py-1.5 px-3 border-r border-b border-slate-200">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${row.badge2.bg}`}>
                              {row.badge2.text}
                            </span>
                          </td>
                        )}
                        <td className="py-1.5 px-3 border-b border-slate-200 text-right">
                          <button
                            onClick={() => {
                              onClose();
                              router.push(row.actionUrl);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 hover:text-indigo-800 transition cursor-pointer"
                          >
                            <span>{row.actionText}</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* 4. STICKY BOTTOM ACTION BANNER (Matching Screenshot) */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-white shrink-0">
          <button
            onClick={() => {
              onClose();
              router.push(drawerData.bottomAction.url);
            }}
            className="w-full py-3 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-md hover:shadow-lg transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>{drawerData.bottomAction.label}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
