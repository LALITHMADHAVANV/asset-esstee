'use client';

import { assetScanUrl } from '@/lib/scanUrl';

import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import { matchesUnit, isUserAdmin, getUserScopedUnit } from '@/lib/constants/units';
import { normalizeRole } from '@/lib/constants/roles';
import { PersonnelWorkHistoryTable } from '@/components/history/PersonnelWorkHistoryTable';
import { QRCodeSVG } from 'qrcode.react';
import { BulkQrPrintModal, BulkQrAsset } from '@/components/history/BulkQrPrintModal';
import { subscribeMachines, subscribeRepairs, subscribePPMSchedules } from '@/lib/services/cmmsService';
import type { Machine, RepairTicket, PPMSchedule } from '@/types/cmms';
import { formatAssetLocation, cleanRelocationLocation, formatRelocationLocation, formatRelocationEndpoint } from '@/lib/formatters';
import {
  Search,
  Columns,
  Download,
  ChevronDown,
  ChevronUp,
  X,
  Wrench,
  Armchair,
  Zap,
  Truck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Calendar,
  User,
  Activity,
  ShieldAlert,
  Info,
  Check,
  Package,
  Layers,
  ArrowLeft,
  Printer,
  FileText,
  DollarSign,
  TrendingUp,
  Cpu,
  Sparkles,
  ExternalLink,
  MapPin,
  ArrowRightLeft,
  QrCode,
} from 'lucide-react';

export type AssetCategory = 'MACHINE' | 'FURNITURE' | 'UTILITY' | 'VEHICLE';

export type StageStatus = 'COMPLETED' | 'IN_PROGRESS' | 'DELAYED' | 'NOT_ASSIGNED' | 'PARTIAL' | 'NA';

export interface StageDetail {
  plannedDate: string;
  revisedDate?: string;
  actualDate?: string;
  assignee?: string;
  status: StageStatus;
  lateDays?: number;
  partialQty?: string;
  notes?: string;
}

export interface ServiceLogEntry {
  ticketId: string;
  date: string;
  faultCategory: string;
  faultDetails: string;
  actionTaken: string;
  technician: string;
  downtimeMinutes: number;
  partsReplaced?: string;
  costIncurred: number;
  status: 'RESOLVED' | 'UNDER_OBSERVATION';
}

export interface PPMCheckItem {
  checkpoint: string;
  frequency: string;
  lastChecked: string;
  status: 'PASSED' | 'NEEDS_ATTENTION' | 'DUE';
  notes: string;
}

export interface LocationHistoryEntry {
  transferId: string;
  date: string;
  fromLocation: string;
  toLocation: string;
  reason: string;
  movedBy: string;
  status: 'CURRENT' | 'TRANSFERRED';
  notes?: string;
}

export interface AssetHistoryRecord {
  _id: string;
  assetId: string;
  serialNo: string;
  name: string;
  model: string;
  brand: string;
  category: AssetCategory;
  categoryLabel: string;
  subCategory?: string;
  location?: string;
  unit: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'active' | 'completed';
  purchaseDate: string;
  purchasePrice: number;
  totalMaintenanceCost: number;
  totalPpmCost?: number;
  totalRepairCost?: number;
  age: string;
  downtimeMins: number;
  stages: Record<string, StageDetail>;
  serviceLogs: ServiceLogEntry[];
  ppmChecklist: PPMCheckItem[];
  locationHistory?: LocationHistoryEntry[];
}

const getAssetPpmCost = (asset: AssetHistoryRecord): number => {
  if (typeof asset.totalPpmCost === 'number') return asset.totalPpmCost;
  const fromLogs = asset.serviceLogs
    .filter((l) => l.faultCategory.toLowerCase().includes('ppm') || l.faultCategory.toLowerCase().includes('lubrication') || l.faultCategory.toLowerCase().includes('routine'))
    .reduce((sum, l) => sum + (l.costIncurred || 0), 0);
  return fromLogs > 0 ? fromLogs : 0;
};

const getAssetRepairCost = (asset: AssetHistoryRecord): number => {
  if (typeof asset.totalRepairCost === 'number') return asset.totalRepairCost;
  const fromLogs = asset.serviceLogs
    .filter((l) => !l.faultCategory.toLowerCase().includes('ppm') && !l.faultCategory.toLowerCase().includes('routine'))
    .reduce((sum, l) => sum + (l.costIncurred || 0), 0);
  if (fromLogs > 0) return fromLogs;
  return asset.totalRepairCost || 0;
};

const getAssetLocationHistory = (asset: AssetHistoryRecord): LocationHistoryEntry[] => {
  if (asset.locationHistory && asset.locationHistory.length > 0) {
    return asset.locationHistory.map((h) => ({
      ...h,
      fromLocation: cleanRelocationLocation(h.fromLocation),
      toLocation: cleanRelocationLocation(h.toLocation),
    }));
  }

  return [
    {
      transferId: `TRF-${asset.assetId.replace(/[^a-zA-Z0-9]/g, '')}-01`,
      date: asset.purchaseDate || new Date().toISOString().slice(0, 10),
      fromLocation: 'Receiving Inward Store',
      toLocation: cleanRelocationLocation(asset.unit) || 'Maintenance Workshop',
      reason: 'Initial commissioning and station placement',
      movedBy: 'Store / Maintenance Lead',
      status: 'CURRENT',
      notes: 'Initial inspection completed upon arrival',
    },
  ];
};

const ALL_STAGES = [
  'PPM Inspection',
  'Lubrication & Service',
  'Electrical & Sensors',
  'Parts Overhaul',
  'Safety & QA Sign-off',
];

const INITIAL_ASSETS: AssetHistoryRecord[] = [];

// Category metadata
const CATEGORIES_META: {
  id: AssetCategory;
  title: string;
  subtitle: string;
  icon: typeof Wrench;
  theme: {
    bg: string;
    border: string;
    badgeBg: string;
    text: string;
    accent: string;
    headerBg: string;
  };
}[] = [
  {
    id: 'MACHINE',
    title: 'Machine History',
    subtitle: 'Sewing, Cutting & Industrial Machinery',
    icon: Wrench,
    theme: {
      bg: 'bg-indigo-50/50',
      border: 'border-indigo-200',
      badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      text: 'text-indigo-700',
      accent: 'bg-indigo-600',
      headerBg: 'bg-gradient-to-r from-indigo-50/80 via-white to-slate-50',
    },
  },
  {
    id: 'FURNITURE',
    title: 'Furniture History',
    subtitle: 'Spreading Tables, Operator Chairs, Sofas & Exit Doors',
    icon: Armchair,
    theme: {
      bg: 'bg-amber-50/50',
      border: 'border-amber-200',
      badgeBg: 'bg-amber-50 text-amber-800 border-amber-200',
      text: 'text-amber-800',
      accent: 'bg-amber-600',
      headerBg: 'bg-gradient-to-r from-amber-50/80 via-white to-slate-50',
    },
  },
  {
    id: 'UTILITY',
    title: 'Electrical Utilities History',
    subtitle: 'Air Conditioners, High-Bay LEDs, Exhaust Fans & CCTV',
    icon: Zap,
    theme: {
      bg: 'bg-teal-50/50',
      border: 'border-teal-200',
      badgeBg: 'bg-teal-50 text-teal-800 border-teal-200',
      text: 'text-teal-800',
      accent: 'bg-teal-600',
      headerBg: 'bg-gradient-to-r from-teal-50/80 via-white to-slate-50',
    },
  },
  {
    id: 'VEHICLE',
    title: 'Vehicle Fleet History',
    subtitle: 'Sedans, Auto Shuttles, Raw Material Tempos, Lorries & Buses',
    icon: Truck,
    theme: {
      bg: 'bg-rose-50/50',
      border: 'border-rose-200',
      badgeBg: 'bg-rose-50 text-rose-800 border-rose-200',
      text: 'text-rose-800',
      accent: 'bg-rose-600',
      headerBg: 'bg-gradient-to-r from-rose-50/80 via-white to-slate-50',
    },
  },
];

export default function HistoryPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { user, role, isLoading } = useAuth();

  const isAdmin = isUserAdmin(role);
  const effectiveUnit = getUserScopedUnit(user, role);
  const isExecutiveOrAdmin = role === 'ADMIN' || role === 'ASSET_MANAGER' || role === 'CEO';
  const [adminTab, setAdminTab] = useState<'ASSETS' | 'PERSONNEL'>('ASSETS');
  const [items] = useState<AssetHistoryRecord[]>(INITIAL_ASSETS);
  const [liveMachines, setLiveMachines] = useState<Machine[]>([]);
  const [liveRepairs, setLiveRepairs] = useState<RepairTicket[]>([]);
  const [livePpm, setLivePpm] = useState<PPMSchedule[]>([]);
  const [statusFilter] = useState<'active' | 'completed' | 'all'>('all');
  const [q, setQ] = useState('');
  const [showPoc, setShowPoc] = useState<boolean>(true);
  const [collapsedCategories, setCollapsedCategories] = useState<string[]>([]);

  // Group By State: CATEGORY | SUBCATEGORY | LOCATION | RELOCATION | MECHANIC | STATUS
  const [groupBy, setGroupBy] = useState<'CATEGORY' | 'SUBCATEGORY' | 'LOCATION' | 'RELOCATION' | 'MECHANIC' | 'STATUS'>('CATEGORY');
  // Specific Filters
  const [exportCategory, setExportCategory] = useState<'ALL' | AssetCategory>('ALL');
  const [subCategoryFilter, setSubCategoryFilter] = useState<string>('ALL');
  const [locationFilter, setLocationFilter] = useState<string>('ALL');
  const [mechanicFilter, setMechanicFilter] = useState<string>('ALL');
  const [repairCostFilter, setRepairCostFilter] = useState<'ALL' | 'HAS_COST' | 'ZERO' | 'UNDER_500' | '500_TO_1500' | 'OVER_1500'>('ALL');
  const [relocatedFilter, setRelocatedFilter] = useState<'ALL' | 'RELOCATED' | 'NON_RELOCATED'>('ALL');
  const [purchaseFromDate, setPurchaseFromDate] = useState<string>('');
  const [purchaseToDate, setPurchaseToDate] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  // QR Modal Selection State
  const [selectedQrAsset, setSelectedQrAsset] = useState<AssetHistoryRecord | null>(null);
  const [isBulkQrModalOpen, setIsBulkQrModalOpen] = useState<boolean>(false);

  // Subscribe to live machines, repairs, and PPM from DB/storage
  useEffect(() => {
    const unsubMachines = subscribeMachines((machines) => {
      setLiveMachines(machines);
    });
    const unsubRepairs = subscribeRepairs((repairs) => {
      setLiveRepairs(repairs);
    });
    const unsubPpm = subscribePPMSchedules((schedules) => {
      setLivePpm(schedules);
    });
    return () => {
      unsubMachines();
      unsubRepairs();
      unsubPpm();
    };
  }, []);

  // The active asset whose dedicated FULL HISTORY PAGE is currently open
  const [selectedAssetForHistory, setSelectedAssetForHistory] = useState<AssetHistoryRecord | null>(null);

  // Active tab inside the dedicated history page
  const [activeDossierTab, setActiveDossierTab] = useState<'LOGS' | 'STAGES' | 'PPM' | 'LOCATION'>('LOGS');

  // All active stages
  const columns = ALL_STAGES;

  const toggleCategoryCollapse = (catId: string) => {
    if (collapsedCategories.includes(catId)) {
      setCollapsedCategories(collapsedCategories.filter((c) => c !== catId));
    } else {
      setCollapsedCategories([...collapsedCategories, catId]);
    }
  };

  // Combined items populated strictly from live registered machines, repairs, and PPM (scoped to unit for non-admins)
  const allItems = useMemo(() => {
    const scopedLiveMachines = !isAdmin
      ? liveMachines.filter((m) => matchesUnit(m.unit, effectiveUnit))
      : liveMachines;
    const scopedInitialItems = !isAdmin
      ? items.filter((i) => matchesUnit(i.unit, effectiveUnit))
      : items;

    const initialIds = new Set(scopedInitialItems.map((i) => i.assetId.toLowerCase()));
    const extraLive: AssetHistoryRecord[] = scopedLiveMachines
      .filter((m) => !initialIds.has(m.id.toLowerCase()))
      .map((m) => {
        const cost = typeof m.cost === 'number' ? m.cost : 0;
        const machineRepairs = liveRepairs.filter(
          (r) => r.machineId?.toLowerCase() === m.id.toLowerCase()
        );
        const machinePpm = livePpm.filter(
          (p) => p.machineId?.toLowerCase() === m.id.toLowerCase()
        );

        // Derive real service logs from repair tickets
        const serviceLogs: ServiceLogEntry[] = machineRepairs.map((r) => {
          const partsCost = r.partsUsed?.reduce((sum, p) => sum + (p.quantity || 1) * 350, 0) || 0;
          return {
            ticketId: r.id,
            date: r.reportedAt ? r.reportedAt.slice(0, 10) : (m.purchaseDate || '2026-10-10'),
            faultCategory: r.faultCategory || 'Corrective Repair',
            faultDetails: r.faultDetails || r.actionTaken || 'Maintenance repair logged',
            actionTaken: r.actionTaken || 'Inspected & repaired',
            technician: r.attendedBy || 'Assigned Technician',
            downtimeMinutes: r.downtimeMinutes || 0,
            partsReplaced: r.partsUsed && r.partsUsed.length > 0 ? r.partsUsed.map((p) => `${p.name} (x${p.quantity})`).join(', ') : 'None',
            costIncurred: partsCost,
            status: r.status === 'COMPLETED' ? 'RESOLVED' : 'UNDER_OBSERVATION',
          };
        });

        // Derive real PPM checklist from PPM schedules
        const ppmChecklist: PPMCheckItem[] = machinePpm.map((p) => ({
          checkpoint: p.task || 'Preventive Maintenance Inspection',
          frequency: p.frequency || 'Monthly',
          lastChecked: p.lastServiced || p.nextDue || (m.purchaseDate || '2026-10-10'),
          status: p.status === 'COMPLETED' ? 'PASSED' : p.status === 'OVERDUE' ? 'NEEDS_ATTENTION' : 'DUE',
          notes: `Interval: ${p.intervalDays} days • Next Due: ${p.nextDue}`,
        }));

        // Derive relocation history from machine relocation record or commissioning
        const locHistory: LocationHistoryEntry[] = (m.relocationHistory && m.relocationHistory.length > 0)
          ? m.relocationHistory.map((rh, idx) => ({
              transferId: `TRF-${m.id.replace(/[^a-zA-Z0-9]/g, '')}-${String(m.relocationHistory!.length - idx).padStart(2, '0')}`,
              date: rh.movedAt ? rh.movedAt.slice(0, 10) : (m.purchaseDate || '2026-10-10'),
              fromLocation: formatRelocationEndpoint(rh.fromLine, rh.fromStation, m.unit),
              toLocation: formatRelocationEndpoint(rh.toLine, rh.toStation, m.unit),
              reason: rh.reason || 'Relocation & machine transfer',
              movedBy: rh.movedBy || 'Maintenance Lead',
              status: idx === 0 ? 'CURRENT' : 'TRANSFERRED',
              notes: 'Relocation completed and verified',
            }))
          : [
              {
                transferId: `TRF-${m.id.replace(/[^a-zA-Z0-9]/g, '')}-01`,
                date: m.lastMovedAt ? m.lastMovedAt.slice(0, 10) : (m.purchaseDate || new Date().toISOString().slice(0, 10)),
                fromLocation: m.previousLine ? formatRelocationEndpoint(m.previousLine, m.previousStation, m.unit) : 'Receiving Inward Store',
                toLocation: formatRelocationLocation(m),
                reason: m.lastMovedReason || 'Initial installation and commissioning',
                movedBy: m.lastMovedBy || 'Plant Maintenance Team',
                status: 'CURRENT',
                notes: 'Commissioning inspection completed',
              },
            ];

        const totalDowntime = machineRepairs.reduce((sum, r) => sum + (r.downtimeMinutes || 0), m.totalDowntimeMinutes || 0);
        const totalRepairCost = serviceLogs.reduce((sum, l) => sum + (l.costIncurred || 0), 0);
        const totalPpmCost = machinePpm.filter((p) => p.status === 'COMPLETED').length * 450;
        const totalMaintenanceCost = totalRepairCost + totalPpmCost;

        const hasCritical = machineRepairs.some((r) => r.urgency === 'CRITICAL' && r.status !== 'COMPLETED');
        const riskLevel = m.status === 'BREAKDOWN' || hasCritical
          ? 'CRITICAL'
          : totalDowntime > 120
          ? 'HIGH'
          : totalDowntime > 40
          ? 'MEDIUM'
          : 'LOW';
        const subCat = m.typeName || (m.type ? m.type.replace(/_/g, ' ') : m.model || 'Standard Machinery');
        const locName = m.area || m.currentLine || 'Line 01';

        return {
          _id: `live-${m.id}`,
          assetId: m.id,
          serialNo: (m as any).serialNo || (m as any).serialNumber || (m as any).stationNo || `SN-${m.brand ? m.brand.slice(0, 2).toUpperCase() : 'MC'}-${m.id.replace(/[^0-9]/g, '') || '001'}`,
          name: m.name || `${m.brand || ''} ${m.typeName || m.type || 'Machine'}`.trim(),
          model: m.model || 'Standard',
          brand: m.brand || 'OEM',
          category: (m.category as any) || 'MACHINE',
          categoryLabel: m.category === 'FURNITURE' ? 'Furniture' : m.category === 'UTILITY' ? 'Utility' : m.category === 'VEHICLE' ? 'Vehicle' : 'Machine',
          subCategory: subCat,
          location: locName,
          unit: formatRelocationLocation(m),
          riskLevel: riskLevel as any,
          status: m.status === 'BREAKDOWN' ? 'active' : 'completed',
          purchaseDate: m.purchaseDate || new Date().toISOString().slice(0, 10),
          purchasePrice: cost,
          totalMaintenanceCost,
          totalPpmCost,
          totalRepairCost,
          age: `${m.ageYears || 1.0} yrs`,
          downtimeMins: totalDowntime,
          stages: {},
          serviceLogs,
          ppmChecklist,
          locationHistory: locHistory,
          mcNo: (m as any).mcNo || m.id,
          company: m.company,
          currentLine: m.currentLine || m.area || m.unit,
        } as any;
      });

    return [...scopedInitialItems, ...extraLive];
  }, [items, liveMachines, liveRepairs, livePpm, isAdmin, effectiveUnit]);

  // Prepared assets for bulk QR printing modal
  const bulkQrAssets: BulkQrAsset[] = useMemo(() => {
    return allItems.map((item, idx) => ({
      id: item.assetId,
      mcNo: (item as any).mcNo || item.assetId,
      serialNo: item.serialNo || (item as any).serialNumber || (item as any).stationNo || '',
      serialNumber: (item as any).serialNumber || item.serialNo || '',
      name: item.name,
      brand: item.brand,
      model: item.model,
      type: item.subCategory || item.category,
      typeName: item.categoryLabel,
      unit: item.unit,
      currentLine: (item as any).currentLine || item.location || item.unit,
      location: item.location || item.unit,
      company: (item as any).company,
      status: item.status,
      sNo: idx + 1,
    }));
  }, [allItems]);

  // Helper to resolve assigned mechanic for an asset
  const getAssetMechanic = (asset: AssetHistoryRecord): string => {
    if (asset.serviceLogs && asset.serviceLogs.length > 0) {
      const latestWithTech = asset.serviceLogs.find(
        (l) => l.technician && l.technician !== 'Assigned Technician' && l.technician !== 'Unassigned'
      );
      if (latestWithTech?.technician) return latestWithTech.technician;
      if (asset.serviceLogs[0].technician) return asset.serviceLogs[0].technician;
    }
    if (asset.stages) {
      const stageWithAssignee = Object.values(asset.stages).find(
        (s) => s.assignee && s.assignee !== 'Unassigned'
      );
      if (stageWithAssignee?.assignee) return stageWithAssignee.assignee;
    }
    return 'Unassigned / Lead';
  };

  // Helper to resolve sub-category / equipment type
  const getAssetSubCategory = (asset: AssetHistoryRecord): string => {
    if (asset.subCategory && asset.subCategory.trim()) return asset.subCategory;
    if (asset.model && asset.model !== 'Standard' && asset.model !== 'OEM') return asset.model;
    if (asset.name) {
      const clean = asset.name.replace(new RegExp(`^${asset.brand}\\s*`, 'i'), '').trim();
      if (clean) return clean;
    }
    return asset.categoryLabel || 'General Equipment';
  };

  // Helper to resolve location / production line
  const getAssetLocation = (asset: AssetHistoryRecord): string => {
    if (asset.location && asset.location.trim()) return asset.location;
    if (asset.unit) {
      return asset.unit.split('•')[0].trim();
    }
    const locHistory = getAssetLocationHistory(asset);
    const cur = locHistory.find((l) => l.status === 'CURRENT')?.toLocation;
    if (cur) return cur.split('•')[0].trim();
    return 'Shop Floor';
  };

  // Helper to determine if an asset has been relocated or transferred
  const isAssetRelocated = (asset: AssetHistoryRecord): boolean => {
    const history = getAssetLocationHistory(asset);
    if (history.length > 1) return true;
    if (history.some((l) => l.status === 'TRANSFERRED')) return true;
    const current = history.find((l) => l.status === 'CURRENT') || history[0];
    if (current) {
      if (
        current.fromLocation &&
        !current.fromLocation.toLowerCase().includes('inward store') &&
        !current.fromLocation.toLowerCase().includes('receiving')
      ) {
        return true;
      }
      if (current.reason && current.reason.toLowerCase().includes('reloc')) {
        return true;
      }
    }
    return false;
  };

  // Extract all unique mechanics across the registry
  const allMechanics = useMemo(() => {
    const set = new Set<string>();
    allItems.forEach((item) => {
      const m = getAssetMechanic(item);
      if (m && m !== 'Unassigned / Lead') set.add(m);
      item.serviceLogs.forEach((l) => {
        if (l.technician && l.technician.trim()) set.add(l.technician.trim());
      });
    });
    liveRepairs.forEach((r) => {
      if (r.attendedBy && r.attendedBy.trim()) set.add(r.attendedBy.trim());
    });
    return Array.from(set).sort();
  }, [allItems, liveRepairs]);

  // Extract all unique locations across the registry
  const allLocations = useMemo(() => {
    const set = new Set<string>();
    allItems.forEach((item) => {
      const loc = getAssetLocation(item);
      if (loc) set.add(loc);
    });
    liveMachines.forEach((m) => {
      if (m.unit) set.add(m.unit);
      if (m.area && !m.area.toLowerCase().includes('line')) set.add(m.area);
    });
    ['Cutting Department', 'Finishing & Pressing', 'Central Utilities & Plant'].forEach((l) => set.add(l));
    return Array.from(set).sort();
  }, [allItems, liveMachines]);

  // Extract all unique sub-categories
  const allSubCategories = useMemo(() => {
    const set = new Set<string>();
    allItems.forEach((item) => {
      const sub = getAssetSubCategory(item);
      if (sub) set.add(sub);
    });
    liveMachines.forEach((m) => {
      if (m.typeName) set.add(m.typeName);
      else if (m.type) set.add(m.type.replace(/_/g, ' '));
    });
    return Array.from(set).sort();
  }, [allItems, liveMachines]);

  // Sub-categories filtered by selected Group (if a group is selected)
  const availableSubCategories = useMemo(() => {
    let pool = allItems;
    if (exportCategory !== 'ALL') {
      pool = pool.filter((i) => i.category === exportCategory);
    }
    const set = new Set<string>();
    pool.forEach((i) => {
      set.add(getAssetSubCategory(i));
    });
    if (exportCategory === 'ALL' || exportCategory === 'MACHINE') {
      liveMachines.forEach((m) => {
        if (m.typeName) set.add(m.typeName);
        else if (m.type) set.add(m.type.replace(/_/g, ' '));
      });
    }
    return Array.from(set).sort();
  }, [exportCategory, allItems, liveMachines]);

  // Locations dynamically filtered by currently selected Group & Category (Sub-Category)
  const availableLocations = useMemo(() => {
    let pool = allItems;
    if (exportCategory !== 'ALL') {
      pool = pool.filter((i) => i.category === exportCategory);
    }
    if (subCategoryFilter !== 'ALL') {
      const subTarget = subCategoryFilter.toLowerCase();
      pool = pool.filter((i) => getAssetSubCategory(i).toLowerCase().includes(subTarget));
    }
    const set = new Set<string>();
    pool.forEach((item) => {
      const loc = getAssetLocation(item);
      if (loc) set.add(loc);
    });
    if (set.size === 0) return allLocations;
    return Array.from(set).sort();
  }, [allItems, exportCategory, subCategoryFilter, allLocations]);

  // Helper to extract repair cost
  const getAssetRepairCost = (item: AssetHistoryRecord): number => {
    if (typeof item.totalRepairCost === 'number') return item.totalRepairCost;
    return item.totalMaintenanceCost || 0;
  };

  // Filtered items based on active/completed status, category, sub-category, location, mechanic, cost, purchase date, date range and search query
  const filtered = useMemo(() => {
    return allItems.filter((item) => {
      // 1. Group filter (Machine, Furniture, Utilities, Vehicle)
      if (exportCategory !== 'ALL' && item.category !== exportCategory) {
        return false;
      }

      // 2. Category / Sub-Category filter
      if (subCategoryFilter !== 'ALL') {
        const sub = getAssetSubCategory(item).toLowerCase();
        if (!sub.includes(subCategoryFilter.toLowerCase())) {
          return false;
        }
      }

      // 3. Location filter
      if (locationFilter !== 'ALL') {
        const loc = getAssetLocation(item).toLowerCase();
        if (!loc.includes(locationFilter.toLowerCase())) {
          return false;
        }
      }

      // 4. Status filter
      if (statusFilter !== 'all' && item.status !== statusFilter) {
        return false;
      }

      // 5. Mechanic filter
      if (mechanicFilter !== 'ALL') {
        const primaryMech = getAssetMechanic(item).toLowerCase();
        const target = mechanicFilter.toLowerCase();
        const hasLogByMech = item.serviceLogs.some((l) => l.technician?.toLowerCase() === target);
        if (!primaryMech.includes(target) && !hasLogByMech) {
          return false;
        }
      }

      // 6. Repair Cost filter
      if (repairCostFilter !== 'ALL') {
        const cost = getAssetRepairCost(item);
        if (repairCostFilter === 'HAS_COST' && cost <= 0) return false;
        if (repairCostFilter === 'ZERO' && cost > 0) return false;
        if (repairCostFilter === 'UNDER_500' && cost >= 500) return false;
        if (repairCostFilter === '500_TO_1500' && (cost < 500 || cost > 1500)) return false;
        if (repairCostFilter === 'OVER_1500' && cost <= 1500) return false;
      }

      // 7. Purchase Date filter
      if (purchaseFromDate && (!item.purchaseDate || item.purchaseDate < purchaseFromDate)) {
        return false;
      }
      if (purchaseToDate && (!item.purchaseDate || item.purchaseDate > purchaseToDate)) {
        return false;
      }

      // 8. Relocation filter (Relocated vs Static)
      if (relocatedFilter !== 'ALL') {
        const relocated = isAssetRelocated(item);
        if (relocatedFilter === 'RELOCATED' && !relocated) return false;
        if (relocatedFilter === 'NON_RELOCATED' && relocated) return false;
      }

      // 9. General Activity Date range filter (from - to)
      if (fromDate || toDate) {
        const hasLogInRange = item.serviceLogs.some((log) => {
          if (fromDate && log.date < fromDate) return false;
          if (toDate && log.date > toDate) return false;
          return true;
        });

        const hasPpmInRange = item.ppmChecklist.some((ppm) => {
          if (!ppm.lastChecked) return false;
          if (fromDate && ppm.lastChecked < fromDate) return false;
          if (toDate && ppm.lastChecked > toDate) return false;
          return true;
        });

        const hasMoveInRange = (item.locationHistory || []).some((loc) => {
          if (!loc.date) return false;
          if (fromDate && loc.date < fromDate) return false;
          if (toDate && loc.date > toDate) return false;
          return true;
        });

        const purchaseInRange = (() => {
          if (!item.purchaseDate) return false;
          if (fromDate && item.purchaseDate < fromDate) return false;
          if (toDate && item.purchaseDate > toDate) return false;
          return true;
        })();

        if (!hasLogInRange && !hasPpmInRange && !hasMoveInRange && !purchaseInRange) {
          return false;
        }
      }

      // 9. Search query
      if (q.trim()) {
        const query = q.toLowerCase().trim();
        const matchesId = item.assetId.toLowerCase().includes(query);
        const matchesName = item.name.toLowerCase().includes(query);
        const matchesBrand = item.brand.toLowerCase().includes(query);
        const matchesModel = item.model.toLowerCase().includes(query);
        const matchesSub = getAssetSubCategory(item).toLowerCase().includes(query);
        const matchesLoc = getAssetLocation(item).toLowerCase().includes(query);
        const matchesUnit = item.unit.toLowerCase().includes(query);
        const matchesSerial = item.serialNo.toLowerCase().includes(query);
        const matchesMech = getAssetMechanic(item).toLowerCase().includes(query);
        const loc = getAssetLocationHistory(item);
        const curLoc = loc.find((l) => l.status === 'CURRENT')?.toLocation || '';
        const prevLoc = loc.find((l) => l.status === 'CURRENT')?.fromLocation || '';
        const matchesLocHist = curLoc.toLowerCase().includes(query) || prevLoc.toLowerCase().includes(query);
        if (
          !matchesId &&
          !matchesName &&
          !matchesBrand &&
          !matchesModel &&
          !matchesSub &&
          !matchesLoc &&
          !matchesUnit &&
          !matchesSerial &&
          !matchesLocHist &&
          !matchesMech
        ) {
          return false;
        }
      }

      return true;
    });
  }, [allItems, exportCategory, subCategoryFilter, locationFilter, statusFilter, mechanicFilter, repairCostFilter, relocatedFilter, purchaseFromDate, purchaseToDate, fromDate, toDate, q]);

  // Display categories (filtered by category selector if specific category chosen)
  const activeCategoriesMeta = useMemo(() => {
    if (exportCategory === 'ALL') return CATEGORIES_META;
    return CATEGORIES_META.filter((c) => c.id === exportCategory);
  }, [exportCategory]);

  // Dynamically group sections based on Group selector (By Category, By Sub-Category, By Location, By Mechanic, By Status)
  const groupedSections = useMemo(() => {
    if (groupBy === 'CATEGORY') {
      return activeCategoriesMeta
        .map((cat) => {
          const catItems = filtered.filter((i) => i.category === cat.id);
          return {
            id: cat.id,
            title: cat.title,
            subtitle: cat.subtitle,
            icon: cat.icon,
            items: catItems,
            theme: cat.theme,
          };
        })
        .filter((s) => s.items.length > 0 || exportCategory === s.id || exportCategory === 'ALL');
    }

    if (groupBy === 'SUBCATEGORY') {
      const subMap = new Map<string, AssetHistoryRecord[]>();
      filtered.forEach((item) => {
        const sub = getAssetSubCategory(item);
        if (!subMap.has(sub)) subMap.set(sub, []);
        subMap.get(sub)!.push(item);
      });

      const subThemes = [
        {
          bg: 'bg-indigo-50/50',
          border: 'border-indigo-200',
          badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
          text: 'text-indigo-700',
          accent: 'bg-indigo-600',
          headerBg: 'bg-gradient-to-r from-indigo-50/80 via-white to-slate-50',
        },
        {
          bg: 'bg-teal-50/50',
          border: 'border-teal-200',
          badgeBg: 'bg-teal-50 text-teal-800 border-teal-200',
          text: 'text-teal-800',
          accent: 'bg-teal-600',
          headerBg: 'bg-gradient-to-r from-teal-50/80 via-white to-slate-50',
        },
        {
          bg: 'bg-amber-50/50',
          border: 'border-amber-200',
          badgeBg: 'bg-amber-50 text-amber-800 border-amber-200',
          text: 'text-amber-800',
          accent: 'bg-amber-600',
          headerBg: 'bg-gradient-to-r from-amber-50/80 via-white to-slate-50',
        },
        {
          bg: 'bg-purple-50/50',
          border: 'border-purple-200',
          badgeBg: 'bg-purple-50 text-purple-800 border-purple-200',
          text: 'text-purple-800',
          accent: 'bg-purple-600',
          headerBg: 'bg-gradient-to-r from-purple-50/80 via-white to-slate-50',
        },
      ];

      return Array.from(subMap.entries()).map(([subName, sItems], idx) => {
        const theme = subThemes[idx % subThemes.length];
        return {
          id: `sub-${subName}`,
          title: `Sub-Category: ${subName}`,
          subtitle: `Equipment and machinery classified under ${subName} (${sItems.length} units)`,
          icon: Cpu,
          items: sItems,
          theme,
        };
      });
    }

    if (groupBy === 'LOCATION') {
      const lineMap = new Map<string, AssetHistoryRecord[]>();
      filtered.forEach((item) => {
        const loc = getAssetLocation(item);
        if (!lineMap.has(loc)) lineMap.set(loc, []);
        lineMap.get(loc)!.push(item);
      });

      return Array.from(lineMap.entries()).map(([lineName, lItems]) => {
        return {
          id: `loc-${lineName}`,
          title: `Location: ${lineName}`,
          subtitle: `Machinery and installations stationed in ${lineName} (${lItems.length} units)`,
          icon: MapPin,
          items: lItems,
          theme: {
            bg: 'bg-slate-50/50',
            border: 'border-slate-200',
            badgeBg: 'bg-slate-100 text-slate-800 border-slate-300',
            text: 'text-slate-800',
            accent: 'bg-slate-700',
            headerBg: 'bg-gradient-to-r from-slate-100/80 via-white to-slate-50',
          },
        };
      });
    }

    if (groupBy === 'MECHANIC') {
      const mechMap = new Map<string, AssetHistoryRecord[]>();
      filtered.forEach((item) => {
        const mech = getAssetMechanic(item);
        if (!mechMap.has(mech)) mechMap.set(mech, []);
        mechMap.get(mech)!.push(item);
      });

      const mechThemes = [
        {
          bg: 'bg-indigo-50/50',
          border: 'border-indigo-200',
          badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
          text: 'text-indigo-700',
          accent: 'bg-indigo-600',
          headerBg: 'bg-gradient-to-r from-indigo-50/80 via-white to-slate-50',
        },
        {
          bg: 'bg-emerald-50/50',
          border: 'border-emerald-200',
          badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          text: 'text-emerald-800',
          accent: 'bg-emerald-600',
          headerBg: 'bg-gradient-to-r from-emerald-50/80 via-white to-slate-50',
        },
        {
          bg: 'bg-amber-50/50',
          border: 'border-amber-200',
          badgeBg: 'bg-amber-50 text-amber-800 border-amber-200',
          text: 'text-amber-800',
          accent: 'bg-amber-600',
          headerBg: 'bg-gradient-to-r from-amber-50/80 via-white to-slate-50',
        },
        {
          bg: 'bg-purple-50/50',
          border: 'border-purple-200',
          badgeBg: 'bg-purple-50 text-purple-800 border-purple-200',
          text: 'text-purple-800',
          accent: 'bg-purple-600',
          headerBg: 'bg-gradient-to-r from-purple-50/80 via-white to-slate-50',
        },
      ];

      return Array.from(mechMap.entries()).map(([mechName, mItems], idx) => {
        const theme = mechThemes[idx % mechThemes.length];
        return {
          id: `mech-${mechName}`,
          title: `Technician: ${mechName}`,
          subtitle: `Equipment and service work orders attended by ${mechName} (${mItems.length} units)`,
          icon: User,
          items: mItems,
          theme,
        };
      });
    }

    if (groupBy === 'RELOCATION') {
      const relocatedItems = filtered.filter((i) => isAssetRelocated(i));
      const nonRelocatedItems = filtered.filter((i) => !isAssetRelocated(i));

      return [
        {
          id: 'reloc-transferred',
          title: 'Relocated & Transferred Fleet',
          subtitle: `Equipment moved between lines, stations, or departments (${relocatedItems.length} units)`,
          icon: ArrowRightLeft,
          items: relocatedItems,
          theme: {
            bg: 'bg-indigo-50/50',
            border: 'border-indigo-200',
            badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
            text: 'text-indigo-700',
            accent: 'bg-indigo-600',
            headerBg: 'bg-gradient-to-r from-indigo-50/80 via-white to-slate-50',
          },
        },
        {
          id: 'reloc-static',
          title: 'Stationary / Initial Commissioning Fleet',
          subtitle: `Equipment remaining at original placement station (${nonRelocatedItems.length} units)`,
          icon: MapPin,
          items: nonRelocatedItems,
          theme: {
            bg: 'bg-slate-50/50',
            border: 'border-slate-200',
            badgeBg: 'bg-slate-100 text-slate-700 border-slate-300',
            text: 'text-slate-800',
            accent: 'bg-slate-700',
            headerBg: 'bg-gradient-to-r from-slate-100/80 via-white to-slate-50',
          },
        },
      ].filter((s) => s.items.length > 0);
    }

    // Default: STATUS / RISK
    const statusMap = new Map<string, AssetHistoryRecord[]>();
    filtered.forEach((item) => {
      const st = item.riskLevel || 'LOW';
      if (!statusMap.has(st)) statusMap.set(st, []);
      statusMap.get(st)!.push(item);
    });

    return Array.from(statusMap.entries()).map(([statusName, sItems]) => {
      const isCritical = statusName === 'CRITICAL' || statusName === 'HIGH';
      return {
        id: `status-${statusName}`,
        title: `Priority Risk: ${statusName}`,
        subtitle: `${sItems.length} assets categorized under ${statusName} maintenance risk`,
        icon: AlertTriangle,
        items: sItems,
        theme: {
          bg: isCritical ? 'bg-rose-50/50' : 'bg-blue-50/50',
          border: isCritical ? 'border-rose-200' : 'border-blue-200',
          badgeBg: isCritical ? 'bg-rose-50 text-rose-800 border-rose-200' : 'bg-blue-50 text-blue-800 border-blue-200',
          text: isCritical ? 'text-rose-800' : 'text-blue-800',
          accent: isCritical ? 'bg-rose-600' : 'bg-blue-600',
          headerBg: isCritical
            ? 'bg-gradient-to-r from-rose-50/80 via-white to-slate-50'
            : 'bg-gradient-to-r from-blue-50/80 via-white to-slate-50',
        },
      };
    });
  }, [groupBy, filtered, activeCategoriesMeta, exportCategory]);

  const allCollapsed =
    groupedSections.length > 0 &&
    groupedSections.every((s) => collapsedCategories.includes(s.id));

  const toggleCollapseAll = () => {
    if (allCollapsed) {
      setCollapsedCategories([]);
    } else {
      setCollapsedCategories(groupedSections.map((s) => s.id));
    }
  };

  // Date formatting helper
  const shortDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
      return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
    }
    return dateStr;
  };

  // Helper functions for cell presentation
  const riskBadgeClass = (risk: AssetHistoryRecord['riskLevel']) => {
    if (risk === 'CRITICAL') return 'bg-rose-100 text-rose-800 border-rose-300';
    if (risk === 'HIGH') return 'bg-amber-100 text-amber-800 border-amber-300';
    if (risk === 'MEDIUM') return 'bg-blue-100 text-blue-800 border-blue-300';
    return 'bg-emerald-100 text-emerald-800 border-emerald-300';
  };

  const cellStatusStyle = (stage?: StageDetail) => {
    if (!stage || stage.status === 'NA') return 'bg-slate-50 text-slate-400 italic';
    if (stage.status === 'COMPLETED') return 'bg-emerald-50/50 text-emerald-900 border-emerald-100';
    if (stage.status === 'DELAYED') return 'bg-rose-50 text-rose-900 border-rose-200';
    if (stage.status === 'IN_PROGRESS') return 'bg-indigo-50/70 text-indigo-900 border-indigo-200';
    if (stage.status === 'PARTIAL') return 'bg-amber-50 text-amber-900 border-amber-200';
    return 'bg-white text-slate-600';
  };

  // CSV export function filtered by Category and From-To Date Range
  const handleExportFilteredData = () => {
    // 1. Target assets based on category
    const targetAssets = exportCategory === 'ALL'
      ? allItems
      : allItems.filter((i) => i.category === exportCategory);

    const headers = [
      'Asset ID',
      'Asset Name',
      'Category',
      'Brand',
      'Model',
      'Unit / Station',
      'Record Type',
      'Event Date',
      'Ticket / Reference',
      'Fault / Milestone Details',
      'Action Taken',
      'Technician In-Charge',
      'Parts Replaced',
      'Downtime Minutes',
      'Cost (INR)',
      'Status',
    ];

    const rows: (string | number)[][] = [];

    targetAssets.forEach((asset) => {
      // Check service logs for date range match
      const matchingLogs = asset.serviceLogs.filter((log) => {
        if (fromDate && log.date < fromDate) return false;
        if (toDate && log.date > toDate) return false;
        return true;
      });

      matchingLogs.forEach((log) => {
        rows.push([
          asset.assetId,
          `"${asset.name.replace(/"/g, '""')}"`,
          asset.categoryLabel,
          asset.brand,
          asset.model,
          `"${asset.unit.replace(/"/g, '""')}"`,
          'Service Log',
          log.date,
          log.ticketId,
          `"${log.faultCategory}: ${log.faultDetails.replace(/"/g, '""')}"`,
          `"${log.actionTaken.replace(/"/g, '""')}"`,
          log.technician,
          `"${(log.partsReplaced || 'None').replace(/"/g, '""')}"`,
          log.downtimeMinutes,
          log.costIncurred,
          log.status,
        ]);
      });

      // Also check stage actions if dates are set
      if (fromDate || toDate) {
        Object.entries(asset.stages).forEach(([stageName, stage]) => {
          const sDate = stage.actualDate || stage.plannedDate;
          if (sDate) {
            if (fromDate && sDate < fromDate) return;
            if (toDate && sDate > toDate) return;
            rows.push([
              asset.assetId,
              `"${asset.name.replace(/"/g, '""')}"`,
              asset.categoryLabel,
              asset.brand,
              asset.model,
              `"${asset.unit.replace(/"/g, '""')}"`,
              'Stage Action',
              sDate,
              stageName,
              `"Status: ${stage.status}${stage.lateDays ? ` (${stage.lateDays}d delay)` : ''}"`,
              `"${stage.notes || 'Stage execution milestone'}"`,
              stage.assignee || 'Unassigned',
              'None',
              0,
              0,
              stage.status,
            ]);
          }
        });
      }

      // If no date filters are active, also include asset master summary row if no service logs exist
      if (!fromDate && !toDate && matchingLogs.length === 0) {
        rows.push([
          asset.assetId,
          `"${asset.name.replace(/"/g, '""')}"`,
          asset.categoryLabel,
          asset.brand,
          asset.model,
          `"${asset.unit.replace(/"/g, '""')}"`,
          'Asset Master',
          asset.purchaseDate,
          'PURCHASE',
          'Standard Equipment Registry',
          'Preventive Maintenance Protocol',
          'Plant Engineering',
          'None',
          asset.downtimeMins,
          asset.totalMaintenanceCost,
          asset.status.toUpperCase(),
        ]);
      }
    });

    if (rows.length === 0) {
      showToast('No history records found for the selected date range and category.', 'warning');
      return;
    }

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\r\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const dateLabel = fromDate && toDate ? `${fromDate}_to_${toDate}` : fromDate ? `from_${fromDate}` : toDate ? `to_${toDate}` : 'all_dates';
    link.setAttribute('download', `history_export_${exportCategory.toLowerCase()}_${dateLabel}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast(`Exported ${rows.length} history records successfully!`, 'success');
  };

  // Prevent flash while authentication is resolving
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const currentRole = normalizeRole(user?.role || role);
  const isFloorTechnician = currentRole === 'MECHANIC' || currentRole === 'ELECTRICIAN';

  // =========================================================================
  // VIEW 1: PERSONNEL WORK HISTORY (TABLE FORM) - COMPLETED WORKS ARCHIVE
  // =========================================================================
  if (adminTab === 'PERSONNEL') {
    return (
      <div className="space-y-4 pt-0 animate-in fade-in duration-200">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 shadow-2xs">
              <CheckCircle2 className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                  {isFloorTechnician ? 'My Work History & Completed Works' : 'Completed TNAs: History of Completed Works'}
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  {isFloorTechnician ? 'Personal Ledger' : 'History Archive'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {isFloorTechnician
                  ? `Completed breakdown repairs, executed PPM inspections, downtime recovered, and work order log for ${user?.name || 'Technician'}`
                  : 'Audit ledger of all completed breakdown repairs, executed PPM overhauls, downtime recovered, and technician logs'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {isFloorTechnician ? (
              <Link
                href="/dashboard/calendar"
                className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer self-start sm:self-auto"
              >
                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                <span>Pending Tasks</span>
              </Link>
            ) : (
              <Link
                href="/dashboard/active-tna"
                className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>Active TNAs</span>
              </Link>
            )}
            <button
              type="button"
              onClick={() => setIsBulkQrModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
              title="Print Bulk QR Codes for machinery & assets"
            >
              <QrCode className="w-3.5 h-3.5" />
              <Printer className="w-3.5 h-3.5" />
              <span>Print Bulk QR</span>
            </button>
            <button
              type="button"
              onClick={() => setAdminTab('ASSETS')}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-2xs cursor-pointer"
              title="Switch to Asset Category Matrix"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Asset Category Matrix</span>
            </button>
          </div>
        </div>
        <PersonnelWorkHistoryTable />
      </div>
    );
  }

  // =========================================================================
  // VIEW B: DEDICATED FULL HISTORY PAGE FOR THE CLICKED ITEM
  // =========================================================================
  if (selectedAssetForHistory) {
    const a = selectedAssetForHistory;
    const locationHistory = getAssetLocationHistory(a);

    return (
      <div className="space-y-4 pt-0 animate-in fade-in duration-200">
        {/* Top Back Navigation Bar */}
        <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSelectedAssetForHistory(null)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition cursor-pointer shadow-2xs"
            >
              <ArrowLeft className="w-4 h-4 text-slate-600" />
              <span>Back to Categories Matrix</span>
            </button>

            <div className="h-4 w-px bg-slate-200 hidden sm:block"></div>

            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span>History</span>
              <span>/</span>
              <span className="font-bold text-slate-800">{a.categoryLabel}</span>
              <span>/</span>
              <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                {a.assetId}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer shadow-2xs"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Print Dossier</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedAssetForHistory(null)}
              className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
              title="Close Page"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Hero Dossier Header Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shadow-2xs shrink-0 mt-0.5">
                {a.category === 'MACHINE' ? (
                  <Wrench className="w-6 h-6" />
                ) : a.category === 'FURNITURE' ? (
                  <Armchair className="w-6 h-6" />
                ) : a.category === 'UTILITY' ? (
                  <Zap className="w-6 h-6" />
                ) : (
                  <Truck className="w-6 h-6" />
                )}
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                    {a.name}
                  </h1>
                  <span className="font-mono font-bold text-xs bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md border border-slate-200">
                    {a.assetId}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase border ${riskBadgeClass(
                      a.riskLevel
                    )}`}
                  >
                    {a.riskLevel} Risk
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                  <span>
                    Brand: <strong className="text-slate-800 font-semibold">{a.brand}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Model: <strong className="text-slate-800 font-semibold">{a.model}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Serial No: <strong className="text-slate-800 font-mono font-semibold">{a.serialNo}</strong>
                  </span>
                  <span>•</span>
                  <span>
                    Location: <strong className="text-indigo-700 font-semibold">{a.unit}</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Status & Quick Overview */}
            <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
              <div className="text-right">
                <span className="text-[10px] text-slate-400 font-bold uppercase">Asset Status</span>
                <p className="text-xs font-bold text-emerald-700 flex items-center justify-end gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>{a.status === 'active' ? 'Operational / Active' : 'Serviced / Closed'}</span>
                </p>
              </div>
            </div>
          </div>

          {/* Key Metrics KPI Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4 pt-4 border-t border-slate-100">
            <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200/70">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                Lifetime Services
              </span>
              <span className="text-lg font-black font-mono text-slate-900 mt-0.5 block">
                {a.serviceLogs.length} Records
              </span>
              <span className="text-[10px] text-slate-500">Documented repairs</span>
            </div>

            <div className="bg-rose-50/50 p-3 rounded-xl border border-rose-200/70">
              <span className="text-[10px] text-rose-600 font-bold uppercase tracking-wider block">
                Total Downtime
              </span>
              <span className="text-lg font-black font-mono text-rose-700 mt-0.5 block">
                {a.downtimeMins} mins
              </span>
              <span className="text-[10px] text-rose-600/80">Production loss</span>
            </div>

            <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200/70">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                Purchase Price
              </span>
              <span className="text-lg font-black font-mono text-slate-900 mt-0.5 block">
                ₹{a.purchasePrice.toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] text-slate-500">Acquisition value</span>
            </div>

            <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200/70">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                Maintenance Cost
              </span>
              <span className="text-lg font-black font-mono text-indigo-700 mt-0.5 block">
                ₹{a.totalMaintenanceCost.toLocaleString('en-IN')}
              </span>
              <span className="text-[10px] text-slate-500">Cumulative lifecycle</span>
            </div>

            <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200/70 col-span-2 sm:col-span-1">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
                Age &amp; In-Service Date
              </span>
              <span className="text-lg font-black font-mono text-slate-900 mt-0.5 block">
                {a.age}
              </span>
              <span className="text-[10px] text-slate-500">Since {a.purchaseDate}</span>
            </div>
          </div>
        </div>

        {/* Dossier Navigation Tabs */}
        <div className="bg-white rounded-2xl border border-slate-200 p-2 shadow-xs flex flex-wrap items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => setActiveDossierTab('LOGS')}
            className={`px-3 py-2 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeDossierTab === 'LOGS'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Complete Service &amp; Repair History ({a.serviceLogs.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveDossierTab('STAGES')}
            className={`px-3 py-2 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeDossierTab === 'STAGES'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Time &amp; Action Stages Audit</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveDossierTab('PPM')}
            className={`px-3 py-2 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeDossierTab === 'PPM'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Preventive Maintenance Checklist ({a.ppmChecklist.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveDossierTab('LOCATION')}
            className={`px-3 py-2 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeDossierTab === 'LOCATION'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            <span>Location History ({locationHistory.length})</span>
          </button>
        </div>

        {/* Tab 1: Service & Repair Logs Table */}
        {activeDossierTab === 'LOGS' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Chronological Service &amp; Work Done History
                </h3>
                <p className="text-[11px] text-slate-500">
                  Every past breakdown, preventive servicing, action taken by mechanics, and replaced components
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200">
                  {a.serviceLogs.length} Events Logged
                </span>
                <span className="text-xs font-mono font-bold bg-rose-50 text-rose-700 px-2.5 py-1 rounded-lg border border-rose-200">
                  ⏱ {a.serviceLogs.reduce((acc, l) => acc + l.downtimeMinutes, 0)} mins downtime
                </span>
                <span className="text-xs font-mono font-bold bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-lg border border-emerald-200">
                  Total Cost: ₹{a.serviceLogs.reduce((acc, l) => acc + l.costIncurred, 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            {a.serviceLogs.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                No service or maintenance events logged for this asset.
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-300 rounded-lg shadow-2xs">
                <table className="w-full text-left text-xs border-collapse border border-slate-300">
                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-300 select-none">
                    <tr>
                      <th className="py-2.5 px-3 whitespace-nowrap bg-slate-100 border-r border-b border-slate-300 font-mono">Ticket ID &amp; Date</th>
                      <th className="py-2.5 px-3 whitespace-nowrap bg-slate-100 border-r border-b border-slate-300">Category</th>
                      <th className="py-2.5 px-3 min-w-[200px] bg-slate-100 border-r border-b border-slate-300">Issue Reported</th>
                      <th className="py-2.5 px-3 min-w-[220px] bg-slate-100 border-r border-b border-slate-300">Resolution &amp; Action Taken</th>
                      <th className="py-2.5 px-3 whitespace-nowrap bg-slate-100 border-r border-b border-slate-300">Attended By</th>
                      <th className="py-2.5 px-3 min-w-[140px] bg-slate-100 border-r border-b border-slate-300">Parts Replaced</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap bg-slate-100 border-r border-b border-slate-300 font-mono">Downtime</th>
                      <th className="py-2.5 px-3 text-right whitespace-nowrap bg-slate-100 border-r border-b border-slate-300 font-mono">Cost</th>
                      <th className="py-2.5 px-3 text-center whitespace-nowrap bg-slate-100 border-b border-slate-300">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-normal bg-white">
                    {a.serviceLogs.map((log, idx) => (
                      <tr key={idx} className="hover:bg-blue-50/60 even:bg-slate-50/40 transition-colors">
                        <td className="py-2 px-3 whitespace-nowrap align-top border-r border-b border-slate-200">
                          <div className="font-mono font-bold text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 inline-block mb-1">
                            {log.ticketId}
                          </div>
                          <div className="font-mono text-[11px] text-slate-500 flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <span>{log.date}</span>
                          </div>
                        </td>

                        <td className="py-2 px-3 whitespace-nowrap align-top border-r border-b border-slate-200">
                          <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                            {log.faultCategory}
                          </span>
                        </td>

                        <td className="py-2 px-3 align-top text-slate-800 leading-relaxed text-xs border-r border-b border-slate-200">
                          {log.faultDetails}
                        </td>

                        <td className="py-2 px-3 align-top border-r border-b border-slate-200">
                          <div className="bg-emerald-50/70 p-2 rounded border border-emerald-200/80 text-emerald-950 text-xs leading-relaxed font-medium">
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-800 block mb-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 inline" /> Action Taken
                            </span>
                            {log.actionTaken}
                          </div>
                        </td>

                        <td className="py-2 px-3 whitespace-nowrap align-top border-r border-b border-slate-200">
                          <div className="inline-flex items-center gap-1.5 text-slate-700 font-semibold text-xs">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span>{log.technician}</span>
                          </div>
                        </td>

                        <td className="py-2 px-3 align-top border-r border-b border-slate-200">
                          {log.partsReplaced ? (
                            <span className="inline-flex items-center gap-1.5 text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 font-medium text-[11px]">
                              <Package className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                              <span>{log.partsReplaced}</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">—</span>
                          )}
                        </td>

                        <td className="py-2 px-3 text-right whitespace-nowrap align-top border-r border-b border-slate-200 font-mono tabular-nums">
                          {log.downtimeMinutes > 0 ? (
                            <span className="font-mono font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 text-xs">
                              ⏱ {log.downtimeMinutes}m
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono text-xs">0m</span>
                          )}
                        </td>

                        <td className="py-2 px-3 text-right whitespace-nowrap align-top border-r border-b border-slate-200 font-mono tabular-nums">
                          <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-xs">
                            ₹{log.costIncurred.toLocaleString('en-IN')}
                          </span>
                        </td>

                        <td className="py-2 px-3 text-center whitespace-nowrap align-top border-b border-slate-200">
                          {log.status === 'RESOLVED' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Resolved
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              <AlertTriangle className="w-3 h-3 text-amber-600" /> Under Obs.
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {a.serviceLogs.length > 1 && (
                    <tfoot className="bg-slate-50 font-semibold text-slate-700 text-xs border-t border-slate-300">
                      <tr>
                        <td colSpan={6} className="py-2.5 px-3 text-right text-[11px] uppercase tracking-wider text-slate-500 font-bold border-r border-slate-300">
                          Total Summary ({a.serviceLogs.length} Events):
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-700 whitespace-nowrap border-r border-slate-300 tabular-nums">
                          ⏱ {a.serviceLogs.reduce((acc, l) => acc + l.downtimeMinutes, 0)}m
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-800 whitespace-nowrap border-r border-slate-300 tabular-nums">
                          ₹{a.serviceLogs.reduce((acc, l) => acc + l.costIncurred, 0).toLocaleString('en-IN')}
                        </td>
                        <td className="py-2.5 px-3 border-b border-slate-300"></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Time & Action Stages Audit */}
        {activeDossierTab === 'STAGES' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                Time &amp; Action (T&amp;A) Milestone Progress
              </h3>
              <p className="text-[11px] text-slate-500">
                Detailed audit of Planned vs Actual maintenance execution milestones
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(a.stages).map(([stageName, s]) => (
                <div
                  key={stageName}
                  className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-xs">{stageName}</span>
                    {s.status === 'COMPLETED' ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-200 flex items-center gap-1">
                        <Check className="w-3 h-3" /> Done
                      </span>
                    ) : s.status === 'IN_PROGRESS' ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold text-indigo-800 bg-indigo-100 border border-indigo-200">
                        In Progress
                      </span>
                    ) : s.status === 'DELAYED' ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold text-rose-800 bg-rose-100 border border-rose-200">
                        Delayed (+{s.lateDays}d)
                      </span>
                    ) : s.status === 'PARTIAL' ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-200">
                        Partial
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold text-slate-600 bg-slate-200">
                        Not Assigned
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 text-xs pt-1 border-t border-slate-200/70">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Planned Date:</span>
                      <span className="font-semibold text-slate-800">{s.plannedDate}</span>
                    </div>
                    {s.actualDate && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Actual Date:</span>
                        <span className="font-bold text-emerald-700">{s.actualDate}</span>
                      </div>
                    )}
                    {s.assignee && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Technician In-Charge:</span>
                        <span className="font-semibold text-indigo-700">{s.assignee}</span>
                      </div>
                    )}
                    {s.partialQty && (
                      <div className="text-[11px] text-amber-800 bg-amber-50 p-1.5 rounded border border-amber-200 mt-1">
                        Notes: {s.partialQty}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Preventive Maintenance Checklist */}
        {activeDossierTab === 'PPM' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                Preventive Maintenance &amp; Safety Checkpoints
              </h3>
              <p className="text-[11px] text-slate-500">
                Routine calibration, lubrication, and safety compliance checks
              </p>
            </div>

            <div className="overflow-x-auto border border-slate-300 rounded-lg shadow-2xs">
              <table className="w-full text-left text-xs border-collapse border border-slate-300">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-300 select-none">
                  <tr>
                    <th className="py-2.5 px-3 bg-slate-100 border-r border-b border-slate-300">Checkpoint Description</th>
                    <th className="py-2.5 px-3 bg-slate-100 border-r border-b border-slate-300">Frequency</th>
                    <th className="py-2.5 px-3 bg-slate-100 border-r border-b border-slate-300 font-mono">Last Checked</th>
                    <th className="py-2.5 px-3 text-center bg-slate-100 border-r border-b border-slate-300">Status</th>
                    <th className="py-2.5 px-3 bg-slate-100 border-b border-slate-300">Technician Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-medium bg-white">
                  {a.ppmChecklist.map((ppm, idx) => (
                    <tr key={idx} className="hover:bg-blue-50/60 even:bg-slate-50/40 transition-colors">
                      <td className="py-2 px-3 font-semibold text-slate-800 border-r border-b border-slate-200">{ppm.checkpoint}</td>
                      <td className="py-2 px-3 text-slate-600 border-r border-b border-slate-200">{ppm.frequency}</td>
                      <td className="py-2 px-3 font-mono text-slate-700 border-r border-b border-slate-200 tabular-nums">{ppm.lastChecked}</td>
                      <td className="py-2 px-3 text-center border-r border-b border-slate-200">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                            ppm.status === 'PASSED'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                        >
                          {ppm.status === 'PASSED' ? 'Passed ✓' : 'Attention'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-600 italic text-[11px] border-b border-slate-200">{ppm.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 4: Location & Movement History Table */}
        {activeDossierTab === 'LOCATION' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-indigo-600" />
                  <span>Factory Location Tracking &amp; Movement History</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Audit trail of shop-floor relocations, line balancing transfers, and department reassignments
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200">
                  {locationHistory.length} Movements Recorded
                </span>
                <span className="text-xs font-mono font-bold bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-lg border border-indigo-200">
                  Current: {cleanRelocationLocation(a.unit)}
                </span>
              </div>
            </div>

            {/* Current Location Spotlight Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-gradient-to-r from-indigo-50/60 via-slate-50/80 to-white rounded-xl border border-indigo-100 text-xs">
              <div>
                <span className="text-[10px] text-indigo-700 font-bold uppercase tracking-wider block">
                  Current Active Placement
                </span>
                <span className="font-bold text-slate-900 text-sm mt-0.5 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  {cleanRelocationLocation(a.unit)}
                </span>
                <span className="text-[10px] text-slate-500">Shop-floor operational station</span>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                  Initial Commissioning Date
                </span>
                <span className="font-semibold font-mono text-slate-800 text-sm mt-0.5 block">
                  {a.purchaseDate}
                </span>
                <span className="text-[10px] text-slate-500">Inward receiving date</span>
              </div>

              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                  Total Floor Transfers
                </span>
                <span className="font-bold font-mono text-indigo-700 text-sm mt-0.5 block">
                  {Math.max(0, locationHistory.length - 1)} Relocations
                </span>
                <span className="text-[10px] text-slate-500">Since installation</span>
              </div>
            </div>

            {/* Location History Table */}
            <div className="overflow-x-auto border border-slate-300 rounded-lg shadow-2xs">
              <table className="w-full text-left text-xs border-collapse border border-slate-300">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-300 select-none">
                  <tr>
                    <th className="py-2.5 px-3 whitespace-nowrap bg-slate-100 border-r border-b border-slate-300 font-mono">Transfer ID &amp; Date</th>
                    <th className="py-2.5 px-3 whitespace-nowrap bg-slate-100 border-r border-b border-slate-300">From Location (Origin)</th>
                    <th className="py-2.5 px-3 whitespace-nowrap bg-slate-100 border-r border-b border-slate-300">To Location (Destination)</th>
                    <th className="py-2.5 px-3 min-w-[200px] bg-slate-100 border-r border-b border-slate-300">Reason / Justification</th>
                    <th className="py-2.5 px-3 whitespace-nowrap bg-slate-100 border-r border-b border-slate-300">Authorized / Moved By</th>
                    <th className="py-2.5 px-3 min-w-[160px] bg-slate-100 border-r border-b border-slate-300">Technical Notes</th>
                    <th className="py-2.5 px-3 text-center whitespace-nowrap bg-slate-100 border-b border-slate-300">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-normal bg-white">
                  {locationHistory.map((loc, idx) => (
                    <tr key={idx} className="hover:bg-blue-50/60 even:bg-slate-50/40 transition-colors">
                      <td className="py-2 px-3 whitespace-nowrap align-top border-r border-b border-slate-200">
                        <div className="font-mono font-bold text-xs text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 inline-block mb-1">
                          {loc.transferId}
                        </div>
                        <div className="font-mono text-[11px] text-slate-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{loc.date}</span>
                        </div>
                      </td>

                      <td className="py-2 px-3 whitespace-nowrap align-top font-medium text-slate-700 border-r border-b border-slate-200">
                        {cleanRelocationLocation(loc.fromLocation)}
                      </td>

                      <td className="py-2 px-3 whitespace-nowrap align-top font-bold text-indigo-900 border-r border-b border-slate-200">
                        <span className="inline-flex items-center gap-1">
                          <span className="text-indigo-500">➜</span>
                          <span>{cleanRelocationLocation(loc.toLocation)}</span>
                        </span>
                      </td>

                      <td className="py-2 px-3 align-top text-slate-800 leading-relaxed text-xs border-r border-b border-slate-200">
                        {loc.reason}
                      </td>

                      <td className="py-2 px-3 whitespace-nowrap align-top border-r border-b border-slate-200">
                        <div className="inline-flex items-center gap-1.5 text-slate-700 font-semibold text-xs">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>{loc.movedBy}</span>
                        </div>
                      </td>

                      <td className="py-2 px-3 align-top text-slate-600 text-[11px] border-r border-b border-slate-200">
                        {loc.notes || '—'}
                      </td>

                      <td className="py-2 px-3 text-center whitespace-nowrap align-top border-b border-slate-200">
                        {loc.status === 'CURRENT' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            Current Placement
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                            Past Relocation
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // VIEW A: CATEGORIES TIME & ACTION SCROLL MATRIX
  // =========================================================================
  return (
    <div className="space-y-4 pt-0">
      {/* 1. Page Header & Personnel Quick Link */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0 shadow-2xs">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
              Completed TNAs: Issues &amp; PPM History Archive
            </h1>
            <p className="text-[11px] text-slate-500">
              Completed history of breakdown repair issues, resolved machine downtime, and executed PPM overhauls
            </p>
          </div>
        </div>

        {/* Navigation & Toggle Controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <Link
            href="/dashboard/active-tna"
            className="h-8 px-3 text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
          >
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>Active TNAs</span>
          </Link>
          <button
            type="button"
            onClick={() => setIsBulkQrModalOpen(true)}
            className="h-8 px-3 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
            title="Print Bulk QR Codes for machinery & assets"
          >
            <QrCode className="w-3.5 h-3.5" />
            <Printer className="w-3.5 h-3.5" />
            <span>Print Bulk QR</span>
          </button>
          <button
            type="button"
            onClick={() => setAdminTab('PERSONNEL')}
            className="h-8 px-3 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
            title="Switch to Completed Works History Log"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Completed Works History</span>
          </button>
        </div>
      </div>

      {/* 2. Unified Responsive Filter & Grouping Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 p-2.5 sm:p-3 shadow-2xs space-y-2.5">
        {/* Row 1: Search & Quick Bar (Row count, Collapse, In-charge, Export) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          {/* Search Bar - full width on mobile, max-w-sm on sm+ */}
          <div className="relative w-full sm:w-64 md:w-72">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Find asset, ID, brand, mechanic…"
              className="w-full h-8 pl-8 pr-6 text-xs bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-lg text-slate-800 focus:ring-1 focus:ring-indigo-500 outline-none transition"
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ('')}
                className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 cursor-pointer text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Quick Actions (Count, Expand, In-charge, Export) */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-between sm:justify-end w-full sm:w-auto">
            {/* Row counter badge */}
            <span className="text-[11px] sm:text-xs font-bold text-slate-700 bg-slate-100 px-2.5 py-1 sm:py-1.5 rounded-lg border border-slate-200 select-none whitespace-nowrap">
              {filtered.length} rows
            </span>

            {/* Collapse / Expand */}
            <button
              type="button"
              onClick={toggleCollapseAll}
              className="h-8 px-2 sm:px-2.5 text-[11px] sm:text-xs font-semibold bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-200 rounded-lg text-slate-700 flex items-center gap-1 transition cursor-pointer shadow-2xs whitespace-nowrap"
              title={allCollapsed ? 'Expand all sections' : 'Collapse all sections'}
            >
              {allCollapsed ? (
                <>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
                  <span>Expand All</span>
                </>
              ) : (
                <>
                  <ChevronUp className="w-3.5 h-3.5 text-slate-500" />
                  <span>Collapse All</span>
                </>
              )}
            </button>

            {/* View in-charge Checkbox */}
            <label className="inline-flex items-center gap-1.5 text-[11px] sm:text-xs font-medium text-slate-700 cursor-pointer select-none bg-slate-50 hover:bg-slate-100 px-2 py-1.5 rounded-lg border border-slate-200">
              <input
                type="checkbox"
                checked={showPoc}
                onChange={(e) => setShowPoc(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
              <span className="whitespace-nowrap">In-charge</span>
            </label>

            {/* Bulk QR Print Button */}
            <button
              type="button"
              onClick={() => setIsBulkQrModalOpen(true)}
              className="h-8 px-2.5 sm:px-3 text-[11px] sm:text-xs font-bold bg-indigo-50 hover:bg-indigo-100 active:bg-indigo-200 border border-indigo-200 rounded-lg text-indigo-700 inline-flex items-center gap-1.5 cursor-pointer shadow-2xs transition whitespace-nowrap"
              title="Print Bulk QR by chosen number or range"
            >
              <QrCode className="w-3.5 h-3.5 text-indigo-600" />
              <Printer className="w-3.5 h-3.5 text-indigo-600" />
              <span>Bulk QR</span>
            </button>

            {/* Export Button */}
            <button
              type="button"
              onClick={handleExportFilteredData}
              className="h-8 px-2.5 sm:px-3 text-[11px] sm:text-xs font-bold bg-white hover:bg-slate-50 active:bg-slate-100 border border-slate-200 rounded-lg text-slate-800 inline-flex items-center gap-1.5 cursor-pointer shadow-2xs transition whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* Row 2: Responsive Filter Bar (Clean responsive grid/flex across all devices) */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
          {/* 1. Group: [ All Groups | Machine | Furniture | Utilities | Vehicle ] */}
          <div className="flex items-center gap-1 flex-1 sm:flex-initial min-w-[125px]">
            <span className="text-[11px] sm:text-xs font-semibold text-slate-700 whitespace-nowrap">Group:</span>
            <select
              value={exportCategory}
              onChange={(e) => {
                setExportCategory(e.target.value as any);
                setSubCategoryFilter('ALL');
                setLocationFilter('ALL');
              }}
              className="w-full sm:w-auto h-8 px-2 text-[11px] sm:text-xs font-bold bg-white border border-slate-300 rounded-lg text-slate-800 shadow-2xs focus:ring-1 focus:ring-indigo-500 cursor-pointer truncate"
            >
              <option value="ALL">All Groups</option>
              <option value="MACHINE">Machine</option>
              <option value="FURNITURE">Furniture</option>
              <option value="UTILITY">Utilities</option>
              <option value="VEHICLE">Vehicle</option>
            </select>
          </div>

          {/* 2. Category: [ All Categories | Sub-categories based on selected Group ] */}
          <div className="flex items-center gap-1 flex-1 sm:flex-initial min-w-[135px] max-w-full sm:max-w-[165px]">
            <span className="text-[11px] sm:text-xs font-medium text-slate-600 whitespace-nowrap">Category:</span>
            <select
              value={subCategoryFilter}
              onChange={(e) => {
                setSubCategoryFilter(e.target.value);
                setLocationFilter('ALL');
              }}
              className="w-full h-8 px-2 text-[11px] sm:text-xs font-semibold bg-white border border-slate-300 rounded-lg text-slate-800 shadow-2xs focus:ring-1 focus:ring-indigo-500 cursor-pointer truncate"
            >
              <option value="ALL">All Categories</option>
              {availableSubCategories.map((sub) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>
          </div>

          {/* 3. Location: [ All Locations | Filtered to location by their location data ] */}
          <div className="flex items-center gap-1 flex-1 sm:flex-initial min-w-[125px] max-w-full sm:max-w-[155px]">
            <span className="text-[11px] sm:text-xs font-medium text-slate-600 whitespace-nowrap">Location:</span>
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="w-full h-8 px-2 text-[11px] sm:text-xs font-semibold bg-white border border-slate-300 rounded-lg text-slate-800 shadow-2xs focus:ring-1 focus:ring-indigo-500 cursor-pointer truncate"
            >
              <option value="ALL">All Locations</option>
              {availableLocations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>

          {/* 4. Mechanic Filter */}
          <div className="flex items-center gap-1 flex-1 sm:flex-initial min-w-[125px] max-w-full sm:max-w-[150px]">
            <span className="text-[11px] sm:text-xs font-medium text-slate-600 whitespace-nowrap">Mechanic:</span>
            <select
              value={mechanicFilter}
              onChange={(e) => setMechanicFilter(e.target.value)}
              className="w-full h-8 px-2 text-[11px] sm:text-xs font-semibold bg-white border border-slate-300 rounded-lg text-slate-800 shadow-2xs focus:ring-1 focus:ring-indigo-500 cursor-pointer truncate"
            >
              <option value="ALL">All Mechanics</option>
              {allMechanics.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* 5. Repair Cost Filter */}
          <div className="flex items-center gap-1 flex-1 sm:flex-initial min-w-[125px] max-w-full sm:max-w-[145px]">
            <span className="text-[11px] sm:text-xs font-medium text-slate-600 whitespace-nowrap">Repair Cost:</span>
            <select
              value={repairCostFilter}
              onChange={(e) => setRepairCostFilter(e.target.value as any)}
              className="w-full h-8 px-2 text-[11px] sm:text-xs font-semibold bg-white border border-slate-300 rounded-lg text-slate-800 shadow-2xs focus:ring-1 focus:ring-indigo-500 cursor-pointer truncate"
            >
              <option value="ALL">All Costs</option>
              <option value="HAS_COST">Has Cost (&gt; ₹0)</option>
              <option value="ZERO">Zero (₹0)</option>
              <option value="UNDER_500">&lt; ₹500</option>
              <option value="500_TO_1500">₹500 – ₹1,500</option>
              <option value="OVER_1500">&gt; ₹1,500</option>
            </select>
          </div>

          {/* 6. Purchase Date Filter */}
          <div className="flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200 w-full sm:w-auto">
            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="text-[11px] sm:text-xs font-medium text-slate-600 whitespace-nowrap">Purchase:</span>
            <input
              type="date"
              value={purchaseFromDate}
              onChange={(e) => setPurchaseFromDate(e.target.value)}
              className="flex-1 sm:flex-initial h-7 px-1.5 text-[11px] sm:text-xs bg-white border border-slate-200 rounded text-slate-700 outline-none min-w-[110px]"
              title="Purchase Date From"
            />
            <span className="text-[11px] text-slate-400 font-medium">to</span>
            <input
              type="date"
              value={purchaseToDate}
              onChange={(e) => setPurchaseToDate(e.target.value)}
              className="flex-1 sm:flex-initial h-7 px-1.5 text-[11px] sm:text-xs bg-white border border-slate-200 rounded text-slate-700 outline-none min-w-[110px]"
              title="Purchase Date To"
            />
          </div>

          {/* 7. Relocated Asset Filter */}
          <div className="flex items-center gap-1 flex-1 sm:flex-initial min-w-[130px] max-w-full sm:max-w-[160px]">
            <span className="text-[11px] sm:text-xs font-medium text-slate-600 whitespace-nowrap">Relocated:</span>
            <select
              value={relocatedFilter}
              onChange={(e) => setRelocatedFilter(e.target.value as any)}
              className="w-full h-8 px-2 text-[11px] sm:text-xs font-semibold bg-white border border-slate-300 rounded-lg text-slate-800 shadow-2xs focus:ring-1 focus:ring-indigo-500 cursor-pointer truncate"
            >
              <option value="ALL">All Assets</option>
              <option value="RELOCATED">Relocated Only</option>
              <option value="NON_RELOCATED">Never Relocated</option>
            </select>
          </div>

          {/* Table Grouping Selector */}
          <div className="flex items-center gap-1 flex-1 sm:flex-initial min-w-[125px]">
            <span className="text-[11px] sm:text-xs font-medium text-slate-500 whitespace-nowrap">Group Rows:</span>
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as any)}
              className="w-full sm:w-auto h-8 px-2 text-[11px] sm:text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-700 shadow-2xs focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="CATEGORY">By Group</option>
              <option value="SUBCATEGORY">By Sub-Category</option>
              <option value="LOCATION">By Location</option>
              <option value="RELOCATION">By Relocation</option>
              <option value="MECHANIC">By Mechanic</option>
              <option value="STATUS">By Risk Status</option>
            </select>
          </div>

          {/* Reset Filters Button if any filter active */}
          {(exportCategory !== 'ALL' ||
            subCategoryFilter !== 'ALL' ||
            locationFilter !== 'ALL' ||
            mechanicFilter !== 'ALL' ||
            repairCostFilter !== 'ALL' ||
            relocatedFilter !== 'ALL' ||
            purchaseFromDate ||
            purchaseToDate ||
            fromDate ||
            toDate ||
            q) && (
            <button
              type="button"
              onClick={() => {
                setExportCategory('ALL');
                setSubCategoryFilter('ALL');
                setLocationFilter('ALL');
                setMechanicFilter('ALL');
                setRepairCostFilter('ALL');
                setRelocatedFilter('ALL');
                setPurchaseFromDate('');
                setPurchaseToDate('');
                setFromDate('');
                setToDate('');
                setQ('');
              }}
              className="h-8 px-2.5 text-[11px] sm:text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-lg transition cursor-pointer whitespace-nowrap ml-auto sm:ml-0"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* 3. Dedicated Matrix Tables Grouped According to Selection */}
      {allItems.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs flex flex-col items-center justify-center max-w-lg mx-auto my-6">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 mb-4 shadow-2xs">
            <Wrench className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">No Plant Assets Registered</h3>
          <p className="text-xs text-slate-500 max-w-sm mb-5 leading-relaxed">
            There are currently no machines or equipment registered in the plant database. Register your machinery, furniture, utilities, or vehicles to start logging service history and tracking relocation movements.
          </p>
          <a
            href="/dashboard/machines"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-2xs cursor-pointer"
          >
            <Package className="w-4 h-4" />
            <span>Register New Equipment</span>
          </a>
        </div>
      ) : (
        <div className="space-y-4">
          {groupedSections.map((section) => {
            const sectionItems = section.items;
            const Icon = section.icon;
            const isCollapsed = collapsedCategories.includes(section.id);
            const totalSectionDowntime = sectionItems.reduce((acc, c) => acc + c.downtimeMins, 0);
            const criticalCount = sectionItems.filter((i) => i.riskLevel === 'CRITICAL' || i.riskLevel === 'HIGH').length;

            return (
              <section
                key={section.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col overflow-hidden"
              >
                {/* Section Header */}
                <div
                  className={`px-4 py-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${section.theme.headerBg}`}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center border shadow-2xs ${section.theme.badgeBg}`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                          {section.title}
                        </h2>
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200">
                          {sectionItems.length} units
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {section.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <div className="inline-flex items-center gap-2 text-[11px] text-slate-600 bg-white/80 px-2.5 py-1 rounded-lg border border-slate-200">
                      <span>
                        Downtime: <strong className="font-mono text-slate-900">{totalSectionDowntime}m</strong>
                      </span>
                      <span>•</span>
                      <span>
                        High/Critical Risk:{' '}
                        <strong className={criticalCount > 0 ? 'text-rose-600 font-mono' : 'text-slate-900 font-mono'}>
                          {criticalCount}
                        </strong>
                      </span>
                    </div>

                    {/* Collapse / Expand Toggle Button */}
                    <button
                      type="button"
                      onClick={() => toggleCategoryCollapse(section.id)}
                      className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 cursor-pointer shadow-2xs inline-flex items-center gap-1 text-[11px] font-bold"
                    >
                      {isCollapsed ? (
                        <>
                          <span>Expand</span>
                          <ChevronDown className="w-3.5 h-3.5" />
                        </>
                      ) : (
                        <>
                          <span>Collapse</span>
                          <ChevronUp className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Section Independent Scrollable Table */}
                {!isCollapsed && (
                  <div className="relative border border-slate-300 rounded-lg shadow-2xs overflow-hidden">
                    {/* Mobile horizontal scroll hint */}
                    <div className="md:hidden px-3 py-1.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-[10px] text-slate-500 select-none">
                      <span className="flex items-center gap-1 font-medium">
                        <span>👈</span> Swipe horizontally for full matrix columns <span>👉</span>
                      </span>
                      <span className="font-mono text-[9px] uppercase font-bold text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                        Scroll
                      </span>
                    </div>

                    <div
                      className="relative overflow-x-auto overflow-y-auto scrollbar-thin touch-pan-x"
                      style={{ maxHeight: '460px', WebkitOverflowScrolling: 'touch' }}
                    >
                      <table className="w-full text-left border-collapse border-b border-slate-300 text-xs">
                        <thead className="sticky top-0 z-30 bg-slate-100 border-b border-slate-300 text-slate-700 font-bold uppercase text-[10px] tracking-wider select-none shadow-xs">
                          <tr>
                            <th className="sticky left-0 z-40 bg-slate-200/90 px-2.5 py-2.5 text-center w-10 border-r border-b border-slate-300">
                              <input type="checkbox" aria-label="Select all" className="rounded" />
                            </th>
                            <th className="sticky left-10 z-40 bg-slate-100 px-3 py-2.5 min-w-[110px] sm:min-w-[120px] border-r border-b border-slate-300 font-mono">
                              Asset ID
                            </th>
                            <th className="md:sticky md:left-[160px] md:z-40 bg-slate-100 px-3.5 py-2.5 min-w-[170px] sm:min-w-[200px] border-r border-b border-slate-300 md:shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)]">
                              Name
                            </th>
                            <th className="px-3 py-2.5 min-w-[120px] text-center bg-slate-100 border-r border-b border-slate-300">
                              Unit / Station
                            </th>
                            <th className="px-3 py-2.5 min-w-[110px] text-center bg-slate-100 border-r border-b border-slate-300">
                              Breakdown Risk
                            </th>
                            {showPoc && (
                              <th className="px-3 py-2.5 min-w-[140px] text-left bg-slate-100 border-r border-b border-slate-300">
                                In-Charge / Mechanic
                              </th>
                            )}
                            <th className="px-3.5 py-2.5 min-w-[150px] text-left bg-slate-100 border-r border-b border-slate-300">
                              Current Relocation
                            </th>
                            <th className="px-3.5 py-2.5 min-w-[150px] text-left bg-slate-100 border-r border-b border-slate-300">
                              Relocation From
                            </th>
                            <th className="px-3 py-2.5 min-w-[110px] text-right bg-slate-100 border-r border-b border-slate-300 font-mono">
                              Purchase Cost
                            </th>
                            <th className="px-3 py-2.5 min-w-[110px] text-right bg-slate-100 border-r border-b border-slate-300 font-mono">
                              Total PPM Cost
                            </th>
                            <th className="px-3 py-2.5 min-w-[110px] text-right bg-slate-100 border-r border-b border-slate-300 font-mono">
                              Total Repair Cost
                            </th>
                            <th className="px-3 py-2.5 min-w-[110px] text-center bg-slate-100 border-r border-b border-slate-300 font-mono">
                              Repair Time
                            </th>
                            <th className="px-3 py-2.5 min-w-[100px] text-center bg-slate-100 border-b border-slate-300">
                              QR of Asset
                            </th>
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-200 font-medium bg-white">
                          {sectionItems.map((o) => {
                            const locHistory = getAssetLocationHistory(o);
                            const currentEntry = locHistory.find((l) => l.status === 'CURRENT') || locHistory[0];
                            const currentReloc = cleanRelocationLocation(currentEntry ? currentEntry.toLocation : o.unit);
                            const fromReloc = cleanRelocationLocation(currentEntry ? currentEntry.fromLocation : 'Maintenance Workshop');
                            const ppmCost = getAssetPpmCost(o);
                            const repairCost = getAssetRepairCost(o);
                            const assignedTech = getAssetMechanic(o);

                            return (
                              <tr
                                key={o._id}
                                className="hover:bg-blue-50/60 even:bg-slate-50/40 transition-colors duration-100 group"
                              >
                                {/* Checkbox */}
                                <td className="sticky left-0 z-10 bg-white group-hover:bg-blue-50/60 px-2.5 py-2 text-center border-r border-b border-slate-200">
                                  <input
                                    type="checkbox"
                                    aria-label={`Select ${o.assetId}`}
                                    className="rounded"
                                  />
                                </td>

                                {/* Asset ID */}
                                <td
                                  onClick={() => setSelectedAssetForHistory(o)}
                                  className="sticky left-10 z-10 bg-white group-hover:bg-blue-50/60 px-3 py-2 border-r border-b border-slate-200 cursor-pointer"
                                  title="Click to view complete history dossier"
                                >
                                  <div className="font-mono font-bold text-indigo-700 group-hover:underline text-xs">
                                    {o.assetId}
                                  </div>
                                  <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                                    {o.serialNo}
                                  </div>
                                </td>

                                {/* Name */}
                                <td
                                  onClick={() => setSelectedAssetForHistory(o)}
                                  className="md:sticky md:left-[160px] md:z-10 bg-white group-hover:bg-blue-50/60 px-3.5 py-2 border-r border-b border-slate-200 md:shadow-[2px_0_4px_-1px_rgba(0,0,0,0.06)] cursor-pointer"
                                  title="Touch to open complete history dossier"
                                >
                                  <div className="font-bold text-slate-900 group-hover:text-indigo-600 text-xs flex items-center justify-between gap-1">
                                    <span className="truncate max-w-[160px]">{o.name}</span>
                                    <ExternalLink className="w-2.5 h-2.5 text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                                  </div>
                                  <div className="text-[10px] text-slate-500 truncate mt-0.5">
                                    {o.brand} • {o.model}
                                  </div>
                                </td>

                              {/* Unit / Station */}
                              <td className="px-3 py-2 text-center border-r border-b border-slate-200 whitespace-nowrap">
                                <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200 text-[11px] font-semibold">
                                  {o.unit}
                                </span>
                              </td>

                              {/* Breakdown Risk */}
                              <td className="px-3 py-2 text-center border-r border-b border-slate-200 whitespace-nowrap">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${riskBadgeClass(
                                    o.riskLevel
                                  )}`}
                                >
                                  {o.riskLevel}
                                </span>
                              </td>

                              {/* In-Charge / Mechanic (Visible when View in-charge is checked) */}
                              {showPoc && (
                                <td className="px-3 py-2 border-r border-b border-slate-200 whitespace-nowrap">
                                  <div className="flex items-center gap-1.5">
                                    <div className="w-5 h-5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                                      {assignedTech.charAt(0)}
                                    </div>
                                    <div>
                                      <span className="font-semibold text-slate-800 text-xs block truncate max-w-[120px]" title={assignedTech}>
                                        {assignedTech}
                                      </span>
                                      <span className="text-[10px] text-slate-400 block font-mono">Assigned Tech</span>
                                    </div>
                                  </div>
                                </td>
                              )}

                              {/* Current Relocation */}
                              <td className="px-3.5 py-2 border-r border-b border-slate-200 whitespace-nowrap">
                                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                                  <MapPin className="w-3 h-3 text-emerald-600 shrink-0" />
                                  <span>{cleanRelocationLocation(currentReloc)}</span>
                                </div>
                                <div className="text-[10px] text-emerald-700 font-medium pl-4.5 flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                  <span>Active</span>
                                </div>
                              </td>

                              {/* Relocation From */}
                              <td className="px-3.5 py-2 border-r border-b border-slate-200 whitespace-nowrap">
                                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                                  <ArrowRightLeft className="w-3 h-3 text-indigo-500 shrink-0" />
                                  <span>{cleanRelocationLocation(fromReloc)}</span>
                                </div>
                                <div className="text-[10px] text-slate-400 pl-4.5 truncate max-w-[140px]" title={currentEntry?.reason}>
                                  {currentEntry?.reason || 'Initial Commissioning'}
                                </div>
                              </td>

                              {/* Purchase Cost */}
                              <td className="px-3 py-2 text-right font-mono text-xs font-bold text-slate-900 border-r border-b border-slate-200 whitespace-nowrap tabular-nums">
                                ₹{o.purchasePrice.toLocaleString('en-IN')}
                              </td>

                              {/* Total PPM Cost */}
                              <td className="px-3 py-2 text-right font-mono text-xs font-bold text-indigo-700 border-r border-b border-slate-200 whitespace-nowrap tabular-nums">
                                <span className="bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded border border-indigo-200/80 inline-block">
                                  ₹{ppmCost.toLocaleString('en-IN')}
                                </span>
                              </td>

                              {/* Total Repair Cost */}
                              <td className="px-3 py-2 text-right font-mono text-xs font-bold text-rose-700 border-r border-b border-slate-200 whitespace-nowrap tabular-nums">
                                <span className="bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded border border-rose-200/80 inline-block">
                                  ₹{repairCost.toLocaleString('en-IN')}
                                </span>
                              </td>

                              {/* Total Repair Time */}
                              <td className="px-3 py-2 text-center font-mono text-xs font-bold text-slate-800 border-r border-b border-slate-200 whitespace-nowrap tabular-nums">
                                <span className="inline-flex items-center gap-1 text-slate-800">
                                  <Clock className="w-3 h-3 text-amber-500" />
                                  <span>{o.downtimeMins}m</span>
                                </span>
                              </td>

                              {/* QR of the Asset */}
                              <td className="px-3 py-2 text-center whitespace-nowrap border-b border-slate-200">
                                <button
                                  type="button"
                                  onClick={() => setSelectedQrAsset(o)}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold border border-indigo-200 transition cursor-pointer shadow-2xs"
                                  title="View & Print Asset QR Code"
                                >
                                  <QrCode className="w-3 h-3 text-indigo-600" />
                                  <span>QR</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}

                        {sectionItems.length === 0 && (
                          <tr>
                            <td
                              colSpan={showPoc ? 13 : 12}
                              className="p-12 text-center text-slate-400 text-xs font-medium border-b border-slate-200"
                            >
                              No records in {section.title} matching your current filters.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              </section>
            );
          })}
        </div>
      )}

      {/* 4. MODAL: MACHINE QR ASSET STICKER VIEWER */}
      {selectedQrAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-sm w-full p-5 space-y-4 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center shadow-2xs">
                  <QrCode className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-slate-900">Machine QR Asset Tag</h3>
                  <p className="text-[10px] text-slate-500">Scan tag for instant relocation & tickets</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedQrAsset(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* QR Card */}
            <div className="bg-slate-50/80 p-4 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center text-center space-y-3">
              <div className="p-3 bg-white rounded-2xl border-2 border-slate-900 shadow-xs">
                <QRCodeSVG
                  value={`${assetScanUrl(typeof window !== 'undefined' ? window.location.origin : '', selectedQrAsset.assetId)}?brand=${encodeURIComponent(selectedQrAsset.brand)}&model=${encodeURIComponent(selectedQrAsset.model)}&unit=${encodeURIComponent(selectedQrAsset.unit)}`}
                  size={160}
                  level="H"
                  bgColor="#ffffff"
                  fgColor="#000000"
                />
              </div>

              <div>
                <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded border border-indigo-200">
                  {selectedQrAsset.assetId}
                </span>
                <h4 className="text-xs font-extrabold text-slate-900 mt-1.5">{selectedQrAsset.name}</h4>
                <p className="text-[11px] text-slate-500">{selectedQrAsset.brand} • {selectedQrAsset.model}</p>
                <p className="text-[11px] font-semibold text-slate-700 mt-0.5">
                  {selectedQrAsset.serialNo ? (
                    <>Serial No: <span className="text-indigo-600 font-mono font-bold">{selectedQrAsset.serialNo}</span></>
                  ) : (
                    <>Station: <span className="text-indigo-600 font-bold">{selectedQrAsset.unit}</span></>
                  )}
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    const url = `${assetScanUrl(window.location.origin, selectedQrAsset.assetId)}`;
                    navigator.clipboard?.writeText(url);
                    showToast('Asset QR URL copied to clipboard!', 'success');
                  }
                }}
                className="flex-1 py-2 px-3 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer"
              >
                Copy Link
              </button>
              <button
                type="button"
                onClick={() => {
                  document.body.classList.add('printing-single-qr-active');
                  window.print();
                  setTimeout(() => {
                    document.body.classList.remove('printing-single-qr-active');
                  }, 1000);
                }}
                className="flex-1 py-2 px-3 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs shadow-indigo-600/30"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Sticker</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dedicated Portal for Single QR Print (Zero page details) */}
      {selectedQrAsset && typeof document !== 'undefined' && createPortal(
        <div id="single-qr-print-portal" className="hidden print:flex flex-col items-center justify-center p-6 bg-white">
          <div className="p-4 bg-white rounded-2xl border-2 border-black flex flex-col items-center text-center">
            <QRCodeSVG
              value={`${assetScanUrl(typeof window !== 'undefined' ? window.location.origin : '', selectedQrAsset.assetId)}?brand=${encodeURIComponent(selectedQrAsset.brand)}&model=${encodeURIComponent(selectedQrAsset.model)}&unit=${encodeURIComponent(selectedQrAsset.unit)}`}
              size={180}
              level="H"
              bgColor="#ffffff"
              fgColor="#000000"
            />
            <div className="mt-3 font-mono font-black text-sm text-black">
              {selectedQrAsset.assetId}
            </div>
            <div className="text-xs font-bold text-black mt-0.5">
              {selectedQrAsset.brand} • {selectedQrAsset.model}
            </div>
            {selectedQrAsset.serialNo ? (
              <div className="text-[11px] font-semibold text-black mt-0.5 font-mono">
                S/N: {selectedQrAsset.serialNo}
              </div>
            ) : selectedQrAsset.unit ? (
              <div className="text-[11px] font-semibold text-black mt-0.5">
                {selectedQrAsset.unit}
              </div>
            ) : null}
          </div>
        </div>,
        document.body
      )}

      {/* 5. MODAL: BULK QR CODE PRINTING (CHOSEN NUMBER / RANGE / CUSTOM) */}
      <BulkQrPrintModal
        isOpen={isBulkQrModalOpen}
        onClose={() => setIsBulkQrModalOpen(false)}
        assets={bulkQrAssets}
      />
    </div>
  );
}
