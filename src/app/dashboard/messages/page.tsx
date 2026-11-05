'use client';

import { textValue } from '@/lib/textValue';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Bell,
  AlertTriangle,
  Clock,
  Flame,
  ShieldAlert,
  Wrench,
  CheckCircle2,
  XCircle,
  User,
  Layers,
  Search,
  Filter,
  RotateCw,
  Volume2,
  VolumeX,
  ArrowRight,
  ExternalLink,
  Package,
  Calendar,
  ChevronRight,
  Sparkles,
  Check,
  X,
  ChevronDown,
  Building2,
  Activity,
  Boxes,
  Phone,
  Radio,
  FileText,
  IndianRupee,
  ArrowRightLeft,
  ShieldCheck,
  Crown,
  Zap,
  Lock,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import {
  RepairTicket,
  PPMSchedule,
  SparePart,
  Machine,
  PartRequisition,
  AppNotification,
  AssetLogEntry,
  UserRole,
} from '@/types/cmms';
import {
  subscribeRepairs,
  subscribePPMSchedules,
  subscribeParts,
  subscribeMachines,
  subscribeRequisitions,
  subscribeNotifications,
  assignRepairTicket,
  startRepairTicket,
  rejectRepairTicket,
  acknowledgeAppNotification,
  approveRequisition,
  rejectRequisition,
} from '@/lib/services/cmmsService';
import { subscribeAssetLogs } from '@/lib/services/assetLogService';
import { matchesUnit, isUserAdmin, getUserScopedUnit } from '@/lib/constants/units';
import { normalizeRole } from '@/lib/constants/roles';

// Available factory technicians with assigned plant units for smart unit-targeted dispatch
export interface TechnicianRosterItem {
  name: string;
  role: string;
  phone: string;
  trade: 'MECHANIC' | 'ELECTRICIAN';
  unit: string;
}

export type NotificationCategory =
  | 'ALL'
  | 'UNATTENDED_5M'
  | 'BREAKDOWN_WARNING'
  | 'ASSET_ACTIONS'
  | 'PPM_OVERDUE'
  | 'LOW_STOCK'
  | 'APPROVALS';

export type RoleScope =
  | 'MY_ROLE'
  | 'ALL_ROLES'
  | 'ROLE_MECHANIC'
  | 'ROLE_ELECTRICIAN'
  | 'ROLE_STORE'
  | 'ROLE_SUPERVISOR'
  | 'ROLE_EXECUTIVE';

export interface UnifiedNotificationItem {
  id: string;
  category: 'UNATTENDED_5M' | 'BREAKDOWN_WARNING' | 'ASSET_ACTION' | 'PPM_OVERDUE' | 'LOW_STOCK' | 'APPROVAL' | 'GENERAL';
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  title: string;
  message: string;
  timestamp: string; // ISO
  machineId?: string;
  machineName?: string;
  line?: string;
  stationNo?: string;
  unit?: string;
  faultCategory?: string;
  attendedBy?: string | null;
  previousStatus?: string;
  newStatus?: string;
  assetActionType?: string;
  elapsedMinutes: number;
  elapsedSeconds: number;
  isUnattended5Mins: boolean;
  targetRoles: UserRole[] | 'ALL';
  targetTrade?: 'MECHANIC' | 'ELECTRICIAN' | 'ALL';
  rawRepair?: RepairTicket;
  rawPpm?: PPMSchedule;
  rawPart?: SparePart;
  rawReq?: PartRequisition;
  rawNotif?: AppNotification;
  rawAssetLog?: AssetLogEntry;
  acknowledged?: boolean;
}

export default function NotificationsPage() {
  const { user, role } = useAuth();
  const { showToast } = useToast();

  const currentRole = useMemo(() => {
    return normalizeRole(user?.role || role);
  }, [user?.role, role]);

  const userAssignedUnit = useMemo(() => {
    return user?.unit && textValue(user.unit).trim().length > 0 ? textValue(user.unit).trim() : 'All Units';
  }, [user?.unit]);

  const isAdmin = currentRole === 'ADMIN' || currentRole === 'ASSET_MANAGER' || currentRole === 'CEO';

  // Live real-time tick (updates every 1000ms for live stopwatch on unattended issues)
  const [nowMs, setNowMs] = useState<number>(Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Raw subscriptions
  const [repairs, setRepairs] = useState<RepairTicket[]>([]);
  const [ppmSchedules, setPpmSchedules] = useState<PPMSchedule[]>([]);
  const [parts, setParts] = useState<SparePart[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [requisitions, setRequisitions] = useState<PartRequisition[]>([]);
  const [appNotifs, setAppNotifs] = useState<AppNotification[]>([]);
  const [assetLogs, setAssetLogs] = useState<AssetLogEntry[]>([]);

  // User UI controls
  const [activeTab, setActiveTab] = useState<NotificationCategory>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUnit, setSelectedUnit] = useState<string>('ALL');
  const [selectedRoleScope, setSelectedRoleScope] = useState<RoleScope>('MY_ROLE');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('ALL');
  const [isMuted, setIsMuted] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // Assign Mechanic Modal state
  const [assigningItem, setAssigningItem] = useState<UnifiedNotificationItem | null>(null);
  const [selectedMechanic, setSelectedMechanic] = useState<string>('');
  const [dbUsers, setDbUsers] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/users')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.users)) {
          setDbUsers(data.users);
        }
      })
      .catch((err) => console.warn('Failed to load users for dispatch:', err));
  }, []);

  const dynamicTechnicians: TechnicianRosterItem[] = useMemo(() => {
    return dbUsers
      .filter((u) => {
        const role = String(u.role || '').toUpperCase();
        return (
          role.includes('MECH') ||
          role.includes('ELEC') ||
          role.includes('TECH') ||
          role.includes('MAINT')
        );
      })
      .map((u) => {
        const role = String(u.role || '').toUpperCase();
        const isElectrician = role.includes('ELEC');
        return {
          name: u.name || 'Technician',
          role: u.title || (isElectrician ? 'Plant Electrician' : 'Line Sewing Mechanic'),
          phone: u.phone || '',
          trade: isElectrician ? 'ELECTRICIAN' : 'MECHANIC',
          unit: u.unit || 'UNIT - 1',
        };
      });
  }, [dbUsers]);

  const handleOpenAssignModal = (item: UnifiedNotificationItem) => {
    setAssigningItem(item);
    const candidate = dynamicTechnicians.find((m) =>
      item.unit ? matchesUnit(m.unit, item.unit) : true
    );
    setSelectedMechanic(candidate ? candidate.name : dynamicTechnicians[0]?.name || '');
  };

  // Subscribe to CMMS and Asset Log streams
  useEffect(() => {
    const unsubRepairs = subscribeRepairs((data) => setRepairs(data));
    const unsubPpm = subscribePPMSchedules((data) => setPpmSchedules(data));
    const unsubParts = subscribeParts((data) => setParts(data));
    const unsubMachines = subscribeMachines((data) => setMachines(data));
    const unsubReqs = subscribeRequisitions((data) => setRequisitions(data));
    const unsubNotifs = subscribeNotifications((data) => setAppNotifs(data));
    const unsubAssetLogs = subscribeAssetLogs((data) => setAssetLogs(data));

    return () => {
      unsubRepairs();
      unsubPpm();
      unsubParts();
      unsubMachines();
      unsubReqs();
      unsubNotifs();
      unsubAssetLogs();
    };
  }, []);

  // Effective unit scoping:
  // If user is non-admin and marked for a specific unit (e.g. "UNIT - 1" or "UNIT-2"),
  // they are strictly locked to their unit.
  // Admins & CEOs can toggle selectedUnit freely.
  const effectiveUnit = useMemo(() => {
    if (isAdmin) {
      return selectedUnit;
    }
    if (userAssignedUnit && userAssignedUnit !== 'All Units' && userAssignedUnit !== 'ALL') {
      return userAssignedUnit;
    }
    return selectedUnit;
  }, [isAdmin, userAssignedUnit, selectedUnit]);



  // Helper to determine if a defect is electrical
  const isElectricalDefect = (faultCategory?: string, faultDetails?: string, machineType?: string) => {
    const text = `${faultCategory || ''} ${faultDetails || ''} ${machineType || ''}`.toLowerCase();
    return (
      text.includes('motor') ||
      text.includes('elec') ||
      text.includes('power') ||
      text.includes('fuse') ||
      text.includes('sensor') ||
      text.includes('switch') ||
      text.includes('inverter') ||
      text.includes('servo') ||
      text.includes('circuit') ||
      text.includes('wire') ||
      text.includes('cable') ||
      text.includes('display') ||
      text.includes('panel')
    );
  };

  // Build unified notification items from live streams & seeds
  const allNotifications = useMemo(() => {
    const list: UnifiedNotificationItem[] = [];

    // 1. Process Live Repairs (Machine Breakdowns & Defect Reports)
    repairs.forEach((rep) => {
      if (rep.status === 'COMPLETED') return;

      const reportedTime = rep.reportedAt ? new Date(rep.reportedAt).getTime() : nowMs;
      const elapsedMs = Math.max(0, nowMs - reportedTime);
      const elapsedSec = Math.floor(elapsedMs / 1000);
      const elapsedMin = Math.floor(elapsedSec / 60);

      const hasAttendant = Boolean(
        rep.attendedBy &&
        textValue(rep.attendedBy).trim() !== '' &&
        textValue(rep.attendedBy).toLowerCase() !== 'unassigned'
      );
      const isUnattended = !hasAttendant && rep.status === 'PENDING';
      const isOver5Mins = isUnattended && elapsedMin >= 5;

      const matchingMachine = machines.find(
        (m) => textValue(m.id).toLowerCase() === textValue((rep.machineId || '')).toLowerCase()
      );
      const machineName = matchingMachine?.name || matchingMachine?.typeName || rep.machineType || 'Industrial Machine';
      const line = rep.line || matchingMachine?.currentLine || 'Line 01';
      const stationNo = matchingMachine?.stationNo || 'Station 01';

      // Scoped Unit of the broken machine
      const machineUnit = rep.unit || matchingMachine?.unit || (rep as any).unit || 'UNIT - 1';

      // Trade determination
      const isElec = isElectricalDefect(rep.faultCategory, rep.faultDetails, rep.machineType);
      const targetTrade: 'ELECTRICIAN' | 'MECHANIC' = isElec ? 'ELECTRICIAN' : 'MECHANIC';
      const targetRoles: UserRole[] = isElec
        ? ['ELECTRICIAN', 'SENIOR_ELECTRICIAN', 'ADMIN', 'ASSET_MANAGER']
        : ['MECHANIC', 'SENIOR_MECHANIC', 'ADMIN', 'ASSET_MANAGER'];

      if (isOver5Mins) {
        list.push({
          id: `NOTIF-UNATTENDED-${rep.id}`,
          category: 'UNATTENDED_5M',
          severity: 'CRITICAL',
          title: `🚨 SLA Breach: Breakdown Unattended for > 5 Minutes`,
          message: `${rep.machineId} on ${line} (${stationNo}) has been waiting unattended for ${elapsedMin}m ${elapsedSec % 60}s. Fault: ${rep.faultCategory || rep.faultDetails}`,
          timestamp: rep.reportedAt || new Date().toISOString(),
          machineId: rep.machineId,
          machineName,
          line,
          stationNo,
          unit: machineUnit,
          faultCategory: rep.faultCategory,
          attendedBy: null,
          elapsedMinutes: elapsedMin,
          elapsedSeconds: elapsedSec,
          isUnattended5Mins: true,
          targetRoles,
          targetTrade,
          rawRepair: rep,
        });
      } else {
        const isCriticalUrgency = rep.urgency === 'CRITICAL' || elapsedMin > 30;
        list.push({
          id: `NOTIF-BREAKDOWN-${rep.id}`,
          category: 'BREAKDOWN_WARNING',
          severity: isCriticalUrgency ? 'CRITICAL' : 'WARNING',
          title: isCriticalUrgency
            ? `🔥 Critical Breakdown Warning: ${rep.machineId}`
            : `⚠️ Breakdown Ticket Active: ${rep.machineId}`,
          message: `${line} (${stationNo}): ${rep.faultCategory || 'Defect'} - ${rep.faultDetails}. Attended by: ${rep.attendedBy || 'Awaiting assignment'}.`,
          timestamp: rep.reportedAt || new Date().toISOString(),
          machineId: rep.machineId,
          machineName,
          line,
          stationNo,
          unit: machineUnit,
          faultCategory: rep.faultCategory,
          attendedBy: rep.attendedBy,
          elapsedMinutes: elapsedMin,
          elapsedSeconds: elapsedSec,
          isUnattended5Mins: false,
          targetRoles,
          targetTrade,
          rawRepair: rep,
        });
      }
    });

    // 2. Process Actions Done on Assets (from AssetLogEntry stream)
    assetLogs.forEach((log) => {
      const logTime = log.changedAt ? new Date(log.changedAt).getTime() : nowMs;
      const elapsedMs = Math.max(0, nowMs - logTime);
      const elapsedSec = Math.floor(elapsedMs / 1000);
      const elapsedMin = Math.floor(elapsedSec / 60);

      let title = `🛠️ Asset Action: ${log.machineId}`;
      let severity: 'CRITICAL' | 'WARNING' | 'INFO' = 'INFO';

      if (log.action === 'IDLE_TO_ACTIVE' || log.newStatus === 'ACTIVE') {
        title = `⚡ Asset Activated: ${log.machineId} moved to ACTIVE on ${log.line || 'Line'}`;
        severity = 'INFO';
      } else if (log.action === 'ACTIVE_TO_IDLE' || log.newStatus === 'IDLE') {
        title = `⏸️ Asset Set to Standby: ${log.machineId} placed on IDLE (${log.line || 'Floor'})`;
        severity = 'WARNING';
      } else if (log.action === 'ZONE_LINE_CHANGE') {
        title = `🔄 Asset Relocated: ${log.machineId} assigned to ${log.zone || ''} • ${log.line || ''} (${log.stationNo || 'Station'})`;
        severity = 'INFO';
      } else if (log.newStatus === 'BREAKDOWN') {
        title = `🚨 Asset Breakdown Logged: ${log.machineId} transitioned to BREAKDOWN`;
        severity = 'CRITICAL';
      } else if (log.action === 'STATUS_CHANGE') {
        title = `🏷️ Asset Status: ${log.machineId} changed from ${log.previousStatus} ➔ ${log.newStatus}`;
        severity = log.newStatus === 'UNDER_MAINTENANCE' ? 'WARNING' : 'INFO';
      }

      list.push({
        id: `NOTIF-ASSET-${log.id}`,
        category: 'ASSET_ACTION',
        severity,
        title,
        message: `${log.notes || `Asset ${log.machineName || log.machineId} status transitioned to ${log.newStatus}`}. Logged by ${log.changedBy || 'Technician'} (${log.shift || 'Shift A'}).`,
        timestamp: log.changedAt || new Date().toISOString(),
        machineId: log.machineId,
        machineName: log.machineName,
        line: log.line,
        stationNo: log.stationNo,
        unit: log.unit || log.machineUnit || 'UNIT - 1',
        attendedBy: log.changedBy,
        previousStatus: log.previousStatus,
        newStatus: log.newStatus,
        assetActionType: log.action,
        elapsedMinutes: elapsedMin,
        elapsedSeconds: elapsedSec,
        isUnattended5Mins: false,
        targetRoles: ['ADMIN', 'ASSET_MANAGER', 'SENIOR_MECHANIC', 'SENIOR_ELECTRICIAN', 'CEO'],
        targetTrade: 'ALL',
        rawAssetLog: log,
      });
    });

    // 3. Process Overdue PPMs
    ppmSchedules.forEach((ppm) => {
      if (ppm.status === 'OVERDUE' || (ppm.status === 'PENDING' && new Date(ppm.nextDue).getTime() < nowMs)) {
        const matchingMachine = machines.find(
          (m) => textValue(m.id).toLowerCase() === textValue((ppm.machineId || '')).toLowerCase()
        );
        const machineName = matchingMachine?.name || matchingMachine?.typeName || 'Sewing Machine';
        const line = matchingMachine?.currentLine || 'Line 01';
        const stationNo = matchingMachine?.stationNo || 'Station 01';
        const unit = ppm.unit || matchingMachine?.unit || 'UNIT - 1';

        const isElec = textValue(ppm.task)?.toLowerCase().includes('elec') || textValue(ppm.task)?.toLowerCase().includes('motor');
        const targetTrade: 'ELECTRICIAN' | 'MECHANIC' = isElec ? 'ELECTRICIAN' : 'MECHANIC';
        const targetRoles: UserRole[] = isElec
          ? ['ELECTRICIAN', 'SENIOR_ELECTRICIAN', 'ADMIN', 'ASSET_MANAGER']
          : ['MECHANIC', 'SENIOR_MECHANIC', 'ADMIN', 'ASSET_MANAGER'];

        list.push({
          id: `NOTIF-PPM-${ppm.id}`,
          category: 'PPM_OVERDUE',
          severity: 'WARNING',
          title: `⏱️ PPM Overdue: ${ppm.machineId} (${ppm.frequency})`,
          message: `${ppm.task} on ${line} (${stationNo}) was due on ${ppm.nextDue}. Machine requires immediate calibration & servicing.`,
          timestamp: ppm.nextDue,
          machineId: ppm.machineId,
          machineName,
          line,
          stationNo,
          unit,
          faultCategory: 'Preventive Maintenance Service',
          elapsedMinutes: 60,
          elapsedSeconds: 3600,
          isUnattended5Mins: false,
          targetRoles,
          targetTrade,
          rawPpm: ppm,
        });
      }
    });

    // 4. Process Low Stock alerts
    parts.forEach((part) => {
      if (part.stock <= part.minStock) {
        list.push({
          id: `NOTIF-STOCK-${part.partId || (part as any).id || Math.random()}`,
          category: 'LOW_STOCK',
          severity: part.stock === 0 ? 'CRITICAL' : 'WARNING',
          title: part.stock === 0 ? `🚨 Out of Stock: ${part.name}` : `📦 Low Stock Alert: ${part.name}`,
          message: `${part.name} (${part.sku}) inventory at ${part.stock} ${part.unit} (Safety min: ${part.minStock}). Reorder indent required immediately.`,
          timestamp: new Date().toISOString(),
          unit: part.unit || ((part as any).location?.includes('UNIT-2') ? 'UNIT-2' : 'UNIT - 1'),
          faultCategory: 'Spare Parts Reorder Level',
          elapsedMinutes: 10,
          elapsedSeconds: 600,
          isUnattended5Mins: false,
          targetRoles: ['STORE_PERSON', 'ADMIN', 'ASSET_MANAGER', 'SENIOR_MECHANIC'],
          targetTrade: 'ALL',
          rawPart: part,
        });
      }
    });

    // 5. Process Capex Requisitions requiring CEO/Executive approval
    requisitions.forEach((req) => {
      if (req.status === 'PENDING_CEO_APPROVAL') {
        const matchingMachine = machines.find((m) => m.id === req.targetMachineId);
        const reqUnit = req.unit || matchingMachine?.unit || 'UNIT - 1';

        list.push({
          id: `NOTIF-REQ-${req.id}`,
          category: 'APPROVAL',
          severity: 'CRITICAL',
          title: `👑 Executive Approval Required: ₹${(req.estimatedCost || 0).toLocaleString()} Capex Indent`,
          message: `Emergency purchase request for "${req.partName}" on ${req.targetMachineId || req.targetLine}. Justification: ${req.justification || 'Critical floor maintenance'}. Requested by ${req.requestedBy}.`,
          timestamp: req.createdAt || new Date().toISOString(),
          machineId: req.targetMachineId,
          line: req.targetLine,
          unit: reqUnit,
          faultCategory: 'Capex Requisition Approval',
          elapsedMinutes: 30,
          elapsedSeconds: 1800,
          isUnattended5Mins: false,
          targetRoles: ['CEO', 'ADMIN', 'ASSET_MANAGER'],
          targetTrade: 'ALL',
          rawReq: req,
        });
      }
    });

    // 6. Process In-App Broadcast Notifications (sendAppNotification stream)
    appNotifs.forEach((notif) => {
      const elapsedMs = Math.max(0, nowMs - new Date(notif.createdAt).getTime());
      const elapsedSec = Math.floor(elapsedMs / 1000);
      const elapsedMin = Math.floor(elapsedSec / 60);

      const notifUnit = notif.targetUnit || (notif as any).unit || notif.meta?.unit || 'All Units';
      const notifTargetRoles: UserRole[] | 'ALL' = notif.targetRole && notif.targetRole !== 'ALL'
        ? [notif.targetRole, 'ADMIN', 'ASSET_MANAGER']
        : 'ALL';

      list.push({
        id: `NOTIF-APP-${notif.id}`,
        category: notif.type === 'RESTOCK_ALERT' || notif.type === 'SPARE_ISSUE_RECEIPT'
          ? 'LOW_STOCK'
          : notif.type === 'CRITICAL_BREAKDOWN'
            ? 'BREAKDOWN_WARNING'
            : 'GENERAL',
        severity: notif.type === 'CRITICAL_BREAKDOWN' ? 'CRITICAL' : notif.type === 'RESTOCK_ALERT' ? 'WARNING' : 'INFO',
        title: notif.title,
        message: notif.message,
        timestamp: notif.createdAt,
        unit: notifUnit,
        elapsedMinutes: elapsedMin,
        elapsedSeconds: elapsedSec,
        isUnattended5Mins: false,
        targetRoles: notifTargetRoles,
        targetTrade: 'ALL',
        rawNotif: notif,
        acknowledged: notif.acknowledged,
      });
    });

    // Ensure all notifications appear strictly newest first (newest message on top)
    list.sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeB - timeA;
    });

    return list;
  }, [repairs, assetLogs, ppmSchedules, parts, machines, requisitions, appNotifs, nowMs]);

  // Helper to match notification to target role scope
  const matchesRoleScope = (item: UnifiedNotificationItem, scope: RoleScope): boolean => {
    if (scope === 'ALL_ROLES') return true;

    // MY_ROLE auto-scoping based on logged-in user
    if (scope === 'MY_ROLE') {
      if (isAdmin) return true; // Admins and Asset Managers see plant-wide alerts by default
      if (currentRole === 'MECHANIC') {
        return (
          item.targetTrade === 'MECHANIC' ||
          item.targetTrade === 'ALL' ||
          (Array.isArray(item.targetRoles) && item.targetRoles.includes('MECHANIC')) ||
          item.targetRoles === 'ALL'
        );
      }
      if (currentRole === 'ELECTRICIAN') {
        return (
          item.targetTrade === 'ELECTRICIAN' ||
          item.targetTrade === 'ALL' ||
          (Array.isArray(item.targetRoles) && item.targetRoles.includes('ELECTRICIAN')) ||
          item.targetRoles === 'ALL'
        );
      }
      if (currentRole === 'STORE_PERSON') {
        return (
          item.category === 'LOW_STOCK' ||
          (Array.isArray(item.targetRoles) && item.targetRoles.includes('STORE_PERSON')) ||
          item.targetRoles === 'ALL'
        );
      }
      if (currentRole === 'SENIOR_MECHANIC' || currentRole === 'SENIOR_ELECTRICIAN') {
        return (
          item.category === 'UNATTENDED_5M' ||
          item.category === 'BREAKDOWN_WARNING' ||
          item.category === 'ASSET_ACTION' ||
          item.category === 'PPM_OVERDUE' ||
          (Array.isArray(item.targetRoles) && (item.targetRoles.includes('SENIOR_MECHANIC') || item.targetRoles.includes('SENIOR_ELECTRICIAN')))
        );
      }
      if (currentRole === 'CEO') {
        return (
          item.category === 'APPROVAL' ||
          item.isUnattended5Mins ||
          (Array.isArray(item.targetRoles) && item.targetRoles.includes('CEO'))
        );
      }
    }

    if (scope === 'ROLE_MECHANIC') {
      return (
        item.targetTrade === 'MECHANIC' ||
        (Array.isArray(item.targetRoles) && item.targetRoles.includes('MECHANIC'))
      );
    }
    if (scope === 'ROLE_ELECTRICIAN') {
      return (
        item.targetTrade === 'ELECTRICIAN' ||
        (Array.isArray(item.targetRoles) && item.targetRoles.includes('ELECTRICIAN'))
      );
    }
    if (scope === 'ROLE_STORE') {
      return (
        item.category === 'LOW_STOCK' ||
        (Array.isArray(item.targetRoles) && item.targetRoles.includes('STORE_PERSON'))
      );
    }
    if (scope === 'ROLE_SUPERVISOR') {
      return (
        item.category === 'UNATTENDED_5M' ||
        item.category === 'BREAKDOWN_WARNING' ||
        item.category === 'ASSET_ACTION' ||
        item.category === 'PPM_OVERDUE' ||
        (Array.isArray(item.targetRoles) && (item.targetRoles.includes('SENIOR_MECHANIC') || item.targetRoles.includes('SENIOR_ELECTRICIAN')))
      );
    }
    if (scope === 'ROLE_EXECUTIVE') {
      return (
        item.category === 'APPROVAL' ||
        (Array.isArray(item.targetRoles) && item.targetRoles.includes('CEO'))
      );
    }

    return true;
  };

  // Base list filtered strictly by Role Scope and Unit Assignment
  const roleAndUnitScopedNotifications = useMemo(() => {
    return allNotifications.filter((item) => {
      if (dismissedIds.has(item.id)) return false;

      // 1. Strict Unit Scoping:
      // If effectiveUnit is "UNIT - 1", only show defects and alerts from "UNIT - 1" (or plant-wide "All Units")
      if (effectiveUnit !== 'ALL' && effectiveUnit !== 'All Units') {
        const itemUnit = item.unit || 'All Units';
        const isPlantWide = itemUnit === 'All Units' || itemUnit === 'Plant-wide' || itemUnit === 'ALL';
        if (!isPlantWide && !matchesUnit(itemUnit, effectiveUnit)) {
          return false;
        }
      }

      // 2. Strict Role Scoping
      if (!matchesRoleScope(item, selectedRoleScope)) {
        return false;
      }

      return true;
    });
  }, [allNotifications, effectiveUnit, selectedRoleScope, dismissedIds]);

  // Tab & secondary filtered notifications
  const filteredNotifications = useMemo(() => {
    return roleAndUnitScopedNotifications.filter((item) => {
      // Tab Category filter
      if (activeTab === 'UNATTENDED_5M' && !item.isUnattended5Mins) return false;
      if (activeTab === 'BREAKDOWN_WARNING' && item.category !== 'BREAKDOWN_WARNING' && item.category !== 'UNATTENDED_5M') return false;
      if (activeTab === 'ASSET_ACTIONS' && item.category !== 'ASSET_ACTION') return false;
      if (activeTab === 'PPM_OVERDUE' && item.category !== 'PPM_OVERDUE') return false;
      if (activeTab === 'LOW_STOCK' && item.category !== 'LOW_STOCK') return false;
      if (activeTab === 'APPROVALS' && item.category !== 'APPROVAL') return false;

      // Severity filter
      if (selectedSeverity !== 'ALL' && item.severity !== selectedSeverity) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = textValue(item.title).toLowerCase().includes(q);
        const matchesMessage = textValue(item.message).toLowerCase().includes(q);
        const matchesMachine = textValue((item.machineId || '')).toLowerCase().includes(q);
        const matchesLine = textValue((item.line || '')).toLowerCase().includes(q);
        const matchesTech = textValue((item.attendedBy || '')).toLowerCase().includes(q);
        const matchesUnitField = textValue((item.unit || '')).toLowerCase().includes(q);
        if (!matchesTitle && !matchesMessage && !matchesMachine && !matchesLine && !matchesTech && !matchesUnitField) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeB - timeA;
    });
  }, [roleAndUnitScopedNotifications, activeTab, selectedSeverity, searchQuery]);

  // Counts for tabs & badges dynamically reflecting active role and unit scopes
  const unattended5MCount = useMemo(() => {
    return roleAndUnitScopedNotifications.filter((n) => n.isUnattended5Mins).length;
  }, [roleAndUnitScopedNotifications]);

  const breakdownWarningCount = useMemo(() => {
    return roleAndUnitScopedNotifications.filter((n) => n.category === 'BREAKDOWN_WARNING' || n.category === 'UNATTENDED_5M').length;
  }, [roleAndUnitScopedNotifications]);

  const assetActionsCount = useMemo(() => {
    return roleAndUnitScopedNotifications.filter((n) => n.category === 'ASSET_ACTION').length;
  }, [roleAndUnitScopedNotifications]);

  const ppmOverdueCount = useMemo(() => {
    return roleAndUnitScopedNotifications.filter((n) => n.category === 'PPM_OVERDUE').length;
  }, [roleAndUnitScopedNotifications]);

  const lowStockCount = useMemo(() => {
    return roleAndUnitScopedNotifications.filter((n) => n.category === 'LOW_STOCK').length;
  }, [roleAndUnitScopedNotifications]);

  const approvalsCount = useMemo(() => {
    return roleAndUnitScopedNotifications.filter((n) => n.category === 'APPROVAL').length;
  }, [roleAndUnitScopedNotifications]);

  // Handlers
  const handleDismiss = (id: string) => {
    setDismissedIds((prev) => new Set([...prev, id]));
    showToast('Notification cleared from active queue', 'info');
  };

  const handleClearAll = () => {
    const ids = filteredNotifications.map((n) => n.id);
    setDismissedIds((prev) => new Set([...prev, ...ids]));
    showToast(`Cleared ${ids.length} notifications`, 'info');
  };

  // Role checks: Admin and Senior Mechanic supervise and assign
  const isSupervisorOrAdmin =
    currentRole === 'ADMIN' ||
    currentRole === 'SENIOR_MECHANIC' ||
    currentRole === 'SENIOR_ELECTRICIAN' ||
    currentRole === 'CEO' ||
    currentRole === 'ASSET_MANAGER';

  // Only line floor mechanics & electricians can attend directly on the floor
  const canAttendDirectly = currentRole === 'MECHANIC' || currentRole === 'ELECTRICIAN';

  // Immediate "Attend Work Myself" handler (field technicians only)
  const handleAttendNow = async (item: UnifiedNotificationItem) => {
    try {
      const technicianName = user?.name || (currentRole === 'ELECTRICIAN' ? 'Plant Electrician' : 'Line Mechanic');
      if (item.rawRepair) {
        await startRepairTicket(item.rawRepair.id, technicianName);
      }
      setDismissedIds((prev) => new Set([...prev, item.id]));
      showToast(`Work claimed! ${item.machineId || 'Machine'} assigned to ${technicianName}`, 'success');
    } catch (e) {
      console.error(e);
      showToast('Error claiming repair task', 'error');
    }
  };

  // Reject / Cancel Breakdown Issue (Supervisors / Admins)
  const handleRejectIssue = async (item: UnifiedNotificationItem) => {
    if (!item.rawRepair) return;
    try {
      const reviewerName = user?.name || (currentRole === 'ADMIN' ? 'Plant Administrator' : 'Shift Supervisor');
      await rejectRepairTicket(item.rawRepair.id, reviewerName, 'False alarm / operator cleared on floor inspection');
      setDismissedIds((prev) => new Set([...prev, item.id]));
      showToast(`Work order ${item.rawRepair.id} rejected. Machine restored to ACTIVE service.`, 'info');
    } catch (e) {
      console.error(e);
      showToast('Failed to reject repair issue', 'error');
    }
  };


  // Submit Assign Dispatch
  const handleConfirmAssign = async () => {
    if (!assigningItem) return;

    try {
      const assignerName = user?.name || (currentRole === 'ADMIN' ? 'Plant Administrator' : 'Senior Master Mechanic');
      if (assigningItem.rawRepair) {
        await assignRepairTicket(assigningItem.rawRepair.id, selectedMechanic, assignerName);
      }
      setDismissedIds((prev) => new Set([...prev, assigningItem.id]));
      showToast(
        `Dispatched! ${selectedMechanic} assigned by ${assignerName} to ${assigningItem.machineId || 'Issue'} on ${assigningItem.line || 'Floor'}.`,
        'success'
      );
      setAssigningItem(null);
    } catch (e) {
      console.error(e);
      showToast('Failed to assign technician', 'error');
    }
  };

  // Format stopwatch string
  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`;
  };

  const getRoleScopeLabel = (scope: RoleScope) => {
    switch (scope) {
      case 'MY_ROLE':
        return `My Role (${currentRole.replace(/_/g, ' ')})`;
      case 'ALL_ROLES':
        return 'All Roles (Plant-wide)';
      case 'ROLE_MECHANIC':
        return 'Line Mechanics (Sewing)';
      case 'ROLE_ELECTRICIAN':
        return 'Plant Electricians (Electrical)';
      case 'ROLE_STORE':
        return 'Tool Crib & Central Stores';
      case 'ROLE_SUPERVISOR':
        return 'Supervisors & In-Charges';
      case 'ROLE_EXECUTIVE':
        return 'Executive & Directorate';
      default:
        return scope;
    }
  };

  return (
    <div className="space-y-6 pt-0 font-sans text-slate-800">
      {/* ─── 1. PAGE HEADER & ALERT STATUS BAR ─────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="relative">
            <span className="p-2.5 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 shadow-2xs flex items-center justify-center">
              <Bell className="w-5 h-5" />
            </span>
            {unattended5MCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-rose-600 text-[8px] font-bold text-white items-center justify-center">
                  !
                </span>
              </span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                Plant Alerts &amp; Notifications Center
              </h1>
              {unattended5MCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-200 animate-pulse">
                  {unattended5MCount} Unattended SLA Alerts
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Live floor broadcast categorized by <strong>role specialization</strong> and strictly filtered to <strong>designated factory units</strong>.
            </p>
          </div>
        </div>

        {/* Action controls */}
        <div className="flex items-center gap-2 self-start md:self-auto no-print">
          <button
            type="button"
            onClick={() => setIsMuted(!isMuted)}
            className={`p-2 rounded-xl border text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${isMuted
                ? 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'
                : 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'
              }`}
            title={isMuted ? 'Alert sounds muted' : 'Alert sound alerts active'}
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-slate-500" /> : <Volume2 className="w-4 h-4 text-emerald-700" />}
            <span className="hidden sm:inline">{isMuted ? 'Muted' : 'Audio Live'}</span>
          </button>

          <button
            type="button"
            onClick={() => showToast('Synced latest floor notifications and timers', 'info')}
            className="p-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl transition shadow-2xs cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
            title="Refresh stream"
          >
            <RotateCw className="w-4 h-4 text-slate-600" />
            <span className="hidden sm:inline">Sync Now</span>
          </button>

          {filteredNotifications.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Mark View Read</span>
            </button>
          )}
        </div>
      </div>

      {/* ─── 2. ACTIVE SCOPING CONTEXT BANNER ─────────────────────────────── */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-slate-700">
            <Filter className="w-4 h-4 text-indigo-600" />
            <span>Active Feed Scope:</span>
          </div>

          {/* Role Scope Pill */}
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold">
            <User className="w-3.5 h-3.5" />
            <span>{getRoleScopeLabel(selectedRoleScope)}</span>
          </span>

          {/* Unit Scope Pill */}
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold">
            <Building2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>
              {effectiveUnit === 'ALL' || effectiveUnit === 'All Units'
                ? 'All Plant Units (Plant-wide)'
                : effectiveUnit === 'UNIT - 1'
                  ? 'Plant Unit 1 — - Campus'
                  : effectiveUnit === 'UNIT-2'
                    ? 'Plant Unit 2 — Perundurai Campus'
                    : effectiveUnit}
            </span>
            {!isAdmin && userAssignedUnit !== 'All Units' && (
              <span className="ml-1 text-[10px] text-emerald-600 font-normal italic flex items-center gap-0.5">
                <Lock className="w-2.5 h-2.5" /> (Locked to Assigned Unit)
              </span>
            )}
          </span>
        </div>

        <div className="text-[11px] text-slate-500 font-medium">
          Showing <strong>{filteredNotifications.length}</strong> active alerts
        </div>
      </div>

      {/* ─── 3. HIGHLIGHT: UNATTENDED ISSUES > 5 MINUTES SLA ESCALATION BANNER ──── */}
      {unattended5MCount > 0 && (
        <div className="bg-gradient-to-r from-rose-50 via-rose-100/60 to-amber-50 rounded-2xl border-2 border-rose-300 p-4 sm:p-5 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <span className="p-2.5 rounded-xl bg-rose-600 text-white shadow-xs shrink-0 animate-bounce">
                <Flame className="w-5 h-5" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-black text-rose-950 uppercase tracking-wide">
                    Urgent SLA Escalation: {unattended5MCount} Unattended Machine Defects
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-black bg-rose-600 text-white uppercase">
                    &gt; 5 Mins Idle
                  </span>
                </div>
                <p className="text-xs text-rose-900/90 font-medium mt-1 leading-relaxed">
                  Machines in {effectiveUnit === 'ALL' ? 'the plant' : effectiveUnit} have been halted for more than 5 minutes without attendance. Dispatch or claim immediately to protect production targets.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveTab('UNATTENDED_5M')}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center justify-center gap-1.5 shrink-0 active:scale-95 cursor-pointer"
            >
              <span>View {unattended5MCount} Breaches</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ─── 4. CATEGORY SUMMARY METRIC CARDS ────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {/* Unattended 5m */}
        <div
          onClick={() => setActiveTab('UNATTENDED_5M')}
          className={`p-4 rounded-2xl border transition cursor-pointer shadow-2xs ${activeTab === 'UNATTENDED_5M'
              ? 'bg-rose-50/80 border-rose-400 ring-2 ring-rose-500/20'
              : 'bg-white border-slate-200/80 hover:border-rose-300'
            }`}
        >
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1.5">
            <span>&gt; 5m SLA</span>
            <span className="w-2 h-2 rounded-full bg-rose-600 animate-ping" />
          </div>
          <div className="text-2xl font-black text-rose-600">{unattended5MCount}</div>
          <div className="text-[10px] text-slate-500 font-medium mt-1">SLA response breach</div>
        </div>

        {/* Breakdown Warnings */}
        <div
          onClick={() => setActiveTab('BREAKDOWN_WARNING')}
          className={`p-4 rounded-2xl border transition cursor-pointer shadow-2xs ${activeTab === 'BREAKDOWN_WARNING'
              ? 'bg-amber-50/80 border-amber-400 ring-2 ring-amber-500/20'
              : 'bg-white border-slate-200/80 hover:border-amber-300'
            }`}
        >
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1.5">
            <span>Breakdowns</span>
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          </div>
          <div className="text-2xl font-black text-amber-700">{breakdownWarningCount}</div>
          <div className="text-[10px] text-slate-500 font-medium mt-1">Defects &amp; repair tickets</div>
        </div>

        {/* Asset Actions Done */}
        <div
          onClick={() => setActiveTab('ASSET_ACTIONS')}
          className={`p-4 rounded-2xl border transition cursor-pointer shadow-2xs ${activeTab === 'ASSET_ACTIONS'
              ? 'bg-indigo-50/80 border-indigo-400 ring-2 ring-indigo-500/20'
              : 'bg-white border-slate-200/80 hover:border-indigo-300'
            }`}
        >
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1.5">
            <span>Asset Actions</span>
            <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <div className="text-2xl font-black text-indigo-700">{assetActionsCount}</div>
          <div className="text-[10px] text-slate-500 font-medium mt-1">Status &amp; relocations</div>
        </div>

        {/* PPM Overdue */}
        <div
          onClick={() => setActiveTab('PPM_OVERDUE')}
          className={`p-4 rounded-2xl border transition cursor-pointer shadow-2xs ${activeTab === 'PPM_OVERDUE'
              ? 'bg-blue-50/80 border-blue-400 ring-2 ring-blue-500/20'
              : 'bg-white border-slate-200/80 hover:border-blue-300'
            }`}
        >
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1.5">
            <span>Overdue PPM</span>
            <Clock className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="text-2xl font-black text-blue-700">{ppmOverdueCount}</div>
          <div className="text-[10px] text-slate-500 font-medium mt-1">Scheduled service due</div>
        </div>

        {/* Low Stock */}
        <div
          onClick={() => setActiveTab('LOW_STOCK')}
          className={`p-4 rounded-2xl border transition cursor-pointer shadow-2xs ${activeTab === 'LOW_STOCK'
              ? 'bg-orange-50/80 border-orange-400 ring-2 ring-orange-500/20'
              : 'bg-white border-slate-200/80 hover:border-orange-300'
            }`}
        >
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1.5">
            <span>Tool Crib</span>
            <Package className="w-3.5 h-3.5 text-orange-600" />
          </div>
          <div className="text-2xl font-black text-orange-700">{lowStockCount}</div>
          <div className="text-[10px] text-slate-500 font-medium mt-1">Below safety stock</div>
        </div>

        {/* Approvals */}
        <div
          onClick={() => setActiveTab('APPROVALS')}
          className={`p-4 rounded-2xl border transition cursor-pointer shadow-2xs col-span-2 md:col-span-1 ${activeTab === 'APPROVALS'
              ? 'bg-emerald-50/80 border-emerald-400 ring-2 ring-emerald-500/20'
              : 'bg-white border-slate-200/80 hover:border-emerald-300'
            }`}
        >
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-1.5">
            <span>Capex Indents</span>
            <FileText className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-700">{approvalsCount}</div>
          <div className="text-[10px] text-slate-500 font-medium mt-1">Awaiting sign-off</div>
        </div>
      </div>

      {/* ─── 5. TABS & FILTER TOOLBAR ─────────────────────────────────────── */}
      <div className="space-y-3">
        {/* Category Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab('ALL')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${activeTab === 'ALL'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
          >
            All Alerts ({roleAndUnitScopedNotifications.length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('UNATTENDED_5M')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 flex items-center gap-1.5 ${activeTab === 'UNATTENDED_5M'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-rose-700 hover:bg-rose-50'
              }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Unattended &gt; 5m ({unattended5MCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('BREAKDOWN_WARNING')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${activeTab === 'BREAKDOWN_WARNING'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
          >
            Breakdowns ({breakdownWarningCount})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ASSET_ACTIONS')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${activeTab === 'ASSET_ACTIONS'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
          >
            Asset Actions ({assetActionsCount})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('PPM_OVERDUE')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${activeTab === 'PPM_OVERDUE'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
          >
            Overdue PPM ({ppmOverdueCount})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('LOW_STOCK')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${activeTab === 'LOW_STOCK'
                ? 'bg-orange-600 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
          >
            Tool Crib Spares ({lowStockCount})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('APPROVALS')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0 ${activeTab === 'APPROVALS'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
          >
            Executive Capex ({approvalsCount})
          </button>
        </div>

        {/* Filter Controls Row: Search, Role Category Filter, Severity, Unit Scoping */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
          {/* Keyword Search */}
          <div className="lg:col-span-4 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Machine, Line, Defect, or Staff..."
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition shadow-2xs font-medium"
            />
          </div>

          {/* Role Category Selector */}
          <div className="lg:col-span-3 relative">
            <select
              value={selectedRoleScope}
              onChange={(e) => setSelectedRoleScope(e.target.value as RoleScope)}
              className="w-full appearance-none pl-3.5 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer shadow-2xs"
            >
              <option value="MY_ROLE">Scoped to My Role ({currentRole.replace(/_/g, ' ')})</option>
              <option value="ALL_ROLES">All Roles (Full Overview)</option>
              <option value="ROLE_MECHANIC">Sewing Line Mechanics</option>
              <option value="ROLE_ELECTRICIAN">Plant Electricians</option>
              <option value="ROLE_STORE">Tool Crib &amp; Stores</option>
              <option value="ROLE_SUPERVISOR">Supervisors &amp; In-Charges</option>
              <option value="ROLE_EXECUTIVE">Executive / CEO Capex</option>
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Unit Scope Selector */}
          <div className="lg:col-span-3 relative">
            {isAdmin || userAssignedUnit === 'All Units' ? (
              <>
                <select
                  value={selectedUnit}
                  onChange={(e) => setSelectedUnit(e.target.value)}
                  className="w-full appearance-none pl-3.5 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer shadow-2xs"
                >
                  <option value="ALL">All Plant Units</option>
                  <option value="UNIT - 1">Unit 1 &mdash; - Campus</option>
                  <option value="UNIT-2">Unit 2 &mdash; Perundurai Campus</option>
                </select>
                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </>
            ) : (
              <div
                className="w-full px-3.5 py-2 bg-slate-100/90 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-between shadow-2xs"
                title="Your account is assigned strictly to this plant unit"
              >
                <span className="truncate flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span>{userAssignedUnit}</span>
                </span>
                <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </div>
            )}
          </div>

          {/* Severity Selector */}
          <div className="lg:col-span-2 relative">
            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="w-full appearance-none pl-3.5 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer shadow-2xs"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical Alarms</option>
              <option value="WARNING">Warnings</option>
              <option value="INFO">Informational</option>
            </select>
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* ─── 6. NOTIFICATION CARDS LIST ───────────────────────────────────── */}
      <div className="space-y-3">
        {filteredNotifications.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-3 text-slate-400">
              <ShieldCheck className="w-6 h-6 text-emerald-600" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No active alerts for this role &amp; unit filter</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              All machine defects and alerts in {effectiveUnit === 'ALL' ? 'the plant' : effectiveUnit} matching {getRoleScopeLabel(selectedRoleScope)} are resolved or cleared.
            </p>
          </div>
        ) : (
          filteredNotifications.map((item) => {
            const isUnattended = item.isUnattended5Mins;
            const isAssetAction = item.category === 'ASSET_ACTION';

            return (
              <div
                key={item.id}
                className={`bg-white rounded-2xl border transition-all p-4 sm:p-5 shadow-2xs hover:shadow-xs relative overflow-hidden ${isUnattended
                    ? 'border-rose-300 ring-1 ring-rose-500/20 bg-rose-50/15'
                    : isAssetAction
                      ? 'border-indigo-200/90 bg-indigo-50/10'
                      : item.severity === 'CRITICAL'
                        ? 'border-rose-200'
                        : 'border-slate-200/80'
                  }`}
              >
                {/* Left Accent Bar */}
                <div
                  className={`absolute left-0 top-0 bottom-0 w-1.5 ${isUnattended
                      ? 'bg-rose-600'
                      : isAssetAction
                        ? 'bg-indigo-600'
                        : item.severity === 'CRITICAL'
                          ? 'bg-rose-500'
                          : 'bg-amber-500'
                    }`}
                />

                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left info */}
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    <div className="shrink-0 mt-0.5">
                      {isUnattended ? (
                        <span className="p-2.5 rounded-xl bg-rose-100 text-rose-700 border border-rose-300 flex items-center justify-center animate-pulse">
                          <Flame className="w-5 h-5 text-rose-600" />
                        </span>
                      ) : isAssetAction ? (
                        <span className="p-2.5 rounded-xl bg-indigo-100 text-indigo-700 border border-indigo-300 flex items-center justify-center">
                          <ArrowRightLeft className="w-5 h-5 text-indigo-600" />
                        </span>
                      ) : item.category === 'BREAKDOWN_WARNING' ? (
                        <span className="p-2.5 rounded-xl bg-amber-100 text-amber-800 border border-amber-300 flex items-center justify-center">
                          <Wrench className="w-5 h-5" />
                        </span>
                      ) : item.category === 'PPM_OVERDUE' ? (
                        <span className="p-2.5 rounded-xl bg-blue-100 text-blue-800 border border-blue-300 flex items-center justify-center">
                          <Clock className="w-5 h-5" />
                        </span>
                      ) : item.category === 'LOW_STOCK' ? (
                        <span className="p-2.5 rounded-xl bg-orange-100 text-orange-800 border border-orange-300 flex items-center justify-center">
                          <Package className="w-5 h-5" />
                        </span>
                      ) : (
                        <span className="p-2.5 rounded-xl bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center justify-center">
                          <FileText className="w-5 h-5" />
                        </span>
                      )}
                    </div>

                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        {/* Unit Scoping Pill */}
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          <Building2 className="w-3 h-3 text-indigo-600" />
                          <span>{item.unit || 'UNIT - 1'}</span>
                        </span>

                        {/* Role / Trade Pill */}
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200">
                          {item.targetTrade === 'ELECTRICIAN' ? (
                            <>
                              <Zap className="w-3 h-3 text-amber-600" />
                              <span>Electrician</span>
                            </>
                          ) : item.category === 'LOW_STOCK' ? (
                            <>
                              <Package className="w-3 h-3 text-orange-600" />
                              <span>Store &amp; Crib</span>
                            </>
                          ) : item.category === 'APPROVAL' ? (
                            <>
                              <Crown className="w-3 h-3 text-rose-600" />
                              <span>Executive Capex</span>
                            </>
                          ) : (
                            <>
                              <Wrench className="w-3 h-3 text-indigo-600" />
                              <span>Line Mechanic</span>
                            </>
                          )}
                        </span>

                        {isUnattended && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-600 text-white uppercase tracking-wider flex items-center gap-1 shadow-2xs">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                            <span>Unattended &gt; 5 Mins</span>
                          </span>
                        )}

                        {isAssetAction && (
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-indigo-100 text-indigo-800 border border-indigo-200 uppercase tracking-wider flex items-center gap-1">
                            <Activity className="w-3 h-3 text-indigo-600" />
                            <span>Asset Action Log</span>
                          </span>
                        )}

                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${item.severity === 'CRITICAL'
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : isAssetAction
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                : 'bg-amber-100 text-amber-900 border border-amber-200'
                            }`}
                        >
                          {item.severity}
                        </span>

                        {item.machineId && (
                          <span className="font-mono text-xs font-black text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                            {item.machineId}
                          </span>
                        )}

                        {item.line && (
                          <span className="text-xs font-semibold text-slate-700 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200">
                            {item.line} {item.stationNo ? `• ${item.stationNo}` : ''}
                          </span>
                        )}
                      </div>

                      <h3 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                        {item.title}
                      </h3>

                      <p className="text-xs text-slate-600 leading-relaxed font-normal">
                        {item.message}
                      </p>

                      {/* Metadata tags */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 pt-1">
                        <span className="flex items-center gap-1 font-medium">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>Logged: {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </span>

                        {item.attendedBy && item.attendedBy !== 'Unassigned' && (
                          <span className="flex items-center gap-1 font-medium text-slate-700">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span>{isAssetAction ? 'Changed by' : 'Attendant'}: <strong>{item.attendedBy}</strong></span>
                          </span>
                        )}

                        {isUnattended && (
                          <span className="font-mono font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded border border-rose-200">
                            ⏱️ Total Unattended Time: {formatTimer(item.elapsedSeconds)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right quick actions */}
                  <div className="flex items-center gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                    {/* Quick Attend Button: ONLY shown to field line mechanics / electricians for defect tickets */}
                    {isUnattended && canAttendDirectly && (
                      <button
                        type="button"
                        onClick={() => handleAttendNow(item)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-2xs flex items-center gap-1 cursor-pointer"
                        title="Take immediate floor custody of repair"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Attend Work Myself</span>
                      </button>
                    )}

                    {/* Quick Assign Mechanic Button: Shown to Admins & Supervisors */}
                    {(isUnattended || (item.category === 'BREAKDOWN_WARNING' && !item.attendedBy) || isSupervisorOrAdmin) &&
                      (item.category === 'UNATTENDED_5M' || item.category === 'BREAKDOWN_WARNING') && (
                        <button
                          type="button"
                          onClick={() => handleOpenAssignModal(item)}
                          className="px-3 py-1.5 bg-[#00897b] hover:bg-[#00796b] text-white rounded-xl text-xs font-bold transition shadow-2xs flex items-center gap-1 cursor-pointer"
                          title="Dispatch technician to this machine"
                        >
                          <Wrench className="w-3.5 h-3.5" />
                          <span>Dispatch Mechanic</span>
                        </button>
                      )}

                    {/* Quick Reject Button: Shown to Admins & Supervisors for active breakdown tickets */}
                    {isSupervisorOrAdmin && item.rawRepair && item.rawRepair.status !== 'COMPLETED' && item.rawRepair.status !== 'REJECTED' && (
                      <button
                        type="button"
                        onClick={() => handleRejectIssue(item)}
                        className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition shadow-2xs flex items-center gap-1 cursor-pointer"
                        title="Reject false alarm & restore machine"
                      >
                        <XCircle className="w-3.5 h-3.5 text-rose-600" />
                        <span>Reject</span>
                      </button>
                    )}

                    {/* Dismiss Button */}
                    <button
                      type="button"
                      onClick={() => handleDismiss(item.id)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                      title="Clear Notification"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ─── 7. DISPATCH ATTENDING MECHANIC MODAL ───────────────────────── */}
      {assigningItem && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Wrench className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Dispatch Floor Technician</h3>
                  <p className="text-[11px] text-slate-500">
                    Assign mechanic to {assigningItem.machineId} &bull; {assigningItem.unit || 'UNIT - 1'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAssigningItem(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {/* Supervisory Assigner Notice */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-[11px] text-emerald-900 font-medium flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  Supervisory Dispatch: Select a technician designated for <strong>{assigningItem.unit || 'UNIT - 1'}</strong> to take floor custody.
                </span>
              </div>

              {/* Target Issue Summary */}
              <div className="bg-rose-50/60 border border-rose-200 rounded-xl p-3.5 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-rose-900">{assigningItem.machineId}</span>
                  <span className="font-semibold text-rose-700 bg-rose-100 px-2 py-0.5 rounded">
                    Unattended: {formatTimer(assigningItem.elapsedSeconds)}
                  </span>
                </div>
                <div className="text-slate-800 font-medium">
                  {assigningItem.unit} &bull; {assigningItem.line} &bull; {assigningItem.stationNo}
                </div>
                <div className="text-slate-600">Issue: {assigningItem.faultCategory || assigningItem.message}</div>
              </div>

              {/* Technician selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Select Attending Technician for {assigningItem.unit || 'UNIT - 1'}
                </label>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {dynamicTechnicians.filter((m) =>
                    assigningItem.unit ? matchesUnit(m.unit, assigningItem.unit) : true
                  ).map((mech) => {
                    const isSelected = selectedMechanic === mech.name;
                    return (
                      <div
                        key={mech.name}
                        onClick={() => setSelectedMechanic(mech.name)}
                        className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between text-xs ${isSelected
                            ? 'bg-emerald-50/80 border-emerald-500 ring-1 ring-emerald-500/20'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${isSelected
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-100 text-slate-700'
                              }`}
                          >
                            {mech.name.slice(0, 2).toUpperCase()}
                          </span>
                          <div>
                            <div className="font-bold text-slate-900">{mech.name}</div>
                            <div className="text-[11px] text-slate-500">{mech.role} &bull; {mech.unit}</div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-[11px] font-mono text-slate-600 flex items-center gap-1 justify-end">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{mech.phone}</span>
                          </div>
                          {isSelected && (
                            <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-0.5 justify-end mt-0.5">
                              <Check className="w-3 h-3" /> Selected
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setAssigningItem(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAssign}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition shadow-2xs flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Dispatch {selectedMechanic}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
