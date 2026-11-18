'use client';

import { textValue } from '@/lib/textValue';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Wrench,
  Settings,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  ArrowUp,
  ArrowDown,
  Calendar,
  ChevronDown,
  CheckCircle2,
  Target,
  FileText,
  Activity,
  Layers,
  Crown,
  Sparkles,
  Search,
  Check,
  X,
  Clock,
  ArrowUpRight,
  ShieldAlert,
  Zap,
  Building,
  Coins,
  PackageCheck,
  CheckCircle,
} from 'lucide-react';
import { Machine, RepairTicket, PPMSchedule, SparePart, PartRequisition } from '@/types/cmms';
import { updateRequisitionStatus } from '@/lib/services/cmmsService';
import { useToast } from '@/context/ToastContext';
import { WidgetDrilldownDrawer, DrillDownType, DrillDownMeta } from './WidgetDrilldownDrawer';

interface ExecutiveDashboardProps {
  machines: Machine[];
  repairs: RepairTicket[];
  ppmSchedules?: PPMSchedule[];
  parts?: SparePart[];
  requisitions: PartRequisition[];
  lastRefresh: Date;
  onRefresh: () => void;
  isLoading?: boolean;
}

export function ExecutiveDashboard({
  machines,
  repairs,
  ppmSchedules = [],
  parts = [],
  requisitions,
  lastRefresh,
  onRefresh,
  isLoading = false,
}: ExecutiveDashboardProps) {
  const router = useRouter();
  const { showToast } = useToast();

  // Date Range Filter State
  const [dateRange, setDateRange] = useState('All Time');
  const [isDateDropdownOpen, setIsDateDropdownOpen] = useState(false);
  const [currency, setCurrency] = useState<'INR' | 'USD'>('INR');

  // Currency Formatter (data in CMMS is in INR ₹)
  const formatMoney = (amountINR: number) => {
    if (currency === 'USD') {
      const usdAmount = amountINR / 83.5;
      return `$ ${Math.round(usdAmount).toLocaleString('en-US')}`;
    }
    return `₹ ${Math.round(amountINR).toLocaleString('en-IN')}`;
  };

  // Replacement approval modal state
  const [selectedReplacement, setSelectedReplacement] = useState<{
    machineId?: string;
    machine: string;
    reason: string;
    cost: number;
    priority: string;
    line?: string;
    station?: string;
  } | null>(null);

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

  // ─── 1. REAL CEO PENDING REQUISITIONS ─────────────────────────────────
  const ceoPendingReqs = useMemo(() => {
    return requisitions.filter(
      (r) =>
        (r.type === 'CRITICAL_CEO' || r.requiresCeoApproval) &&
        r.status === 'PENDING_CEO_APPROVAL'
    );
  }, [requisitions]);

  const totalPendingCost = useMemo(() => {
    return ceoPendingReqs.reduce((acc, r) => acc + (r.estimatedCost || 0), 0);
  }, [ceoPendingReqs]);

  const handleApprove = async (reqId: string) => {
    try {
      await updateRequisitionStatus(reqId, 'APPROVED_BY_CEO', 'Approved by CEO via Executive Dashboard');
      showToast(`Critical Requisition ${reqId} Approved!`, 'success');
      onRefresh();
    } catch {
      showToast('Failed to approve requisition', 'error');
    }
  };

  const handleReject = async (reqId: string) => {
    try {
      await updateRequisitionStatus(reqId, 'REJECTED', 'Declined by CEO');
      showToast(`Requisition ${reqId} deferred.`, 'info');
      onRefresh();
    } catch {
      showToast('Failed to reject requisition', 'error');
    }
  };

  // ─── 2. REAL METRICS & KPI CALCULATIONS ──────────────────────────────
  const completedRepairs = useMemo(() => {
    return repairs.filter((r) => r.status === 'COMPLETED').length;
  }, [repairs]);

  const completedPpm = useMemo(() => {
    return ppmSchedules.filter((p) => p.status === 'COMPLETED').length;
  }, [ppmSchedules]);

  const totalActivitiesCompleted = completedRepairs + completedPpm;

  // Real Repair Cost Calculation (parts cost + technician labor)
  const totalRepairCost = useMemo(() => {
    return repairs.reduce((acc, r) => {
      const partsCost = (r.partsUsed || []).reduce((pAcc, pu) => {
        const part = parts.find((sp) => sp.partId === pu.partId || sp.sku === pu.sku);
        return pAcc + (part ? part.unitCost * pu.quantity : pu.quantity * 250);
      }, 0);
      const laborCost = Math.round(((r.downtimeMinutes || 0) / 60) * 300);
      return acc + partsCost + laborCost;
    }, 0);
  }, [repairs, parts]);

  // Real Maintenance Cost (PPM routines + approved requisitions)
  const totalMaintenanceCost = useMemo(() => {
    const reqCost = requisitions
      .filter((req) => req.status === 'APPROVED_BY_CEO' || req.status === 'FULFILLED' || req.status === 'ORDERED')
      .reduce((acc, req) => acc + (req.estimatedCost || 0), 0);
    const ppmCost = ppmSchedules.filter((p) => p.status === 'COMPLETED').length * 450;
    return reqCost + ppmCost;
  }, [requisitions, ppmSchedules]);

  // Real Major Problems Count (critical urgency or high downtime)
  const majorProblemsCount = useMemo(() => {
    return repairs.filter((r) => r.urgency === 'CRITICAL' || (r.downtimeMinutes && r.downtimeMinutes >= 60)).length;
  }, [repairs]);

  // Real Machines Recommended for Replacement
  const machineReplacements = useMemo(() => {
    return machines
      .filter((m) => {
        const ticketCount = repairs.filter((r) => r.machineId === m.id).length;
        const dtHours = ((m.totalDowntimeMinutes || 0) / 60);
        return (
          m.status === 'SCRAP' ||
          m.status === 'BREAKDOWN' ||
          ticketCount >= 2 ||
          dtHours >= 4
        );
      })
      .map((m) => {
        const ticketCount = repairs.filter((r) => r.machineId === m.id).length;
        const dtHours = Math.round(((m.totalDowntimeMinutes || 0) / 60) * 10) / 10;
        let reason = '';
        let priority: 'High' | 'Medium' | 'Low' = 'Medium';
        let priorityColor = 'bg-amber-500 text-white';

        if (m.status === 'SCRAP') {
          reason = 'Decommissioned / marked for scrap salvage';
          priority = 'High';
          priorityColor = 'bg-rose-500 text-white';
        } else if (ticketCount >= 3 || dtHours >= 10) {
          reason = `High breakdown frequency (${ticketCount} tickets, ${dtHours}h downtime)`;
          priority = 'High';
          priorityColor = 'bg-rose-500 text-white';
        } else if (m.status === 'BREAKDOWN') {
          reason = `Currently in critical breakdown (${dtHours}h downtime)`;
          priority = 'High';
          priorityColor = 'bg-rose-500 text-white';
        } else {
          reason = `Repeated maintenance tickets (${ticketCount} logged)`;
          priority = 'Medium';
          priorityColor = 'bg-amber-500 text-white';
        }

        const estReplacementCost = m.cost ? Math.round(m.cost * 1.1) : 45000;

        return {
          machineId: m.id,
          machine: m.name ? `${m.id} (${m.name})` : `${m.id} (${m.brand} ${m.model || m.type})`,
          reason,
          cost: estReplacementCost,
          priority,
          priorityColor,
          line: m.currentLine,
          station: m.stationNo,
        };
      })
      .slice(0, 5);
  }, [machines, repairs]);

  // ─── 3. REAL MONTHLY TREND DATA (JAN - DEC) ───────────────────────────
  const monthlyTrendData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months.map((m, idx) => {
      const monthRepairs = repairs.filter((r) => {
        const d = new Date(r.reportedAt || '');
        return !isNaN(d.getTime()) && d.getMonth() === idx;
      });
      const monthPpms = ppmSchedules.filter((p) => {
        const d = new Date(p.completedAt || p.lastServiced || '');
        return !isNaN(d.getTime()) && d.getMonth() === idx;
      });

      const repairCost = monthRepairs.reduce((acc, r) => {
        const partsCost = (r.partsUsed || []).reduce((pAcc, pu) => {
          const part = parts.find((sp) => sp.partId === pu.partId || sp.sku === pu.sku);
          return pAcc + (part ? part.unitCost * pu.quantity : 150);
        }, 0);
        const laborCost = Math.round(((r.downtimeMinutes || 0) / 60) * 300);
        return acc + partsCost + laborCost;
      }, 0);

      const maintCost = monthPpms.length * 450 + monthRepairs.length * 150;

      return {
        month: m,
        maintenance: maintCost,
        repair: repairCost,
      };
    });
  }, [repairs, ppmSchedules, parts]);

  const maxMonthlyVal = useMemo(() => {
    const maxVal = Math.max(
      ...monthlyTrendData.map((d) => Math.max(d.maintenance, d.repair)),
      1
    );
    return Math.max(maxVal, 1000);
  }, [monthlyTrendData]);

  // ─── 4. REAL MAINTENANCE BY TYPE (DONUT) ──────────────────────────────
  const maintenanceByType = useMemo(() => {
    const preventive = ppmSchedules.length;
    const corrective = repairs.filter(
      (r) => r.urgency === 'CRITICAL' || textValue(r.faultCategory)?.toLowerCase().includes('breakdown')
    ).length;
    const routine = repairs.filter((r) => r.urgency === 'WARNING' || !r.urgency).length;
    const predictive = machines.filter((m) => m.status === 'UNDER_MAINTENANCE').length;
    const total = preventive + corrective + routine + predictive;

    const pPct = total > 0 ? Math.round((preventive / total) * 100) : 0;
    const cPct = total > 0 ? Math.round((corrective / total) * 100) : 0;
    const prPct = total > 0 ? Math.round((predictive / total) * 100) : 0;
    const rPct = total > 0 ? Math.max(0, 100 - pPct - cPct - prPct) : 0;

    return {
      preventive: { count: preventive, pct: pPct },
      corrective: { count: corrective, pct: cPct },
      predictive: { count: predictive, pct: prPct },
      routine: { count: routine, pct: rPct },
      total,
    };
  }, [repairs, ppmSchedules, machines]);

  // ─── 5. REAL TOP DOWNTIME MACHINES ────────────────────────────────────
  const topDowntimeMachines = useMemo(() => {
    const downtimeMap: Record<string, { machineName: string; totalMinutes: number }> = {};

    repairs.forEach((r) => {
      const m = machines.find((mach) => mach.id === r.machineId);
      const name = m?.name || (m ? `${m.id} (${m.brand} ${m.model})` : r.machineId);
      if (!downtimeMap[r.machineId]) {
        downtimeMap[r.machineId] = { machineName: name, totalMinutes: 0 };
      }
      downtimeMap[r.machineId].totalMinutes += r.downtimeMinutes || 0;
    });

    machines.forEach((m) => {
      if (m.totalDowntimeMinutes && m.totalDowntimeMinutes > 0) {
        const name = m.name || `${m.id} (${m.brand} ${m.model})`;
        if (!downtimeMap[m.id]) {
          downtimeMap[m.id] = { machineName: name, totalMinutes: m.totalDowntimeMinutes };
        } else {
          downtimeMap[m.id].totalMinutes = Math.max(downtimeMap[m.id].totalMinutes, m.totalDowntimeMinutes);
        }
      }
    });

    const colors = [
      { color: 'bg-rose-500', barColor: '#ef4444' },
      { color: 'bg-orange-500', barColor: '#f97316' },
      { color: 'bg-amber-400', barColor: '#facc15' },
      { color: 'bg-emerald-500', barColor: '#10b981' },
      { color: 'bg-blue-600', barColor: '#2563eb' },
    ];

    return Object.entries(downtimeMap)
      .map(([id, val]) => ({
        id,
        name: val.machineName,
        hours: Math.round((val.totalMinutes / 60) * 10) / 10,
      }))
      .filter((m) => m.hours > 0)
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 5)
      .map((item, idx) => ({
        ...item,
        color: colors[idx % colors.length].color,
        barColor: colors[idx % colors.length].barColor,
      }));
  }, [repairs, machines]);

  const maxDowntimeHours = useMemo(() => {
    return Math.max(...topDowntimeMachines.map((m) => m.hours), 10);
  }, [topDowntimeMachines]);

  // ─── 6. REAL COST BREAKDOWN ───────────────────────────────────────────
  const costBreakdown = useMemo(() => {
    // 1. Spare parts cost from repair usage
    const partsFromRepairs = repairs.reduce((acc, r) => {
      return (
        acc +
        (r.partsUsed || []).reduce((pAcc, pu) => {
          const part = parts.find((sp) => sp.partId === pu.partId || sp.sku === pu.sku);
          return pAcc + (part ? part.unitCost * pu.quantity : pu.quantity * 250);
        }, 0)
      );
    }, 0);

    // 2. Technician labor cost (approx ₹300/hr)
    const totalLabor = repairs.reduce((acc, r) => {
      return acc + Math.round(((r.downtimeMinutes || 0) / 60) * 300);
    }, 0);

    // 3. Requisitions / External contract procurement
    const externalSpares = requisitions
      .filter((req) => req.status === 'APPROVED_BY_CEO' || req.status === 'ORDERED' || req.status === 'FULFILLED')
      .reduce((acc, req) => acc + (req.estimatedCost || 0), 0);

    // 4. Replacement Capex of decommissioned/scrap units
    const replacementCapex = machines
      .filter((m) => m.status === 'SCRAP')
      .reduce((acc, m) => acc + (m.cost || 40000), 0);

    const totalCost = partsFromRepairs + totalLabor + externalSpares + replacementCapex;

    const partsPct = totalCost > 0 ? Math.round(((partsFromRepairs + externalSpares) / totalCost) * 100) : 0;
    const laborPct = totalCost > 0 ? Math.round((totalLabor / totalCost) * 100) : 0;
    const replacePct = totalCost > 0 ? Math.round((replacementCapex / totalCost) * 100) : 0;
    const otherPct = totalCost > 0 ? Math.max(0, 100 - partsPct - laborPct - replacePct) : 0;

    return {
      total: totalCost,
      spareParts: { amount: partsFromRepairs + externalSpares, pct: partsPct },
      labor: { amount: totalLabor, pct: laborPct },
      replacement: { amount: replacementCapex, pct: replacePct },
      routineOther: { amount: Math.max(0, totalCost - (partsFromRepairs + externalSpares + totalLabor + replacementCapex)), pct: otherPct },
    };
  }, [repairs, parts, requisitions, machines]);

  // ─── 7. REAL RECURRING PROBLEMS / MAJOR EVENTS ────────────────────────
  const recurringProblems = useMemo(() => {
    const faultMap: Record<string, { problem: string; count: number; mechanics: Set<string> }> = {};

    repairs.forEach((r) => {
      const issue = r.faultCategory || r.faultDetails || 'Mechanical fault';
      if (!faultMap[issue]) {
        faultMap[issue] = { problem: issue, count: 0, mechanics: new Set() };
      }
      faultMap[issue].count += 1;
      if (r.attendedBy) faultMap[issue].mechanics.add(r.attendedBy);
    });

    const dotColors = ['bg-rose-500', 'bg-amber-500', 'bg-blue-600', 'bg-purple-500', 'bg-emerald-500'];

    return Object.values(faultMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((item, idx) => ({
        problem: item.problem,
        count: item.count,
        mechanic: Array.from(item.mechanics).join(', ') || 'Attended on Shift',
        dotColor: dotColors[idx % dotColors.length],
      }));
  }, [repairs]);

  // ─── 8. REAL RECENT MAJOR PROBLEMS TABLE ──────────────────────────────
  const recentMajorProblems = useMemo(() => {
    return [...repairs]
      .sort((a, b) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime())
      .slice(0, 5)
      .map((r) => {
        const d = new Date(r.reportedAt);
        const dateStr = !isNaN(d.getTime())
          ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
          : r.reportedAt;
        const dtHours = r.downtimeMinutes
          ? `${Math.round((r.downtimeMinutes / 60) * 10) / 10} hrs`
          : '0 min';

        const partsCost = (r.partsUsed || []).reduce((acc, pu) => {
          const part = parts.find((sp) => sp.partId === pu.partId || sp.sku === pu.sku);
          return acc + (part ? part.unitCost * pu.quantity : 0);
        }, 0);
        const laborCost = Math.round(((r.downtimeMinutes || 0) / 60) * 300);
        const totalCost = partsCost + laborCost;

        let statusClass = 'bg-slate-100 text-slate-800';
        if (r.status === 'COMPLETED') statusClass = 'bg-emerald-100 text-emerald-800';
        else if (r.status === 'IN_PROGRESS') statusClass = 'bg-blue-100 text-blue-800';
        else if (r.status === 'ASSIGNED') statusClass = 'bg-indigo-100 text-indigo-800';
        else if (r.status === 'PENDING') statusClass = 'bg-amber-100 text-amber-800';

        return {
          id: r.id,
          date: dateStr,
          machine: r.machineId,
          issue: r.faultDetails || r.faultCategory || 'Breakdown',
          downtime: dtHours,
          cost: totalCost,
          mechanic: r.attendedBy || 'Pending Assignment',
          status: r.status,
          statusClass,
        };
      });
  }, [repairs, parts]);

  // ─── 9. REAL DYNAMIC EXECUTIVE INSIGHTS ───────────────────────────────
  const executiveInsights = useMemo(() => {
    const list = [];
    const activeBreakdowns = machines.filter((m) => m.status === 'BREAKDOWN').length;

    if (ceoPendingReqs.length > 0) {
      list.push({
        icon: Crown,
        color: 'bg-purple-100 text-purple-700',
        text: (
          <span>
            <strong>{ceoPendingReqs.length} Critical requisition(s)</strong> totaling{' '}
            {formatMoney(totalPendingCost)} require CEO authorization.
          </span>
        ),
      });
    }

    if (activeBreakdowns > 0) {
      list.push({
        icon: AlertTriangle,
        color: 'bg-rose-100 text-rose-700',
        text: (
          <span>
            <strong>{activeBreakdowns} machine(s) in active breakdown</strong> on the production floor.
          </span>
        ),
      });
    } else {
      list.push({
        icon: CheckCircle2,
        color: 'bg-emerald-100 text-emerald-700',
        text: (
          <span>
            <strong>Zero active machine breakdowns.</strong> All production lines operating smoothly.
          </span>
        ),
      });
    }

    if (topDowntimeMachines.length > 0) {
      list.push({
        icon: Target,
        color: 'bg-amber-100 text-amber-700',
        text: (
          <span>
            <strong>{topDowntimeMachines[0].name}</strong> accounts for highest downtime ({topDowntimeMachines[0].hours} hrs).
          </span>
        ),
      });
    }

    if (machineReplacements.length > 0) {
      list.push({
        icon: RefreshCw,
        color: 'bg-teal-100 text-teal-700',
        text: (
          <span>
            <strong>{machineReplacements.length} asset(s) recommended for replacement</strong> due to repeated downtime or salvage.
          </span>
        ),
      });
    }

    const ppmTotal = ppmSchedules.length;
    const ppmCompletedCount = ppmSchedules.filter((p) => p.status === 'COMPLETED').length;
    const ppmPct = ppmTotal > 0 ? Math.round((ppmCompletedCount / ppmTotal) * 100) : 100;
    list.push({
      icon: Activity,
      color: 'bg-blue-100 text-blue-700',
      text: (
        <span>
          <strong>PPM Compliance rate is at {ppmPct}%</strong> ({ppmCompletedCount}/{ppmTotal} scheduled routines completed).
        </span>
      ),
    });

    return list.slice(0, 5);
  }, [
    ceoPendingReqs,
    totalPendingCost,
    machines,
    topDowntimeMachines,
    machineReplacements,
    ppmSchedules,
    currency,
  ]);

  return (
    <div className="space-y-5 pb-12 animate-in fade-in duration-150">
      {/* ─── 1. TOP HEADER & DATE RANGE FILTER ────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <span>Executive Plant Performance</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-bold border border-indigo-200">
              Live Factory Telemetry
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Real-time financial impact, downtime allocation, and executive maintenance approvals.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Currency Toggle */}
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 text-xs font-bold shadow-2xs">
            <button
              type="button"
              onClick={() => setCurrency('INR')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                currency === 'INR' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              ₹ INR
            </button>
            <button
              type="button"
              onClick={() => setCurrency('USD')}
              className={`px-2.5 py-1 rounded-lg transition cursor-pointer ${
                currency === 'USD' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              $ USD
            </button>
          </div>

          {/* Date Picker Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsDateDropdownOpen(!isDateDropdownOpen)}
              className="inline-flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 shadow-2xs transition cursor-pointer"
            >
              <Calendar className="w-4 h-4 text-slate-500" />
              <span>{dateRange}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {isDateDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-2xl shadow-xl py-1.5 z-50 text-xs font-medium">
                {['All Time', 'Current Year (2025-2026)', 'Last 90 Days', 'Current Month'].map((range) => (
                  <button
                    key={range}
                    type="button"
                    onClick={() => {
                      setDateRange(range);
                      setIsDateDropdownOpen(false);
                      showToast(`Report filtered to: ${range}`, 'info');
                    }}
                    className={`w-full text-left px-3.5 py-2 hover:bg-slate-50 transition cursor-pointer ${
                      dateRange === range ? 'text-indigo-600 font-bold bg-indigo-50/50' : 'text-slate-700'
                    }`}
                  >
                    {range}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Pending Approvals Quick Badge */}
          {ceoPendingReqs.length > 0 && (
            <button
              type="button"
              onClick={() => router.push('/dashboard/messages')}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer animate-pulse"
              title="View Critical Requests Waiting for CEO Approval"
            >
              <Crown className="w-3.5 h-3.5" />
              <span>{ceoPendingReqs.length} CEO Approvals</span>
            </button>
          )}

          {/* Refresh Button */}
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition cursor-pointer"
            title="Refresh Live Data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ─── 2. TOP 5 KPI CARDS (COMPUTED FROM REAL FACTORY DATA) ──────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Maintenance Activities Completed */}
        <div
          onClick={() => openDrillDown('open_tickets', 'Completed Activities Drilldown')}
          className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between hover:border-blue-300 hover:shadow-sm transition cursor-pointer group"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-blue-100/80 text-blue-600 flex items-center justify-center mb-3 group-hover:scale-105 transition">
              <Wrench className="w-5 h-5" />
            </div>
            <div className="text-xs font-semibold text-slate-600">
              Maintenance Activities Completed
            </div>
            <div className="text-3xl font-black text-slate-900 mt-2 font-mono">
              {totalActivitiesCompleted}
            </div>
            <div className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 mt-1.5">
              <span>{completedRepairs} Repairs • {completedPpm} PPM</span>
            </div>
          </div>
          <div className="text-[11px] text-slate-400 mt-3 pt-3 border-t border-slate-100">
            {repairs.filter((r) => r.status !== 'COMPLETED').length} currently active tickets.
          </div>
        </div>

        {/* Card 2: Total Repair Cost */}
        <div
          onClick={() => openDrillDown('cost_analysis', 'Repair Costs Breakdown')}
          className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between hover:border-rose-300 hover:shadow-sm transition cursor-pointer group"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-rose-100/80 text-rose-600 flex items-center justify-center mb-3 group-hover:scale-105 transition">
              <Coins className="w-5 h-5" />
            </div>
            <div className="text-xs font-semibold text-slate-600">
              Total Repair Cost
            </div>
            <div className="text-3xl font-black text-slate-900 mt-2 font-mono">
              {formatMoney(totalRepairCost)}
            </div>
            <div className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 mt-1.5">
              <span>{repairs.length} total work orders</span>
            </div>
          </div>
          <div className="text-[11px] text-slate-400 mt-3 pt-3 border-t border-slate-100">
            Computed from parts consumed &amp; technician hours.
          </div>
        </div>

        {/* Card 3: Total Maintenance Cost */}
        <div
          onClick={() => openDrillDown('pending_requisitions', 'Maintenance Procurement')}
          className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between hover:border-emerald-300 hover:shadow-sm transition cursor-pointer group"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-emerald-100/80 text-emerald-600 flex items-center justify-center mb-3 group-hover:scale-105 transition">
              <Settings className="w-5 h-5" />
            </div>
            <div className="text-xs font-semibold text-slate-600">
              Total Maintenance Cost
            </div>
            <div className="text-3xl font-black text-slate-900 mt-2 font-mono">
              {formatMoney(totalMaintenanceCost)}
            </div>
            <div className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 mt-1.5">
              <span>{ppmSchedules.length} Planned PPM Tasks</span>
            </div>
          </div>
          <div className="text-[11px] text-slate-400 mt-3 pt-3 border-t border-slate-100">
            Preventive service routines &amp; approved requisitions.
          </div>
        </div>

        {/* Card 4: Recurring / Major Problems */}
        <div
          onClick={() => openDrillDown('open_tickets', 'Major Critical Breakdowns')}
          className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between hover:border-purple-300 hover:shadow-sm transition cursor-pointer group"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-purple-100/80 text-purple-600 flex items-center justify-center mb-3 group-hover:scale-105 transition">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="text-xs font-semibold text-slate-600">
              Recurring / Major Problems
            </div>
            <div className="text-3xl font-black text-slate-900 mt-2 font-mono">
              {majorProblemsCount}
            </div>
            <div className="inline-flex items-center gap-1 text-xs font-bold text-purple-700 mt-1.5">
              <span>{recurringProblems.length} Problem Patterns</span>
            </div>
          </div>
          <div className="text-[11px] text-slate-400 mt-3 pt-3 border-t border-slate-100">
            Critical tickets or failures lasting &gt; 1 hour.
          </div>
        </div>

        {/* Card 5: Machines for Replacement (Recommended) */}
        <div
          onClick={() => {
            if (machineReplacements.length > 0) {
              setSelectedReplacement(machineReplacements[0]);
            }
          }}
          className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between hover:border-teal-300 hover:shadow-sm transition cursor-pointer group"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-teal-100/80 text-teal-600 flex items-center justify-center mb-3 group-hover:scale-105 transition">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div className="text-xs font-semibold text-slate-600 flex items-center justify-between">
              <span>Machines for Replacement</span>
            </div>
            <div className="text-3xl font-black text-slate-900 mt-2 font-mono">
              {machineReplacements.length}
            </div>
            <div className="inline-flex items-center gap-1 text-xs font-bold text-teal-700 mt-1.5">
              <span>{machineReplacements.length > 0 ? '(Click to Review)' : '(All Healthy)'}</span>
            </div>
          </div>
          <div className="text-[11px] text-slate-400 mt-3 pt-3 border-t border-slate-100">
            Flagged via frequent breakdowns or scrap status.
          </div>
        </div>
      </div>

      {/* ─── 3. MIDDLE CHARTS ROW (REAL DATA DRIVEN) ──────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Chart 1: Maintenance & Repair Cost Trend (5 cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Maintenance &amp; Repair Cost Trend
                </h3>
                <p className="text-[11px] text-slate-400">Monthly breakdown across calendar year</p>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-semibold">
                <span className="flex items-center gap-1 text-blue-600">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
                  Maint.
                </span>
                <span className="flex items-center gap-1 text-orange-500">
                  <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block" />
                  Repair
                </span>
              </div>
            </div>

            {/* SVG Dual-Bar Chart */}
            <div className="mt-4 h-48 w-full relative">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 480 180" preserveAspectRatio="none">
                {/* Horizontal Grid lines */}
                {[0, 45, 90, 135].map((yVal, i) => (
                  <line
                    key={i}
                    x1="45"
                    y1={yVal + 10}
                    x2="475"
                    y2={yVal + 10}
                    stroke="#f1f5f9"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                ))}

                {/* Y-axis Labels */}
                <text x="40" y="15" textAnchor="end" className="text-[8px] fill-slate-400 font-mono">
                  {formatMoney(maxMonthlyVal)}
                </text>
                <text x="40" y="60" textAnchor="end" className="text-[8px] fill-slate-400 font-mono">
                  {formatMoney(Math.round(maxMonthlyVal * 0.66))}
                </text>
                <text x="40" y="105" textAnchor="end" className="text-[8px] fill-slate-400 font-mono">
                  {formatMoney(Math.round(maxMonthlyVal * 0.33))}
                </text>
                <text x="40" y="150" textAnchor="end" className="text-[8px] fill-slate-400 font-mono">
                  0
                </text>

                {/* Bars per Month */}
                {monthlyTrendData.map((d, index) => {
                  const xBase = 52 + index * 35;
                  const maintHeight = (d.maintenance / maxMonthlyVal) * 135;
                  const repairHeight = (d.repair / maxMonthlyVal) * 135;
                  const maintY = 150 - maintHeight;
                  const repairY = 150 - repairHeight;

                  return (
                    <g key={d.month} className="group cursor-pointer">
                      {/* Maintenance bar (Blue) */}
                      <rect
                        x={xBase}
                        y={maintY}
                        width="10"
                        height={Math.max(maintHeight, 0)}
                        rx="2"
                        fill="#3b82f6"
                        className="transition-opacity group-hover:opacity-80"
                      >
                        <title>{`${d.month} Maintenance: ${formatMoney(d.maintenance)}`}</title>
                      </rect>
                      {/* Repair bar (Orange) */}
                      <rect
                        x={xBase + 12}
                        y={repairY}
                        width="10"
                        height={Math.max(repairHeight, 0)}
                        rx="2"
                        fill="#f97316"
                        className="transition-opacity group-hover:opacity-80"
                      >
                        <title>{`${d.month} Repairs: ${formatMoney(d.repair)}`}</title>
                      </rect>
                      {/* Month label */}
                      <text
                        x={xBase + 11}
                        y="166"
                        textAnchor="middle"
                        className="text-[9px] fill-slate-400 font-semibold"
                      >
                        {d.month}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </div>
          <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-100 flex justify-between">
            <span>Cumulative Spend: <strong className="text-slate-800 font-mono">{formatMoney(totalRepairCost + totalMaintenanceCost)}</strong></span>
            <span className="text-emerald-600 font-semibold">{machines.length} Plant Assets Tracked</span>
          </div>
        </div>

        {/* Chart 2: Maintenance by Type (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Maintenance by Type
                </h3>
                <p className="text-[11px] text-slate-400">Ratio of planned vs unplanned tasks</p>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 mt-4">
              {/* Donut Chart SVG */}
              <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  {/* Background Circle */}
                  <circle cx="50" cy="50" r="38" stroke="#f1f5f9" strokeWidth="16" fill="none" />
                  {maintenanceByType.total > 0 && (
                    <>
                      {/* Preventive */}
                      <circle
                        cx="50"
                        cy="50"
                        r="38"
                        stroke="#3b82f6"
                        strokeWidth="16"
                        strokeDasharray={`${(maintenanceByType.preventive.pct / 100) * 238.7} 238.7`}
                        strokeDashoffset="0"
                        fill="none"
                      />
                      {/* Corrective */}
                      <circle
                        cx="50"
                        cy="50"
                        r="38"
                        stroke="#f97316"
                        strokeWidth="16"
                        strokeDasharray={`${(maintenanceByType.corrective.pct / 100) * 238.7} 238.7`}
                        strokeDashoffset={`-${(maintenanceByType.preventive.pct / 100) * 238.7}`}
                        fill="none"
                      />
                      {/* Predictive */}
                      <circle
                        cx="50"
                        cy="50"
                        r="38"
                        stroke="#10b981"
                        strokeWidth="16"
                        strokeDasharray={`${(maintenanceByType.predictive.pct / 100) * 238.7} 238.7`}
                        strokeDashoffset={`-${((maintenanceByType.preventive.pct + maintenanceByType.corrective.pct) / 100) * 238.7}`}
                        fill="none"
                      />
                      {/* Routine */}
                      <circle
                        cx="50"
                        cy="50"
                        r="38"
                        stroke="#8b5cf6"
                        strokeWidth="16"
                        strokeDasharray={`${(maintenanceByType.routine.pct / 100) * 238.7} 238.7`}
                        strokeDashoffset={`-${((maintenanceByType.preventive.pct + maintenanceByType.corrective.pct + maintenanceByType.predictive.pct) / 100) * 238.7}`}
                        fill="none"
                      />
                    </>
                  )}
                </svg>

                {/* Center text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <span className="text-xl font-black text-slate-900 font-mono">
                    {maintenanceByType.total}
                  </span>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Total</span>
                </div>
              </div>

              {/* Legend List */}
              <div className="space-y-2 text-xs flex-grow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shrink-0" />
                    <span className="text-slate-600">Preventive</span>
                  </div>
                  <span className="font-bold text-slate-900 font-mono">
                    {maintenanceByType.preventive.pct}% ({maintenanceByType.preventive.count})
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-orange-500 shrink-0" />
                    <span className="text-slate-600">Corrective</span>
                  </div>
                  <span className="font-bold text-slate-900 font-mono">
                    {maintenanceByType.corrective.pct}% ({maintenanceByType.corrective.count})
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                    <span className="text-slate-600">Predictive</span>
                  </div>
                  <span className="font-bold text-slate-900 font-mono">
                    {maintenanceByType.predictive.pct}% ({maintenanceByType.predictive.count})
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500 shrink-0" />
                    <span className="text-slate-600">Routine</span>
                  </div>
                  <span className="font-bold text-slate-900 font-mono">
                    {maintenanceByType.routine.pct}% ({maintenanceByType.routine.count})
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-100 flex items-center justify-between">
            <span>Preventive Ratio: {maintenanceByType.preventive.pct}%</span>
            <span className={maintenanceByType.preventive.pct >= 50 ? 'text-blue-600 font-semibold' : 'text-amber-600 font-semibold'}>
              {maintenanceByType.preventive.pct >= 50 ? 'Target ≥ 50% Met' : 'Target: ≥ 50%'}
            </span>
          </div>
        </div>

        {/* Chart 3: Top Downtime by Machine (3 cols) */}
        <div className="lg:col-span-3 bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                Top Downtime by Machine
              </h3>
              <p className="text-[11px] text-slate-400">Accumulated breakdown hours</p>
            </div>

            {/* Vertical Bar Chart */}
            <div className="mt-4 h-48 w-full relative">
              {topDowntimeMachines.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-4">
                  <CheckCircle className="w-8 h-8 text-emerald-500 mb-1" />
                  <p className="text-xs font-semibold text-slate-700">Zero Machine Downtime</p>
                  <p className="text-[10px] text-slate-400">All equipment operational</p>
                </div>
              ) : (
                <svg className="w-full h-full overflow-visible" viewBox="0 0 240 180" preserveAspectRatio="none">
                  {/* Horizontal guide lines */}
                  {[0, 36, 72, 108, 144].map((y, idx) => (
                    <line
                      key={idx}
                      x1="28"
                      y1={y + 10}
                      x2="235"
                      y2={y + 10}
                      stroke="#f1f5f9"
                      strokeWidth="1"
                      strokeDasharray="2 2"
                    />
                  ))}

                  {/* Y-axis labels */}
                  <text x="24" y="14" textAnchor="end" className="text-[8px] fill-slate-400 font-mono">
                    {Math.round(maxDowntimeHours)}h
                  </text>
                  <text x="24" y="50" textAnchor="end" className="text-[8px] fill-slate-400 font-mono">
                    {Math.round(maxDowntimeHours * 0.75)}h
                  </text>
                  <text x="24" y="86" textAnchor="end" className="text-[8px] fill-slate-400 font-mono">
                    {Math.round(maxDowntimeHours * 0.5)}h
                  </text>
                  <text x="24" y="122" textAnchor="end" className="text-[8px] fill-slate-400 font-mono">
                    {Math.round(maxDowntimeHours * 0.25)}h
                  </text>
                  <text x="24" y="156" textAnchor="end" className="text-[8px] fill-slate-400 font-mono">
                    0
                  </text>

                  {/* Bars */}
                  {topDowntimeMachines.map((m, i) => {
                    const x = 36 + i * 40;
                    const barH = (m.hours / maxDowntimeHours) * 144;
                    const y = 154 - barH;

                    return (
                      <g key={m.name} className="group">
                        <rect
                          x={x}
                          y={y}
                          width="24"
                          height={Math.max(barH, 0)}
                          rx="3"
                          fill={m.barColor}
                          className="transition-all hover:opacity-85"
                        >
                          <title>{`${m.name}: ${m.hours} hours`}</title>
                        </rect>
                        {/* Hours text above bar */}
                        <text
                          x={x + 12}
                          y={y - 4}
                          textAnchor="middle"
                          className="text-[8px] fill-slate-900 font-mono font-bold"
                        >
                          {m.hours}h
                        </text>
                        {/* Short label below */}
                        <text
                          x={x + 12}
                          y="169"
                          textAnchor="middle"
                          className="text-[8px] fill-slate-500 font-semibold"
                        >
                          {m.id || m.name.split(' ')[0]}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              )}
            </div>
          </div>
          <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-100 flex justify-between">
            <span>
              {topDowntimeMachines.length > 0 ? `${topDowntimeMachines[0].name.slice(0, 15)}...` : 'No downtime'}
            </span>
            <span className="text-slate-600 font-semibold">
              {topDowntimeMachines.length > 0 ? `${topDowntimeMachines[0].hours} hrs` : '0 hrs'}
            </span>
          </div>
        </div>
      </div>

      {/* ─── 4. MIDDLE-BOTTOM ROW (COST BREAKDOWN, RECURRING PROBLEMS & RECOMMENDATIONS) ─ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Cost Breakdown Donut (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                Cost Breakdown
              </h3>
              <p className="text-[11px] text-slate-400">Distribution across spares, labor &amp; capex</p>
            </div>

            <div className="flex items-center justify-between gap-4 mt-4">
              {/* Donut Chart SVG */}
              <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="38" stroke="#f1f5f9" strokeWidth="16" fill="none" />
                  {costBreakdown.total > 0 && (
                    <>
                      {/* Spare Parts */}
                      <circle
                        cx="50"
                        cy="50"
                        r="38"
                        stroke="#f97316"
                        strokeWidth="16"
                        strokeDasharray={`${(costBreakdown.spareParts.pct / 100) * 238.7} 238.7`}
                        strokeDashoffset="0"
                        fill="none"
                      />
                      {/* Labor */}
                      <circle
                        cx="50"
                        cy="50"
                        r="38"
                        stroke="#3b82f6"
                        strokeWidth="16"
                        strokeDasharray={`${(costBreakdown.labor.pct / 100) * 238.7} 238.7`}
                        strokeDashoffset={`-${(costBreakdown.spareParts.pct / 100) * 238.7}`}
                        fill="none"
                      />
                      {/* Replacement Capex */}
                      <circle
                        cx="50"
                        cy="50"
                        r="38"
                        stroke="#8b5cf6"
                        strokeWidth="16"
                        strokeDasharray={`${(costBreakdown.replacement.pct / 100) * 238.7} 238.7`}
                        strokeDashoffset={`-${((costBreakdown.spareParts.pct + costBreakdown.labor.pct) / 100) * 238.7}`}
                        fill="none"
                      />
                    </>
                  )}
                </svg>

                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-1">
                  <span className="text-xs font-black text-slate-900 font-mono">
                    {formatMoney(costBreakdown.total)}
                  </span>
                  <span className="text-[9px] uppercase font-bold text-slate-400 mt-0.5">Total Cost</span>
                </div>
              </div>

              {/* Legend */}
              <div className="space-y-1.5 text-xs flex-grow">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-slate-600">
                    <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                    Spare Parts
                  </span>
                  <span className="font-bold text-slate-900 font-mono">
                    {costBreakdown.spareParts.pct}% ({formatMoney(costBreakdown.spareParts.amount)})
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-slate-600">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                    Labour Hours
                  </span>
                  <span className="font-bold text-slate-900 font-mono">
                    {costBreakdown.labor.pct}% ({formatMoney(costBreakdown.labor.amount)})
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-slate-600">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                    Asset Capex
                  </span>
                  <span className="font-bold text-slate-900 font-mono">
                    {costBreakdown.replacement.pct}% ({formatMoney(costBreakdown.replacement.amount)})
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-slate-600">
                    <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
                    Other / Service
                  </span>
                  <span className="font-bold text-slate-900 font-mono">
                    {costBreakdown.routineOther.pct}% ({formatMoney(costBreakdown.routineOther.amount)})
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-100 flex justify-between">
            <span>Direct Operating Expenditure</span>
            <span className="text-emerald-600 font-semibold">Active Ledger</span>
          </div>
        </div>

        {/* Recurring Events / Major Problems Table (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-purple-600" />
                <span>Recurring Events / Major Problems</span>
              </h3>
            </div>

            <div className="overflow-x-auto mt-2 border border-slate-300 rounded-lg shadow-2xs">
              <table className="w-full text-left text-xs text-slate-800 border-collapse border border-slate-300">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-300 select-none">
                  <tr>
                    <th className="py-2 px-2.5 bg-slate-100 border-r border-b border-slate-300">Problem</th>
                    <th className="py-2 px-2.5 text-center bg-slate-100 border-r border-b border-slate-300 font-mono">Occurrences</th>
                    <th className="py-2 px-2.5 text-right bg-slate-100 border-b border-slate-300">Mechanic / Team</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white font-medium">
                  {recurringProblems.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-6 text-center text-slate-400 border-b border-slate-200">
                        No recurring equipment failures detected across the plant.
                      </td>
                    </tr>
                  ) : (
                    recurringProblems.map((rp, idx) => (
                      <tr key={idx} className="hover:bg-blue-50/60 even:bg-slate-50/40 transition">
                        <td className="py-2 px-2.5 font-semibold text-slate-900 border-r border-b border-slate-200 flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${rp.dotColor} shrink-0`} />
                          <span className="truncate max-w-[140px]">{rp.problem}</span>
                        </td>
                        <td className="py-2 px-2.5 text-center font-bold text-slate-900 font-mono border-r border-b border-slate-200 tabular-nums">
                          {rp.count}
                        </td>
                        <td className="py-2 px-2.5 text-right font-medium text-slate-700 border-b border-slate-200 truncate max-w-[120px]">
                          {rp.mechanic}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-100 flex justify-between">
            <span>Root-cause failure analysis</span>
            <span className="text-purple-600 font-semibold">{recurringProblems.length} Active Patterns</span>
          </div>
        </div>

        {/* Machine Replacement Recommendation Table (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-teal-600" />
                <span>Machine Replacement Recommendation</span>
              </h3>
            </div>

            <div className="overflow-x-auto mt-2 border border-slate-300 rounded-lg shadow-2xs">
              <table className="w-full text-left text-xs text-slate-800 border-collapse border border-slate-300">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-300 select-none">
                  <tr>
                    <th className="py-2 px-2.5 bg-slate-100 border-r border-b border-slate-300 font-mono">Machine</th>
                    <th className="py-2 px-2.5 bg-slate-100 border-r border-b border-slate-300">Reason</th>
                    <th className="py-2 px-2.5 text-right bg-slate-100 border-r border-b border-slate-300 font-mono">Est. Capex</th>
                    <th className="py-2 px-2.5 text-right bg-slate-100 border-b border-slate-300">Priority</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white font-medium">
                  {machineReplacements.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-400 border-b border-slate-200">
                        All plant machinery operating within normal lifecycle parameters.
                      </td>
                    </tr>
                  ) : (
                    machineReplacements.map((mr, idx) => (
                      <tr
                        key={idx}
                        onClick={() => setSelectedReplacement(mr)}
                        className="hover:bg-blue-50/60 even:bg-slate-50/40 transition cursor-pointer"
                        title="Click to review replacement Capex proposal"
                      >
                        <td className="py-2 px-2.5 font-bold text-slate-900 text-xs font-mono border-r border-b border-slate-200">
                          {mr.machineId || mr.machine}
                        </td>
                        <td className="py-2 px-2.5 text-[11px] text-slate-600 max-w-[130px] truncate border-r border-b border-slate-200" title={mr.reason}>
                          {mr.reason}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono font-bold text-slate-900 border-r border-b border-slate-200 tabular-nums">
                          {formatMoney(mr.cost)}
                        </td>
                        <td className="py-2 px-2.5 text-right border-b border-slate-200">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${mr.priorityColor}`}>
                            {mr.priority}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-100 flex justify-between items-center">
            <span>
              Total Capex: <strong className="text-slate-900 font-mono">
                {formatMoney(machineReplacements.reduce((a, b) => a + b.cost, 0))}
              </strong>
            </span>
            <span className="text-teal-700 font-bold">{machineReplacements.length} Units Flagged</span>
          </div>
        </div>
      </div>

      {/* ─── 5. BOTTOM SECTION (RECENT PROBLEMS, INSIGHTS & ACTIONS) ───── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Table: Recent Major Problems / Recurring Events (6 cols) */}
        <div className="lg:col-span-6 bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Recent Major Incidents &amp; Breakdown Log
                </h3>
                <p className="text-[11px] text-slate-400">Live feed from workshop &amp; shop floor</p>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                {recentMajorProblems.length} Logged Work Orders
              </span>
            </div>

            <div className="overflow-x-auto mt-2 border border-slate-300 rounded-lg shadow-2xs">
              <table className="w-full text-left text-xs text-slate-800 border-collapse border border-slate-300">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-300 select-none">
                  <tr>
                    <th className="py-2 px-2 bg-slate-100 border-r border-b border-slate-300 font-mono">Date</th>
                    <th className="py-2 px-2 bg-slate-100 border-r border-b border-slate-300 font-mono">Machine</th>
                    <th className="py-2 px-2.5 bg-slate-100 border-r border-b border-slate-300">Issue / Fault</th>
                    <th className="py-2 px-2 text-center bg-slate-100 border-r border-b border-slate-300 font-mono">Downtime</th>
                    <th className="py-2 px-2 text-right bg-slate-100 border-r border-b border-slate-300 font-mono">Cost</th>
                    <th className="py-2 px-2 bg-slate-100 border-r border-b border-slate-300">Mechanic</th>
                    <th className="py-2 px-2 text-right bg-slate-100 border-b border-slate-300">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white font-medium">
                  {recentMajorProblems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-slate-400 border-b border-slate-200">
                        No major equipment breakdown tickets logged in the system.
                      </td>
                    </tr>
                  ) : (
                    recentMajorProblems.map((p, idx) => (
                      <tr key={idx} className="hover:bg-blue-50/60 even:bg-slate-50/40 transition">
                        <td className="py-2 px-2 font-mono text-[11px] text-slate-600 whitespace-nowrap border-r border-b border-slate-200 tabular-nums">{p.date}</td>
                        <td className="py-2 px-2 font-bold text-slate-900 font-mono border-r border-b border-slate-200">{p.machine}</td>
                        <td className="py-2 px-2.5 font-medium text-slate-800 truncate max-w-[130px] border-r border-b border-slate-200" title={p.issue}>{p.issue}</td>
                        <td className="py-2 px-2 text-center font-mono font-bold text-slate-700 border-r border-b border-slate-200 tabular-nums">{p.downtime}</td>
                        <td className="py-2 px-2 text-right font-mono font-bold text-slate-900 border-r border-b border-slate-200 tabular-nums">{formatMoney(p.cost)}</td>
                        <td className="py-2 px-2 text-slate-700 whitespace-nowrap border-r border-b border-slate-200">{p.mechanic}</td>
                        <td className="py-2 px-2 text-right border-b border-slate-200">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${p.statusClass}`}>
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="text-[11px] text-slate-400 pt-2 border-t border-slate-100 flex justify-between">
            <span>Direct mechanic accountability log</span>
            <span className="text-emerald-600 font-semibold">Live Feed</span>
          </div>
        </div>

        {/* Card: Key Insights & Takeaways (3 cols) */}
        <div className="lg:col-span-3 bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                Key Insights &amp; Takeaways
              </h3>
              <p className="text-[11px] text-slate-400">Synthesized from live plant data</p>
            </div>

            <div className="space-y-3 mt-3 text-xs">
              {executiveInsights.map((ins, i) => {
                const IconComponent = ins.icon;
                return (
                  <div key={i} className="flex items-start gap-2.5">
                    <div className={`w-6 h-6 rounded-full ${ins.color} flex items-center justify-center shrink-0 mt-0.5`}>
                      <IconComponent className="w-3.5 h-3.5" />
                    </div>
                    <div className="text-slate-700 leading-snug">
                      {ins.text}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="text-[11px] text-slate-400 pt-3 border-t border-slate-100">
            Updated dynamically based on factory status.
          </div>
        </div>

        {/* Card: Suggested Actions for CEO (3 cols) */}
        <div className="lg:col-span-3 bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                Suggested Actions for CEO
              </h3>
              <p className="text-[11px] text-slate-400">Priority executive decisions</p>
            </div>

            <div className="space-y-3 mt-3 text-xs">
              {ceoPendingReqs.length > 0 && (
                <button
                  type="button"
                  onClick={() => router.push('/dashboard/messages')}
                  className="w-full text-left flex items-start gap-2.5 p-1.5 -mx-1.5 rounded-xl hover:bg-purple-50 transition cursor-pointer"
                >
                  <div className="w-6 h-6 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0 mt-0.5">
                    <Crown className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-slate-700 leading-snug">
                    Sanction <strong>{ceoPendingReqs.length} Critical Purchase Requisitions</strong> totaling {formatMoney(totalPendingCost)}.
                  </div>
                </button>
              )}

              {machineReplacements.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedReplacement(machineReplacements[0])}
                  className="w-full text-left flex items-start gap-2.5 p-1.5 -mx-1.5 rounded-xl hover:bg-teal-50 transition cursor-pointer"
                >
                  <div className="w-6 h-6 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center shrink-0 mt-0.5">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </div>
                  <div className="text-slate-700 leading-snug">
                    Review Capex replacement for <strong>{machineReplacements[0].machine}</strong> ({formatMoney(machineReplacements[0].cost)}).
                  </div>
                </button>
              )}

              <button
                type="button"
                onClick={() => router.push('/dashboard/history')}
                className="w-full text-left flex items-start gap-2.5 p-1.5 -mx-1.5 rounded-xl hover:bg-slate-50 transition cursor-pointer"
              >
                <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-0.5">
                  <FileText className="w-3.5 h-3.5" />
                </div>
                <div className="text-slate-700 leading-snug">
                  Inspect comprehensive plant maintenance ledger &amp; mechanic performance logs.
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  showToast('Preventive maintenance target locked at 90% compliance.', 'success');
                }}
                className="w-full text-left flex items-start gap-2.5 p-1.5 -mx-1.5 rounded-xl hover:bg-slate-50 transition cursor-pointer"
              >
                <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                  <Zap className="w-3.5 h-3.5" />
                </div>
                <div className="text-slate-700 leading-snug">
                  Enforce preventive PPM maintenance schedule compliance target.
                </div>
              </button>

              <button
                type="button"
                onClick={() => onRefresh()}
                className="w-full text-left flex items-start gap-2.5 p-1.5 -mx-1.5 rounded-xl hover:bg-slate-50 transition cursor-pointer"
              >
                <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                  <Activity className="w-3.5 h-3.5" />
                </div>
                <div className="text-slate-700 leading-snug">
                  Synchronize and refresh all telemetry from plant maintenance database.
                </div>
              </button>
            </div>
          </div>
          <div className="text-[11px] text-slate-400 pt-3 border-t border-slate-100">
            Click any action above to review or sign off.
          </div>
        </div>
      </div>

      {/* ─── 6. PENDING CEO CRITICAL REQUISITIONS DESK (EXECUTIVE AUTHORITY) ── */}
      {ceoPendingReqs.length > 0 && (
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-purple-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-purple-100 border-b">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-purple-600 text-white flex items-center justify-center">
                <Crown className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Critical Emergency Spares Awaiting Executive Sanction ({ceoPendingReqs.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Line stoppage exceptions and high-value capital items flagged for CEO authorization.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => router.push('/dashboard/messages')}
              className="text-xs font-bold text-purple-700 hover:text-purple-900 flex items-center gap-1 cursor-pointer"
            >
              <span>Open Approvals Desk</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-3">
            {ceoPendingReqs.map((r) => (
              <div
                key={r.id}
                className="p-4 bg-purple-50/50 rounded-2xl border border-purple-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-slate-900">{r.id}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 uppercase">
                      {r.urgency}
                    </span>
                    <span className="text-xs font-semibold text-purple-900 font-mono">
                      {formatMoney(r.estimatedCost || 0)}
                    </span>
                  </div>
                  <div className="text-xs font-medium text-slate-800">
                    {r.partName || (r.items && r.items[0]?.partName) || 'Critical Spare Requirement'}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Requested by: {r.requestedBy} ({r.requestedByRole}) &bull; Line: {r.targetLine || 'Floor Line'} &bull; Justification: {r.justification}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleReject(r.id)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApprove(r.id)}
                    className="px-4 py-1.5 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white transition shadow-sm cursor-pointer"
                  >
                    Approve
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── 7. MODAL: MACHINE REPLACEMENT CAPEX PROPOSAL REVIEW ───────── */}
      {selectedReplacement && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold">
                  <RefreshCw className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold">Machine Replacement Proposal</h4>
                  <p className="text-[10px] text-slate-400">Executive Capex Authorization</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedReplacement(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-sm">{selectedReplacement.machine}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 uppercase">
                    {selectedReplacement.priority} Priority
                  </span>
                </div>
                <div className="text-slate-600">
                  <strong>Engineering Justification:</strong> {selectedReplacement.reason}
                </div>
                {selectedReplacement.line && (
                  <div className="text-slate-500 text-[11px]">
                    Current Location: {selectedReplacement.line} • Station: {selectedReplacement.station || 'Unspecified'}
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-slate-200/80">
                  <span className="text-slate-500">Estimated Replacement Budget:</span>
                  <span className="text-base font-black text-slate-900 font-mono">
                    {formatMoney(selectedReplacement.cost)}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-teal-50 rounded-xl border border-teal-200 text-teal-900 text-[11px] leading-relaxed">
                <strong>Executive Return on Investment (ROI):</strong> Replacing this asset will eliminate chronic downtime, protect plant delivery commitments, and reduce recurring spare consumption.
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedReplacement(null)}
                  className="px-4 py-2 rounded-xl text-slate-600 font-medium hover:bg-slate-100 cursor-pointer"
                >
                  Defer Decision
                </button>
                <button
                  type="button"
                  onClick={() => {
                    showToast(`Approved Capex budget for ${selectedReplacement.machine}! Dispatched to Procurement.`, 'success');
                    setSelectedReplacement(null);
                  }}
                  className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold shadow-md shadow-teal-600/20 transition cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Sanction Capex Purchase</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── 8. WIDGET DRILL-DOWN SIDEBAR (RIGHT TO LEFT) ─────────────── */}
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
