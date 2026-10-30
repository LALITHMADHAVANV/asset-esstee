'use client';

import { textValue } from '@/lib/textValue';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  TrendingUp,
  Plus,
  X,
  CheckCircle2,
  XCircle,
  Package,
  Cpu,
  Briefcase,
  Bell,
  Wrench,
  ShieldAlert,
  Clock,
  AlertTriangle,
  Users,
  Activity,
  Check,
  Radio,
  ArrowUpRight,
  Flame,
  Calendar,
  Truck,
  Armchair,
  Zap,
  ClipboardList,
  Timer,
  BarChart3,
  Eye,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ArrowRight,
  FileText,
  CircleDot,
  Target,
  Gauge,
  Settings,
  PieChart,
  ChevronRight,
} from 'lucide-react';
import type { Machine, RepairTicket, PPMSchedule, SparePart, PartRequisition } from '@/types/cmms';
import { WidgetDrilldownDrawer, DrillDownType, DrillDownMeta } from './WidgetDrilldownDrawer';
import { LineAvailabilityWidget } from './LineAvailabilityWidget';
import { MaintenanceMilestonesAndTasks } from './MaintenanceMilestonesAndTasks';
import { SupervisorFloorWorkspace } from './SupervisorFloorWorkspace';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { completePPMTask } from '@/lib/services/cmmsService';

interface WorkflowStage {
  key: string;
  label: string;
  icon: React.ReactNode;
  count: number;
  color: string;
  bgColor: string;
  borderColor: string;
}

interface ActivityItem {
  id: string;
  text: string;
  time: string;
  iconBg: string;
  iconColor: string;
  icon: 'check' | 'pulse' | 'alert' | 'wrench' | 'clock' | 'truck' | 'package';
}

interface PlantOperationsDashboardProps {
  machines: Machine[];
  repairs: RepairTicket[];
  ppmSchedules: PPMSchedule[];
  parts: SparePart[];
  requisitions: PartRequisition[];
  lastRefresh: Date;
  onRefresh: () => void;
  isLoading?: boolean;
}

function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

function describeDonutSlice(
  x: number,
  y: number,
  rOut: number,
  rIn: number,
  startAngle: number,
  endAngle: number
) {
  const delta = endAngle - startAngle;
  if (delta >= 359.9) {
    return [
      `M ${x} ${y - rOut}`,
      `A ${rOut} ${rOut} 0 1 1 ${x} ${y + rOut}`,
      `A ${rOut} ${rOut} 0 1 1 ${x} ${y - rOut}`,
      `M ${x} ${y - rIn}`,
      `A ${rIn} ${rIn} 0 1 0 ${x} ${y + rIn}`,
      `A ${rIn} ${rIn} 0 1 0 ${x} ${y - rIn}`,
      'Z',
    ].join(' ');
  }

  const startOut = polarToCartesian(x, y, rOut, endAngle);
  const endOut = polarToCartesian(x, y, rOut, startAngle);
  const startIn = polarToCartesian(x, y, rIn, startAngle);
  const endIn = polarToCartesian(x, y, rIn, endAngle);

  const largeArcFlag = delta <= 180 ? 0 : 1;

  return [
    `M ${endOut.x} ${endOut.y}`,
    `A ${rOut} ${rOut} 0 ${largeArcFlag} 1 ${startOut.x} ${startOut.y}`,
    `L ${endIn.x} ${endIn.y}`,
    `A ${rIn} ${rIn} 0 ${largeArcFlag} 0 ${startIn.x} ${startIn.y}`,
    'Z',
  ].join(' ');
}

export function PlantOperationsDashboard({
  machines,
  repairs,
  ppmSchedules,
  parts,
  requisitions,
  lastRefresh,
  onRefresh,
  isLoading = false,
}: PlantOperationsDashboardProps) {
  const router = useRouter();
  const { user, role } = useAuth();
  const { showToast } = useToast();
  const companySlug = textValue((user?.companySlug || 'esstee')).toLowerCase();
  const [isLogBreakdownModalOpen, setIsLogBreakdownModalOpen] = useState(false);

  const handleQuickCompletePPM = async (ppmId: string, machineId: string) => {
    try {
      await completePPMTask(ppmId, user?.name || 'Plant Administrator');
      showToast(`PPM Inspection on ${machineId} marked completed!`, 'success');
      onRefresh();
    } catch {
      showToast('Failed to complete PPM task', 'error');
    }
  };

  const [pipelineCollapsed, setPipelineCollapsed] = useState(false);
  const [activeCostCategory, setActiveCostCategory] = useState<string | null>(null);
  const [cardMode, setCardMode] = useState<'cost' | 'risk'>('cost');
  const [costTab, setCostTab] = useState<'cost' | 'line'>('cost');
  const [hoveredPieKey, setHoveredPieKey] = useState<string | null>(null);
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

  // ─── Derived metrics ──────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const totalAssets = machines.length;
    const activeMachines = machines.filter((m) => m.status === 'ACTIVE').length;
    const breakdownMachines = machines.filter((m) => m.status === 'BREAKDOWN').length;
    const underMaintenance = machines.filter((m) => m.status === 'UNDER_MAINTENANCE').length;
    const bufferMachines = machines.filter((m) => m.status === 'BUFFER').length;

    const openTickets = repairs.filter((r) => r.status !== 'COMPLETED').length;
    const pendingTickets = repairs.filter((r) => r.status === 'PENDING').length;
    const assignedTickets = repairs.filter((r) => r.status === 'ASSIGNED').length;
    const inProgressTickets = repairs.filter((r) => r.status === 'IN_PROGRESS').length;
    const completedTickets = repairs.filter((r) => r.status === 'COMPLETED').length;
    const criticalTickets = repairs.filter((r) => r.urgency === 'CRITICAL' && r.status !== 'COMPLETED').length;

    const totalDowntimeMins = repairs.reduce((s, r) => s + (r.downtimeMinutes || 0), 0);
    const completedWithDowntime = repairs.filter((r) => r.status === 'COMPLETED' && r.downtimeMinutes > 0);
    const avgMTTR = completedWithDowntime.length > 0
      ? Math.round(completedWithDowntime.reduce((s, r) => s + r.downtimeMinutes, 0) / completedWithDowntime.length)
      : 0;

    const ppmCompleted = ppmSchedules.filter((p) => p.status === 'COMPLETED').length;
    const ppmTotal = ppmSchedules.length;
    const ppmComplianceRate = ppmTotal > 0 ? Math.round((ppmCompleted / ppmTotal) * 100) : 0;
    const ppmDueSoon = ppmSchedules.filter((p) => p.status === 'DUE_SOON').length;
    const ppmOverdue = ppmSchedules.filter((p) => p.status === 'OVERDUE').length;
    const ppmPending = ppmSchedules.filter((p) => p.status === 'PENDING').length;

    const lowStockParts = parts.filter((p) => p.stock <= p.minStock).length;
    const pendingReqs = requisitions.filter((r) =>
      r.status === 'PENDING_CEO_APPROVAL' || r.status === 'PENDING_MANAGER_APPROVAL' || r.status === 'PENDING_REVIEW'
    ).length;

    const operationalPct = totalAssets > 0 ? Math.round((activeMachines / totalAssets) * 100) : 0;
    const breakdownPct = totalAssets > 0 ? Math.round((breakdownMachines / totalAssets) * 100) : 0;
    const maintenancePct = totalAssets > 0 ? Math.round((underMaintenance / totalAssets) * 100) : 0;
    const bufferPct = totalAssets > 0 ? Math.round((bufferMachines / totalAssets) * 100) : 0;

    // Category breakdown counts
    const sewingMachineCount = machines.filter((m) => m.category === 'MACHINE' || !m.category).length;
    const furnitureCount = machines.filter((m) => m.category === 'FURNITURE' || m.category === 'TABLE' || m.category === 'CHAIR').length;
    const utilityCount = machines.filter((m) => m.category === 'UTILITY' || m.category === 'LIGHT' || m.category === 'FAN').length;
    const vehicleCount = machines.filter((m) => m.category === 'VEHICLE').length;

    // Category ticket counts
    const sewingTickets = repairs.filter((r) => {
      const mch = machines.find((m) => m.id === r.machineId);
      return !mch || mch.category === 'MACHINE' || !mch.category;
    }).length;
    const furnitureTickets = repairs.filter((r) => {
      const mch = machines.find((m) => m.id === r.machineId);
      return mch && (mch.category === 'FURNITURE' || mch.category === 'TABLE' || mch.category === 'CHAIR');
    }).length;
    const utilityTickets = repairs.filter((r) => {
      const mch = machines.find((m) => m.id === r.machineId);
      return mch && (mch.category === 'UTILITY' || mch.category === 'LIGHT' || mch.category === 'FAN');
    }).length;
    const vehicleTickets = repairs.filter((r) => {
      const mch = machines.find((m) => m.id === r.machineId);
      return mch && mch.category === 'VEHICLE';
    }).length;

    // SLA check (tickets open > 120 mins considered at risk)
    const atRiskTickets = repairs.filter((r) => r.status !== 'COMPLETED' && r.downtimeMinutes > 120).length;
    const overdueTickets = repairs.filter((r) => r.status !== 'COMPLETED' && r.downtimeMinutes > 240).length;

    // Breakdown fault categories
    const mechanicalFaults = repairs.filter((r) =>
      textValue(r.faultCategory)?.toLowerCase().includes('needle') ||
      textValue(r.faultCategory)?.toLowerCase().includes('hook') ||
      textValue(r.faultCategory)?.toLowerCase().includes('feed') ||
      textValue(r.faultCategory)?.toLowerCase().includes('mechanical') ||
      textValue(r.faultCategory)?.toLowerCase().includes('tension') ||
      textValue(r.faultCategory)?.toLowerCase().includes('skip') ||
      textValue(r.faultCategory)?.toLowerCase().includes('break')
    ).length;
    const electricalFaults = repairs.filter((r) =>
      textValue(r.faultCategory)?.toLowerCase().includes('motor') ||
      textValue(r.faultCategory)?.toLowerCase().includes('electric') ||
      textValue(r.faultCategory)?.toLowerCase().includes('servo') ||
      textValue(r.faultCategory)?.toLowerCase().includes('sensor') ||
      textValue(r.faultCategory)?.toLowerCase().includes('pedal')
    ).length;
    const otherFaults = Math.max(0, repairs.length - mechanicalFaults - electricalFaults);

    const totalFaults = repairs.length;
    const mechanicalPct = totalFaults > 0 ? Math.round((mechanicalFaults / totalFaults) * 100) : 0;
    const electricalPct = totalFaults > 0 ? Math.round((electricalFaults / totalFaults) * 100) : 0;
    const otherPct = totalFaults > 0 ? Math.max(0, 100 - mechanicalPct - electricalPct) : 0;

    return {
      totalAssets, activeMachines, breakdownMachines, underMaintenance, bufferMachines,
      openTickets, pendingTickets, assignedTickets, inProgressTickets, completedTickets, criticalTickets,
      totalDowntimeMins, avgMTTR,
      ppmCompleted, ppmTotal, ppmComplianceRate, ppmDueSoon, ppmOverdue, ppmPending,
      lowStockParts, pendingReqs,
      operationalPct, breakdownPct, maintenancePct, bufferPct,
      sewingMachineCount, furnitureCount, utilityCount, vehicleCount,
      sewingTickets, furnitureTickets, utilityTickets, vehicleTickets,
      atRiskTickets, overdueTickets,
      mechanicalPct, electricalPct, otherPct,
    };
  }, [machines, repairs, ppmSchedules, parts, requisitions]);

  // ─── Workflow pipeline stages ──────────────────────────────────────────
  const workflowStages: WorkflowStage[] = useMemo(() => [
    { key: 'logged', label: 'Ticket Logged', icon: <FileText className="w-3.5 h-3.5" />, count: metrics.pendingTickets, color: 'text-slate-700', bgColor: 'bg-slate-50', borderColor: 'border-slate-200' },
    { key: 'assigned', label: 'Assigned', icon: <Users className="w-3.5 h-3.5" />, count: metrics.assignedTickets, color: 'text-blue-700', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
    { key: 'in_progress', label: 'Repair In Progress', icon: <Wrench className="w-3.5 h-3.5" />, count: metrics.inProgressTickets, color: 'text-amber-700', bgColor: 'bg-amber-50', borderColor: 'border-amber-200' },
    { key: 'ppm_due', label: 'PPM Due', icon: <Calendar className="w-3.5 h-3.5" />, count: metrics.ppmDueSoon + metrics.ppmPending, color: 'text-indigo-700', bgColor: 'bg-indigo-50', borderColor: 'border-indigo-200' },
    { key: 'ppm_overdue', label: 'PPM Overdue', icon: <AlertTriangle className="w-3.5 h-3.5" />, count: metrics.ppmOverdue, color: 'text-rose-700', bgColor: 'bg-rose-50', borderColor: 'border-rose-200' },
    { key: 'awaiting_parts', label: 'Awaiting Spares', icon: <Package className="w-3.5 h-3.5" />, count: metrics.pendingReqs, color: 'text-purple-700', bgColor: 'bg-purple-50', borderColor: 'border-purple-200' },
    { key: 'qa_signoff', label: 'QC Verification', icon: <CheckCircle2 className="w-3.5 h-3.5" />, count: repairs.filter((r) => r.status === 'COMPLETED' && textValue(r.actionTaken)?.toLowerCase().includes('qc')).length, color: 'text-teal-700', bgColor: 'bg-teal-50', borderColor: 'border-teal-200' },
    { key: 'resolved', label: 'Resolved & Closed', icon: <Check className="w-3.5 h-3.5" />, count: metrics.completedTickets, color: 'text-emerald-700', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200' },
  ], [metrics]);

  // ─── Cost Efficiency by Category Donut Data ──────────────────────────
  const costEfficiencyData = useMemo(() => {
    const categories: Record<
      string,
      {
        key: string;
        name: string;
        shortName: string;
        cost: number;
        count: number;
        color: string;
        bg: string;
      }
    > = {
      MACHINE: {
        key: 'MACHINE',
        name: 'Sewing & Industrial Machinery',
        shortName: 'Machinery',
        cost: 0,
        count: 0,
        color: '#6366f1', // Indigo
        bg: 'bg-indigo-500',
      },
      FURNITURE: {
        key: 'FURNITURE',
        name: 'Work Tables & Chairs',
        shortName: 'Furniture',
        cost: 0,
        count: 0,
        color: '#f59e0b', // Amber
        bg: 'bg-amber-500',
      },
      UTILITY: {
        key: 'UTILITY',
        name: 'Plant Utilities & Lights',
        shortName: 'Utilities',
        cost: 0,
        count: 0,
        color: '#06b6d4', // Cyan
        bg: 'bg-cyan-500',
      },
      VEHICLE: {
        key: 'VEHICLE',
        name: 'Vehicles & Forklifts',
        shortName: 'Vehicles',
        cost: 0,
        count: 0,
        color: '#a855f7', // Purple
        bg: 'bg-purple-500',
      },
    };

    // Calculate asset capital values
    machines.forEach((m) => {
      let cat = 'MACHINE';
      if (m.category === 'VEHICLE') cat = 'VEHICLE';
      else if (m.category === 'UTILITY' || m.category === 'LIGHT' || m.category === 'FAN') cat = 'UTILITY';
      else if (m.category === 'FURNITURE' || m.category === 'TABLE' || m.category === 'CHAIR') cat = 'FURNITURE';

      const baseCost = m.cost && m.cost > 0 ? m.cost : 0;

      categories[cat].cost += baseCost;
      categories[cat].count += 1;
    });

    // Add spare parts & maintenance spend by category from requisitions
    requisitions.forEach((req) => {
      const mch = machines.find((m) => m.id === req.targetMachineId);
      let cat = 'MACHINE';
      if (mch) {
        if (mch.category === 'VEHICLE') cat = 'VEHICLE';
        else if (mch.category === 'UTILITY' || mch.category === 'LIGHT' || mch.category === 'FAN') cat = 'UTILITY';
        else if (mch.category === 'FURNITURE' || mch.category === 'TABLE' || mch.category === 'CHAIR') cat = 'FURNITURE';
      }
      categories[cat].cost += req.estimatedCost || 0;
    });

    const totalPlantCost =
      Object.values(categories).reduce((sum, item) => sum + item.cost, 0) || 1;

    // Calculate percentage and start offsets for SVG circle strokes
    let cumulativePercent = 0;
    const segments = Object.values(categories).map((item) => {
      const percentage = Math.round((item.cost / totalPlantCost) * 1000) / 10;
      const startPercent = cumulativePercent;
      cumulativePercent += percentage;

      return {
        ...item,
        percentage,
        startPercent,
      };
    });

    return {
      totalPlantCost,
      totalAssetsCount: machines.length,
      segments,
    };
  }, [machines, requisitions]);

  // ─── Risk Analysis Data (Dynamic from live repairs & PPM) ─────────────
  const riskAnalysisData = useMemo(() => {
    const high = repairs.filter((r) => r.urgency === 'CRITICAL' && r.status !== 'COMPLETED').length +
      ppmSchedules.filter((p) => p.status === 'OVERDUE').length;

    const medium = repairs.filter((r) => r.status !== 'COMPLETED' && r.urgency !== 'CRITICAL').length +
      ppmSchedules.filter((p) => p.status === 'DUE_SOON' || p.status === 'PENDING').length;

    const low = repairs.filter((r) => r.status === 'COMPLETED').length +
      ppmSchedules.filter((p) => p.status === 'COMPLETED').length;

    const total = high + medium + low;

    return {
      total,
      high,
      medium,
      low,
    };
  }, [repairs, ppmSchedules]);

  // ─── Cost Analysis Pie Chart Data (Dynamic Live Data from machines) ──
  const liveCategoryData = useMemo(() => {
    // 1. Sewing & Industrial Machinery
    const sewingMachines = machines.filter((m) => !m.category || m.category === 'MACHINE');
    const sewingCost = sewingMachines.reduce((sum, m) => sum + (m.cost || 0), 0);

    // 2. Work & Cutting Tables
    const tableMachines = machines.filter(
      (m) =>
        m.category === 'TABLE' ||
        (m.category === 'FURNITURE' &&
          (m.type?.includes('TABLE') ||
            textValue(m.name)?.toLowerCase().includes('table') ||
            textValue(m.model)?.toLowerCase().includes('desk') ||
            textValue(m.model)?.toLowerCase().includes('table')))
    );
    const tableCost = tableMachines.reduce((sum, m) => sum + (m.cost || 0), 0);

    // 3. Chairs & Seating
    const chairMachines = machines.filter(
      (m) =>
        m.category === 'CHAIR' ||
        (m.category === 'FURNITURE' &&
          !(
            m.type?.includes('TABLE') ||
            textValue(m.name)?.toLowerCase().includes('table') ||
            textValue(m.model)?.toLowerCase().includes('desk') ||
            textValue(m.model)?.toLowerCase().includes('table')
          ))
    );
    const chairCost = chairMachines.reduce((sum, m) => sum + (m.cost || 0), 0);

    // 4. Plant Utilities
    const utilityMachines = machines.filter(
      (m) =>
        m.category === 'UTILITY' ||
        m.type?.includes('UTILITY') ||
        m.type?.includes('COMPRESSOR') ||
        m.type?.includes('BOILER')
    );
    const utilityCost = utilityMachines.reduce((sum, m) => sum + (m.cost || 0), 0);

    // 5. Lighting & Ventilation
    const lightMachines = machines.filter(
      (m) =>
        m.category === 'LIGHT' ||
        m.category === 'FAN' ||
        m.type?.includes('LIGHT') ||
        m.type?.includes('FAN')
    );
    const lightCost = lightMachines.reduce((sum, m) => sum + (m.cost || 0), 0);

    // 6. Vehicles & Transport
    const vehicleMachines = machines.filter(
      (m) => m.category === 'VEHICLE' || m.type?.includes('VEHICLE')
    );
    const vehicleCost = vehicleMachines.reduce((sum, m) => sum + (m.cost || 0), 0);

    return [
      {
        key: 'MACHINE',
        label: 'Sewing Machinery',
        count: sewingMachines.length,
        cost: sewingCost,
        color: '#0d9488', // Teal
        catKey: 'MACHINE',
      },
      {
        key: 'TABLE',
        label: 'Work Tables',
        count: tableMachines.length,
        cost: tableCost,
        color: '#2563eb', // Blue
        catKey: 'FURNITURE',
      },
      {
        key: 'CHAIR',
        label: 'Chairs & Seating',
        count: chairMachines.length,
        cost: chairCost,
        color: '#7c3aed', // Purple
        catKey: 'FURNITURE',
      },
      {
        key: 'UTILITY',
        label: 'Plant Utilities',
        count: utilityMachines.length,
        cost: utilityCost,
        color: '#d97706', // Amber
        catKey: 'UTILITY',
      },
      {
        key: 'ELECTRICAL',
        label: 'Lighting & Fans',
        count: lightMachines.length,
        cost: lightCost,
        color: '#dc2626', // Red
        catKey: 'UTILITY',
      },
      {
        key: 'VEHICLE',
        label: 'Vehicles & Transport',
        count: vehicleMachines.length,
        cost: vehicleCost,
        color: '#64748b', // Slate
        catKey: 'VEHICLE',
      },
    ];
  }, [machines]);

  const liveLineData = useMemo(() => {
    const lines = [
      { key: 'Line 01', label: 'Line 01', color: '#0d9488' },
      { key: 'Line 02', label: 'Line 02', color: '#2563eb' },
      { key: 'Line 03', label: 'Line 03', color: '#7c3aed' },
      { key: 'Line 04', label: 'Line 04', color: '#dc2626' },
      { key: 'Buffer Workshop', label: 'Buffer Bay', color: '#d97706' },
      { key: 'Cutting Department', label: 'Cutting Bay', color: '#64748b' },
    ];

    return lines.map((l) => {
      const lineMachines = machines.filter(
        (m) => m.currentLine === l.key || (!m.currentLine && l.key === 'Line 01')
      );
      const lineCost = lineMachines.reduce((sum, m) => sum + (m.cost || 0), 0);
      return {
        key: l.key,
        label: l.label,
        count: lineMachines.length,
        cost: lineCost,
        color: l.color,
        catKey: undefined as string | undefined,
      };
    });
  }, [machines]);

  // ─── Dynamic Weekly SLA Chart Data ──────────────────────────────────────
  const weeklySlaData = useMemo(() => {
    const days = [
      { day: 'Mon', dayNum: 1, x: 35 },
      { day: 'Tue', dayNum: 2, x: 105 },
      { day: 'Wed', dayNum: 3, x: 175 },
      { day: 'Thu', dayNum: 4, x: 245 },
      { day: 'Fri', dayNum: 5, x: 315 },
      { day: 'Sat', dayNum: 6, x: 385 },
      { day: 'Sun', dayNum: 0, x: 455 },
    ];

    return days.map((d) => {
      const dayTickets = repairs.filter((r) => {
        if (!r.reportedAt) return false;
        const dt = new Date(r.reportedAt);
        return dt.getDay() === d.dayNum;
      });
      const fixed = dayTickets.filter((r) => r.status === 'COMPLETED').length;
      return {
        day: d.day,
        total: dayTickets.length,
        fixed,
        x: d.x,
      };
    });
  }, [repairs]);

  const resolvedSlaPct = useMemo(() => {
    if (repairs.length === 0) return 100;
    const resolvedOnTime = repairs.filter(
      (r) => r.status === 'COMPLETED' && (r.downtimeMinutes <= 120 || !r.downtimeMinutes)
    ).length;
    return Math.round((resolvedOnTime / repairs.length) * 100);
  }, [repairs]);

  // ─── Dynamic Downtime Causes Breakdown ──────────────────────────────────
  const downtimeCauses = useMemo(() => {
    const totalRepairs = repairs.length;
    if (totalRepairs === 0) {
      return [
        { label: 'Looper / Needle Timing', pct: 0, color: 'bg-rose-500', fault: 'Looper' },
        { label: 'Motor / Electronic Drive', pct: 0, color: 'bg-amber-500', fault: 'Motor' },
        { label: 'Pneumatic & Air Lines', pct: 0, color: 'bg-blue-500', fault: 'Pneumatic' },
        { label: 'Operator Error / Jams', pct: 0, color: 'bg-slate-400', fault: 'Operator' },
      ];
    }

    const looperCount = repairs.filter(
      (r) =>
        textValue(r.faultCategory)?.toLowerCase().includes('needle') ||
        textValue(r.faultCategory)?.toLowerCase().includes('looper') ||
        textValue(r.faultCategory)?.toLowerCase().includes('timing') ||
        textValue(r.faultCategory)?.toLowerCase().includes('stitch')
    ).length;

    const motorCount = repairs.filter(
      (r) =>
        textValue(r.faultCategory)?.toLowerCase().includes('motor') ||
        textValue(r.faultCategory)?.toLowerCase().includes('drive') ||
        textValue(r.faultCategory)?.toLowerCase().includes('electrical') ||
        textValue(r.faultCategory)?.toLowerCase().includes('electronic')
    ).length;

    const pneumaticCount = repairs.filter(
      (r) =>
        textValue(r.faultCategory)?.toLowerCase().includes('pneumatic') ||
        textValue(r.faultCategory)?.toLowerCase().includes('air') ||
        textValue(r.faultCategory)?.toLowerCase().includes('pressure')
    ).length;

    const operatorCount = repairs.filter(
      (r) =>
        textValue(r.faultCategory)?.toLowerCase().includes('operator') ||
        textValue(r.faultCategory)?.toLowerCase().includes('jam') ||
        textValue(r.faultCategory)?.toLowerCase().includes('fabric')
    ).length;

    const sumIdentified = looperCount + motorCount + pneumaticCount + operatorCount || 1;

    return [
      { label: 'Looper / Needle Timing', pct: Math.round((looperCount / sumIdentified) * 100), color: 'bg-rose-500', fault: 'Looper' },
      { label: 'Motor / Electronic Drive', pct: Math.round((motorCount / sumIdentified) * 100), color: 'bg-amber-500', fault: 'Motor' },
      { label: 'Pneumatic & Air Lines', pct: Math.round((pneumaticCount / sumIdentified) * 100), color: 'bg-blue-500', fault: 'Pneumatic' },
      { label: 'Operator Error / Jams', pct: Math.round((operatorCount / sumIdentified) * 100), color: 'bg-slate-400', fault: 'Operator' },
    ];
  }, [repairs]);

  const activePieList = costTab === 'cost' ? liveCategoryData : liveLineData;
  const totalPieCount = activePieList.reduce((sum, item) => sum + item.count, 0);
  const hoveredPieItem = hoveredPieKey ? activePieList.find((i) => i.key === hoveredPieKey) : null;

  // Clockwise slice order for items with count > 0
  const pieChartSlices = useMemo(() => {
    if (totalPieCount === 0) return [];

    const nonZeroItems = activePieList.filter((item) => item.count > 0);
    let currentAngle = 12;

    return nonZeroItems.map((item) => {
      const angleDelta = (item.count / totalPieCount) * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angleDelta;
      currentAngle = endAngle;

      return {
        ...item,
        startAngle,
        endAngle,
      };
    });
  }, [activePieList, totalPieCount]);

  return (
    <div className="space-y-4 pb-12 animate-fade-in">
      {/* ================================================================= */}
      {/* 1. TOP HEADER & FILTER BAR                                       */}
      {/* ================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-transparent py-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
            <Gauge className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">Keep the floor flowing.</h1>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Sync
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Your equipment, maintenance, and team performance at a glance.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">

          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer disabled:opacity-50"
            title="Refresh dashboard data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{lastRefresh ? lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Refresh'}</span>
          </button>

          <button
            onClick={() => setIsLogBreakdownModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-700 text-white transition shadow-xs cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Log Breakdown</span>
          </button>
        </div>
      </div>

      {/* ================================================================= */}
      {/* 2. TOP METRIC CARDS ROW (6 COLUMNS)                              */}
      {/* ================================================================= */}
      <div className="overview-metrics grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-3.5">
        {/* Open Work Orders */}
        <div
          onClick={() => openDrillDown('open_tickets', 'Open Maintenance Tickets & Work Orders')}
          className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs hover:border-indigo-400 hover:shadow-sm transition cursor-pointer group"
          title="Click to view all open tickets in slide-over drawer"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider group-hover:text-indigo-600 transition">Open Tickets</span>
            <span className="p-1 rounded-lg bg-indigo-50 text-indigo-600 group-hover:scale-110 transition">
              <Wrench className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">{metrics.openTickets}</div>
          <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
            <span className="text-rose-600 font-semibold">{metrics.criticalTickets} critical</span>
            <span>•</span>
            <span>{metrics.inProgressTickets} active</span>
          </div>
        </div>

        {/* On Schedule (PPM + Assigned) */}
        <div
          onClick={() => openDrillDown('completed_tasks', 'Completed Maintenance Tasks (PPM Routines)', { filterDefault: 'ppm' })}
          className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs hover:border-emerald-400 hover:shadow-sm transition cursor-pointer group"
          title="Click to view completed PPM tasks in detailed pop up"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider group-hover:text-emerald-600 transition">On Schedule</span>
            <span className="p-1 rounded-lg bg-emerald-50 text-emerald-600 group-hover:scale-110 transition">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-2xl font-black text-emerald-600 font-mono">{metrics.ppmCompleted}</div>
          <div className="text-[10px] text-slate-500 mt-1">
            {metrics.ppmComplianceRate}% PPM compliance
          </div>
        </div>

        {/* At Risk (Tickets > 2h) */}
        <div
          onClick={() => openDrillDown('at_risk', 'At Risk Tickets (>2h MTTR)')}
          className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs hover:border-amber-400 hover:shadow-sm transition cursor-pointer group"
          title="Click to view At Risk tickets drill-down"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider group-hover:text-amber-600 transition">At Risk</span>
            <span className="p-1 rounded-lg bg-amber-50 text-amber-600 group-hover:scale-110 transition">
              <AlertTriangle className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-2xl font-black text-amber-600 font-mono">{metrics.atRiskTickets}</div>
          <div className="text-[10px] text-slate-500 mt-1">
            Exceeding 2h MTTR
          </div>
        </div>

        {/* Overdue (PPM Overdue + Tickets > 4h) */}
        <div
          onClick={() => openDrillDown('overdue', 'Overdue Work Orders & PPM Tasks')}
          className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs hover:border-rose-400 hover:shadow-sm transition cursor-pointer group"
          title="Click to view Overdue items drill-down"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider group-hover:text-rose-600 transition">Overdue</span>
            <span className="p-1 rounded-lg bg-rose-50 text-rose-600 group-hover:scale-110 transition">
              <Clock className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-2xl font-black text-rose-600 font-mono">{metrics.ppmOverdue + metrics.overdueTickets}</div>
          <div className="text-[10px] text-slate-500 mt-1">
            {metrics.ppmOverdue} PPM overdue
          </div>
        </div>

        {/* Resolved Today / Total Resolved */}
        <div
          onClick={() => openDrillDown('completed_tasks', 'Completed Breakdown & Repair Work Orders', { filterDefault: 'repairs' })}
          className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs hover:border-teal-400 hover:shadow-sm transition cursor-pointer group"
          title="Click to view completed repair tasks in detailed pop up"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider group-hover:text-teal-600 transition">Resolved</span>
            <span className="p-1 rounded-lg bg-teal-50 text-teal-600 group-hover:scale-110 transition">
              <Check className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">{metrics.completedTickets}</div>
          <div className="text-[10px] text-slate-500 mt-1">
            {metrics.avgMTTR}m avg repair time
          </div>
        </div>

        {/* Total Assets */}
        <div
          onClick={() => openDrillDown('total_assets', 'Plant Equipment & Asset Registry')}
          className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs hover:border-indigo-400 hover:shadow-sm transition cursor-pointer group"
          title="Click to view Asset Registry drill-down"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider group-hover:text-indigo-600 transition">Total Assets</span>
            <span className="p-1 rounded-lg bg-purple-50 text-purple-600 group-hover:scale-110 transition">
              <Cpu className="w-3.5 h-3.5" />
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">{metrics.totalAssets}</div>
          <div className="text-[10px] text-slate-500 mt-1">
            {metrics.operationalPct}% operational
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* 2.5 SENIOR SUPERVISOR ADD-ONS: LINE AVAILABILITY, WORK ORDERS & ROSTER */}
      {/* ================================================================= */}
      <div className="space-y-4">
        <LineAvailabilityWidget
          machines={machines}
          onSelectZoneLine={(zone, line) => {
            router.push(`/${companySlug}/dashboard/asset-log?zone=${encodeURIComponent(zone)}&line=${encodeURIComponent(line)}`);
          }}
        />

        {/* Milestones & Task Dispatch Grid */}
        <MaintenanceMilestonesAndTasks
          repairs={repairs}
          ppmSchedules={ppmSchedules}
          machines={machines}
          userName={user?.name || 'Plant Administrator'}
          role={role || 'ADMIN'}
          compact={true}
          hideAttendance={true}
          onOpenResolve={(t) => {
            router.push(`/dashboard/calendar?action=dispatch&ticket=${t.id}`);
          }}
          onCompletePPM={(ppmId, machineId) => handleQuickCompletePPM(ppmId, machineId)}
          onOpenCalendarDate={(dStr) => router.push(`/dashboard/calendar?date=${dStr}`)}
        />

        {/* Floor Ticket Queue & Attendance/Shift Duty Roster */}
        <SupervisorFloorWorkspace
          machines={machines}
          repairs={repairs}
          ppmSchedules={ppmSchedules}
          userName={user?.name || 'Plant Administrator'}
          role={role || 'ADMIN'}
          onRefresh={onRefresh}
          isExternalNewTicketOpen={isLogBreakdownModalOpen}
          onCloseExternalNewTicket={() => setIsLogBreakdownModalOpen(false)}
        />
      </div>

      {/* ================================================================= */}
      {/* 3. ROW 2: CATEGORY BREAKDOWN, SLA CHART, STATS STRIP              */}
      {/* ================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-3.5">
        {/* Left Column (3 cols): Tickets by Category */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs max-h-[500px] flex flex-col justify-between">
          <div className="shrink-0">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <BarChart3 className="w-3.5 h-3.5 text-indigo-600" />
                Tickets by Category
              </h2>
              <span className="text-[10px] text-slate-400">{repairs.length} total</span>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto space-y-2.5 pr-1 py-1">
            {[
              { label: 'Sewing Machinery', count: metrics.sewingTickets, total: repairs.length || 1, color: 'bg-indigo-500', catKey: 'MACHINE' },
              { label: 'Work Tables & Chairs', count: metrics.furnitureTickets, total: repairs.length || 1, color: 'bg-amber-500', catKey: 'FURNITURE' },
              { label: 'Plant Utilities & Lights', count: metrics.utilityTickets, total: repairs.length || 1, color: 'bg-cyan-500', catKey: 'UTILITY' },
              { label: 'Vehicles & Trolleys', count: metrics.vehicleTickets, total: repairs.length || 1, color: 'bg-purple-500', catKey: 'VEHICLE' },
            ].map((item) => {
              const pct = Math.round((item.count / item.total) * 100);
              return (
                <div
                  key={item.label}
                  onClick={() => openDrillDown('category_assets', `${item.label} Drill-down`, { category: item.catKey })}
                  className="space-y-1 p-1 -mx-1 rounded-lg hover:bg-slate-50 cursor-pointer transition group"
                  title={`Click to view ${item.label} details`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 font-medium truncate group-hover:text-indigo-600 transition">{item.label}</span>
                    <span className="text-slate-900 font-bold font-mono ml-2">{item.count}</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full ${item.color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="shrink-0 pt-3 mt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
            <button
              onClick={() => openDrillDown('fault_category', 'Mechanical Faults Breakdown', { fault: 'Mechanical' })}
              className="hover:text-indigo-600 hover:underline transition cursor-pointer"
            >
              Mechanical: <strong>{metrics.mechanicalPct}%</strong>
            </button>
            <button
              onClick={() => openDrillDown('fault_category', 'Electrical Faults Breakdown', { fault: 'Electrical' })}
              className="hover:text-indigo-600 hover:underline transition cursor-pointer"
            >
              Electrical: <strong>{metrics.electricalPct}%</strong>
            </button>
            <button
              onClick={() => openDrillDown('open_tickets', 'Other Faults Breakdown')}
              className="hover:text-indigo-600 hover:underline transition cursor-pointer"
            >
              Other: <strong>{metrics.otherPct}%</strong>
            </button>
          </div>
        </div>

        {/* Middle Column (6 cols): SLA Performance Trend & Weekly Breakdown */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs max-h-[500px] flex flex-col justify-between">
          <div className="shrink-0 flex items-center justify-between mb-2">
            <div>
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                SLA Compliance & Resolution Trend
              </h2>
              <p className="text-[10px] text-slate-400">Weekly ticket volumes vs. SLA adherence target (95%)</p>
            </div>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> &gt;95% SLA Met
              </span>
            </div>
          </div>

          {/* SVG Sparkline / Multi-bar Chart */}
          <div className="py-2 flex-1 min-h-0 flex items-center justify-center">
            <svg viewBox="0 0 500 120" className="w-full h-28 overflow-visible">
              <defs>
                <linearGradient id="slaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              {/* Grid lines */}
              <line x1="0" y1="20" x2="500" y2="20" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />
              <line x1="0" y1="55" x2="500" y2="55" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />
              <line x1="0" y1="90" x2="500" y2="90" stroke="#f1f5f9" strokeWidth="1" strokeDasharray="4 4" />

              {/* SLA Target line (95%) */}
              <line x1="0" y1="30" x2="500" y2="30" stroke="#10b981" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.6" />
              <text x="495" y="26" textAnchor="end" fontSize="8" fill="#059669" fontWeight="600">95% Target SLA</text>

              {/* Bar background: Days of week */}
              {weeklySlaData.map((bar) => {
                const totalH = Math.min(80, bar.total * 6);
                const fixedH = Math.min(80, bar.fixed * 6);
                return (
                  <g key={bar.day}>
                    <rect x={bar.x - 12} y={100 - (totalH > 0 ? totalH : 2)} width="24" height={totalH > 0 ? totalH : 2} rx="3" fill="#e2e8f0" />
                    <rect x={bar.x - 12} y={100 - (fixedH > 0 ? fixedH : 2)} width="24" height={fixedH > 0 ? fixedH : 2} rx="3" fill="#6366f1" opacity="0.85" />
                    <text x={bar.x} y="114" textAnchor="middle" fontSize="9" fill="#64748b" fontWeight="500">{bar.day}</text>
                    <text x={bar.x} y={96 - totalH} textAnchor="middle" fontSize="8" fill="#1e293b" fontWeight="600">{bar.fixed}/{bar.total}</text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="shrink-0 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-indigo-500" />
              <span>Resolved on SLA: <strong>{resolvedSlaPct}%</strong></span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-slate-300" />
              <span>Total Work Orders</span>
            </span>
          </div>
        </div>

        {/* Right Column (3 cols): Breakdown Fault Distribution */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs max-h-[500px] flex flex-col justify-between">
          <div className="shrink-0">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-rose-500" />
                Downtime Causes
              </h2>
              <span className="text-[10px] text-slate-400">Past 30 Days</span>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1 py-1">
            {downtimeCauses.map((cause) => (
              <div
                key={cause.label}
                onClick={() => openDrillDown('fault_category', `${cause.label} Breakdown`, { fault: cause.fault })}
                className="p-1 -mx-1 rounded-lg hover:bg-slate-50 cursor-pointer transition group"
                title={`Click to view ${cause.label} drill-down`}
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-600 group-hover:text-indigo-600 transition">{cause.label}</span>
                  <span className="font-bold text-slate-900 font-mono">{cause.pct}%</span>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full ${cause.color} rounded-full transition-all duration-500`} style={{ width: `${cause.pct}%` }} />
                </div>
              </div>
            ))}
          </div>

          <div className="shrink-0 pt-3 mt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Total Downtime:</span>
            <span className="font-bold text-slate-900 font-mono">{metrics.totalDowntimeMins} mins</span>
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* 4. WORKFLOW PIPELINE (EXPANDABLE)                                */}
      {/* ================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <Activity className="w-3.5 h-3.5" />
            </div>
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Maintenance Workflow Pipeline
            </h2>
          </div>
          <button
            onClick={() => setPipelineCollapsed(!pipelineCollapsed)}
            className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
          >
            <span>{pipelineCollapsed ? 'Expand' : 'Collapse'}</span>
            {pipelineCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>

        {!pipelineCollapsed && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
            {workflowStages.map((stage, idx) => (
              <div
                key={stage.key}
                onClick={() => openDrillDown('pipeline_stage', `Workflow Stage: ${stage.label}`, { stageKey: stage.key })}
                className={`${stage.bgColor} border ${stage.borderColor} rounded-xl p-2.5 text-center transition hover:shadow-xs hover:scale-102 cursor-pointer relative group`}
                title={`Click to view ${stage.label} items drill-down`}
              >
                <div className="flex items-center justify-center gap-1 text-[10px] font-bold text-slate-400 mb-1">
                  <span>STEP {idx + 1}</span>
                </div>
                <div className={`text-xl font-black font-mono ${stage.color}`}>
                  {stage.count}
                </div>
                <div className="text-[11px] font-semibold text-slate-700 mt-0.5 truncate group-hover:text-indigo-600 transition">
                  {stage.label}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ================================================================= */}
      {/* 5. LIVE MACHINES STATUS TABLE (WITH CRITICAL BREAKDOWNS FIRST)    */}
      {/* ================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-3.5">
        {/* Left Column (8 cols): Shop Floor Machinery */}
        <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs max-h-[500px] flex flex-col">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 shrink-0">
            <div>
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-indigo-600" />
                Shop Floor Equipment Status
              </h2>
              <p className="text-[10px] text-slate-400">Live machinery status across production lines ({machines.length} total assets)</p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-slate-500 font-semibold mr-0.5 hidden sm:inline">Type Details:</span>
              <button
                onClick={() => router.push(`/${companySlug}/dashboard/asset-types?unit=UNIT%20-%201`)}
                className="px-2 py-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition cursor-pointer flex items-center gap-1 shadow-2xs"
                title="Redirect to Unit 1 Machine Types & Fleet Details"
              >
                <span>Unit 1 Types</span>
                <ArrowRight className="w-3 h-3" />
              </button>
              <button
                onClick={() => router.push(`/${companySlug}/dashboard/asset-types?unit=UNIT-2`)}
                className="px-2 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition cursor-pointer flex items-center gap-1 shadow-2xs"
                title="Redirect to Unit 2 Machine Types & Fleet Details"
              >
                <span>Unit 2 Types</span>
                <ArrowRight className="w-3 h-3" />
              </button>
              <button
                onClick={() => router.push(`/${companySlug}/dashboard/asset-types`)}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer ml-1"
                title="View All Asset Master Registry"
              >
                <span>All Assets</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto mt-2 border border-slate-300 rounded-lg shadow-2xs">
            <table className="w-full text-left border-collapse border border-slate-300 text-xs">
              <thead className="sticky top-0 bg-slate-100 z-10 border-b border-slate-300 shadow-2xs select-none">
                <tr className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  <th className="py-2 px-2.5 bg-slate-100 border-r border-b border-slate-300 text-center w-10 text-slate-500 font-mono">#</th>
                  <th className="py-2 px-2.5 bg-slate-100 border-r border-b border-slate-300">Machine ID</th>
                  <th className="py-2 px-2.5 bg-slate-100 border-r border-b border-slate-300">Type & Model</th>
                  <th className="py-2 px-2.5 bg-slate-100 border-r border-b border-slate-300">Line</th>
                  <th className="py-2 px-2.5 bg-slate-100 border-r border-b border-slate-300">Status</th>
                  <th className="py-2 px-2.5 bg-slate-100 border-b border-slate-300 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {machines.map((m, idx) => (
                  <tr key={m.id} className="hover:bg-blue-50/60 even:bg-slate-50/40 transition">
                    <td className="py-1.5 px-2.5 border-r border-b border-slate-200 text-center text-[10px] font-mono text-slate-400 bg-slate-50/50">{idx + 1}</td>
                    <td className="py-1.5 px-2.5 border-r border-b border-slate-200 font-mono font-bold text-slate-900">{m.id}</td>
                    <td className="py-1.5 px-2.5 border-r border-b border-slate-200 text-slate-700 font-medium truncate max-w-[180px]">{m.type}</td>
                    <td className="py-1.5 px-2.5 border-r border-b border-slate-200 text-slate-600">{m.area || m.currentLine || 'Line 01'}</td>
                    <td className="py-1.5 px-2.5 border-r border-b border-slate-200">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          m.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : m.status === 'BREAKDOWN'
                            ? 'bg-rose-100 text-rose-800 animate-pulse'
                            : m.status === 'UNDER_MAINTENANCE'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {m.status}
                      </span>
                    </td>
                    <td className="py-1.5 px-2.5 border-b border-slate-200 text-right">
                      <button
                        onClick={() => router.push(`/scan/${m.id}`)}
                        className="px-2 py-0.5 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 border border-indigo-200 rounded transition cursor-pointer"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
                {machines.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400 text-xs font-medium border-b border-slate-200">
                      No machinery registered yet. Click &apos;View All Assets&apos; or register new machines.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column (4 cols): COST ANALYSIS (Pie Chart view matching screenshot) */}
        <div className="lg:col-span-4 bg-white rounded-3xl border border-slate-200/90 p-5 sm:p-6 shadow-xs max-h-[500px] flex flex-col justify-between overflow-y-auto">
          <div>
            {/* Header: Title on Left, Subtitle below, View Switcher on Right */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide">
                  {costTab === 'cost' ? 'COST ANALYSIS' : 'LINE ASSETS'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {costTab === 'cost' ? 'Click a category to drill down' : 'Click a line to drill down'}
                </p>
              </div>
              <button
                onClick={() => setCostTab(costTab === 'cost' ? 'line' : 'cost')}
                className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-full transition cursor-pointer shrink-0"
                title="Switch between Cost Categories and Production Lines"
              >
                {costTab === 'cost' ? 'Floor Line View' : 'Category View'}
              </button>
            </div>

            {/* Side-by-Side: Donut on Left, Legend on Right */}
            <div className="mt-5 flex items-center justify-between gap-4 select-none">
              {/* Left Side: Donut / Pie Chart with Total inside */}
              <div className="relative shrink-0 flex items-center justify-center w-36 h-36">
                <svg viewBox="0 0 140 140" className="w-full h-full overflow-visible">
                  {/* Subtle Background Ring */}
                  <circle
                    cx="70"
                    cy="70"
                    r="46"
                    fill="none"
                    stroke="#f8fafc"
                    strokeWidth="20"
                  />

                  {pieChartSlices.map((slice) => {
                    const isHovered = hoveredPieKey === slice.key;
                    const isDimmed = hoveredPieKey !== null && !isHovered;

                    return (
                      <path
                        key={slice.key}
                        d={describeDonutSlice(
                          70,
                          70,
                          isHovered ? 59 : 56,
                          isHovered ? 33 : 36,
                          slice.startAngle,
                          slice.endAngle
                        )}
                        fill={slice.color}
                        stroke="#ffffff"
                        strokeWidth={2.5}
                        strokeLinejoin="round"
                        className="transition-all duration-200 cursor-pointer"
                        style={{
                          filter: isHovered ? 'brightness(1.08) drop-shadow(0 2px 6px rgba(0,0,0,0.2))' : 'none',
                          opacity: isDimmed ? 0.45 : 1,
                        }}
                        onMouseEnter={() => setHoveredPieKey(slice.key)}
                        onMouseLeave={() => setHoveredPieKey(null)}
                        onClick={() => {
                          if (costTab === 'cost') {
                            openDrillDown('category_assets', `${slice.label} Asset Details`, {
                              category: slice.catKey,
                            });
                          } else {
                            openDrillDown('total_assets', `${slice.label} Asset Registry`);
                          }
                        }}
                      />
                    );
                  })}

                  {/* Donut Center Display */}
                  <text
                    x="70"
                    y={hoveredPieItem ? '69' : '77'}
                    textAnchor="middle"
                    className="font-bold fill-slate-900 select-none pointer-events-none tracking-tight font-sans transition-all duration-200"
                    style={{ fontSize: hoveredPieItem ? '20px' : '23px', fontWeight: 800 }}
                  >
                    {hoveredPieItem ? hoveredPieItem.count : totalPieCount}
                  </text>
                  <text
                    x="70"
                    y={hoveredPieItem ? '83' : '88'}
                    textAnchor="middle"
                    className="text-[9px] font-bold fill-slate-400 select-none pointer-events-none truncate max-w-[50px]"
                  >
                    {hoveredPieItem
                      ? `${totalPieCount > 0 ? Math.round((hoveredPieItem.count / totalPieCount) * 100) : 0}%`
                      : totalPieCount === 0
                      ? 'No Assets'
                      : 'Total Assets'}
                  </text>
                </svg>
              </div>

              {/* Right Side: Vertical Legend List matching screenshot */}
              <div className="flex-1 space-y-2 select-none">
                {activePieList.map((item) => {
                  const isHovered = hoveredPieKey === item.key;
                  const pct = totalPieCount > 0 ? Math.round((item.count / totalPieCount) * 100) : 0;

                  return (
                    <div
                      key={item.key}
                      onMouseEnter={() => setHoveredPieKey(item.key)}
                      onMouseLeave={() => setHoveredPieKey(null)}
                      onClick={() => {
                        if (costTab === 'cost') {
                          openDrillDown('category_assets', `${item.label} Asset Details`, {
                            category: item.catKey,
                          });
                        } else {
                          openDrillDown('total_assets', `${item.label} Asset Registry`);
                        }
                      }}
                      className={`flex items-center justify-between py-1 px-2 rounded-xl transition cursor-pointer group ${
                        isHovered ? 'bg-slate-50' : 'hover:bg-slate-50/70'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-sm font-medium text-slate-600 group-hover:text-slate-900 transition truncate">
                          {item.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        {item.count > 0 && totalPieCount > 0 && (
                          <span className="text-[10px] font-semibold text-slate-400 font-mono">
                            {pct}%
                          </span>
                        )}
                        <span className="text-sm font-bold text-slate-900 font-mono min-w-[18px] text-right">
                          {item.count}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* 6. BOTTOM KPI STRIP                                               */}
      {/* ================================================================= */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-3.5">
        <div
          onClick={() => openDrillDown('open_tickets', 'Mean Time to Repair (MTTR) Analysis')}
          className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs text-center hover:border-indigo-400 hover:shadow-sm transition cursor-pointer group"
          title="Click to view MTTR tickets drill-down"
        >
          <div className="text-2xl font-black text-slate-900 font-mono group-hover:text-indigo-600 transition">
            {metrics.avgMTTR}<span className="text-xs font-bold text-slate-400 ml-1">Mins</span>
          </div>
          <div className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-wider">Avg MTTR</div>
          <div className="text-[10px] text-slate-400">Mean Time to Repair</div>
        </div>

        <div
          onClick={() => openDrillDown('overdue', 'Downtime & Failure Frequency Analysis')}
          className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs text-center hover:border-indigo-400 hover:shadow-sm transition cursor-pointer group"
          title="Click to view Downtime & MTBF drill-down"
        >
          <div className="text-2xl font-black text-slate-900 font-mono group-hover:text-indigo-600 transition">
            {metrics.totalDowntimeMins > 0 ? Math.round(metrics.totalDowntimeMins / Math.max(1, metrics.breakdownMachines) / 60) : 0}
            <span className="text-xs font-bold text-slate-400 ml-1">Hrs</span>
          </div>
          <div className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-wider">Avg MTBF</div>
          <div className="text-[10px] text-slate-400">Mean Time Between Failures</div>
        </div>

        <div
          onClick={() => openDrillDown('completed_tasks', 'Preventive Maintenance (PPM) Compliance & Completed Tasks', { filterDefault: 'ppm' })}
          className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs text-center hover:border-emerald-400 hover:shadow-sm transition cursor-pointer group"
          title="Click to view completed PPM overhauls and compliance log"
        >
          <div
            className="text-2xl font-black font-mono group-hover:scale-105 transition"
            style={{ color: metrics.ppmComplianceRate >= 90 ? '#10b981' : metrics.ppmComplianceRate >= 70 ? '#f59e0b' : '#ef4444' }}
          >
            {metrics.ppmComplianceRate}<span className="text-xs font-bold text-slate-400 ml-0.5">%</span>
          </div>
          <div className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-wider">PPM Compliance</div>
          <div className="text-[10px] text-slate-400">Preventive Maintenance Rate</div>
        </div>

        <div
          onClick={() => openDrillDown('total_assets', 'Plant Availability & Fleet Health')}
          className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-xs text-center hover:border-indigo-400 hover:shadow-sm transition cursor-pointer group"
          title="Click to view Plant Availability drill-down"
        >
          <div
            className="text-2xl font-black font-mono group-hover:scale-105 transition"
            style={{ color: metrics.operationalPct >= 90 ? '#10b981' : metrics.operationalPct >= 75 ? '#f59e0b' : '#ef4444' }}
          >
            {metrics.operationalPct}<span className="text-xs font-bold text-slate-400 ml-0.5">%</span>
          </div>
          <div className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-wider">Plant Availability</div>
          <div className="text-[10px] text-slate-400">Overall equipment availability</div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* 7. WIDGET DRILL-DOWN SIDEBAR (SLIDE-OVER RIGHT TO LEFT)           */}
      {/* ================================================================= */}
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
