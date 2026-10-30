'use client';

import { textValue } from '@/lib/textValue';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Layers,
  Plus,
  ArrowRight,
  Factory,
  ArrowRightLeft,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Building,
  Building2,
  Search,
  Filter,
  Wrench,
  Lightbulb,
  Fan,
  Armchair,
  LayoutGrid,
  SlidersHorizontal,
  RefreshCw,
  Flame,
  X,
  Tag,
  Maximize2,
  Boxes,
  HelpCircle,
  ChevronRight,
  ChevronDown,
  Scissors,
  Zap,
  Palette,
  Archive,
  MapPin,
  IndianRupee,
  UserCheck,
  Check,
  AlertCircle,
  Sparkles,
  ExternalLink,
  Truck,
  ShieldAlert,
  CalendarCheck,
} from 'lucide-react';
import {
  Machine,
  FloorLine,
  AssetCategory,
  MachineType,
  MachineStatus,
  FactoryDepartment,
} from '@/types/cmms';
import { subscribeMachines, createMachine } from '@/lib/services/cmmsService';
import { ScanModal } from '@/components/scan/ScanModal';
import { AssetModal } from '@/components/asset/AssetModal';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import { matchesUnit, isUserAdmin, getUserScopedUnit } from '@/lib/constants/units';
import {
  MACHINE_CATALOG,
  MachineCategoryGroup,
  SUBTYPE_LOOKUP,
  getCategoryForType,
} from '@/lib/machineCatalog';

export interface DepartmentDefinition {
  id: FactoryDepartment;
  name: string;
  shortDesc: string;
  head: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  badgeBg: string;
  accentBorder: string;
}

const FACTORY_DEPARTMENTS: DepartmentDefinition[] = [
  {
    id: 'Cutting Department',
    name: 'Fabric Cutting Department',
    shortDesc: 'Automated spreading tables, band knife cutters & inspection frames',
    head: 'R. Periasamy (Cutting Master)',
    icon: Scissors,
    color: 'text-rose-600 bg-rose-50 border-rose-200/80',
    badgeBg: 'bg-rose-50 text-rose-700 border-rose-200',
    accentBorder: 'border-l-rose-500',
  },
  {
    id: 'Sewing Floor',
    name: 'Sewing & Assembly Floor',
    shortDesc: 'Production lines 01–04, lockstitch/overlock, workstations & task lights',
    head: 'K. Senthil Nathan (Floor In-Charge)',
    icon: Factory,
    color: 'text-indigo-600 bg-indigo-50 border-indigo-200/80',
    badgeBg: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    accentBorder: 'border-l-indigo-500',
  },
  {
    id: 'Finishing & Pressing',
    name: 'Finishing & Steam Pressing',
    shortDesc: 'Vacuum ironing decks, high-pressure steam boiler lines & cooling blowers',
    head: 'K. Subramani (Finishing Supervisor)',
    icon: Flame,
    color: 'text-amber-600 bg-amber-50 border-amber-200/80',
    badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
    accentBorder: 'border-l-amber-500',
  },
  {
    id: 'Embroidery & Printing',
    name: 'Embroidery & Screen Printing Unit',
    shortDesc: 'Multi-head computerized embroidery machines, heat press & rotary printing',
    head: 'M. Senthil (Embroidery Head)',
    icon: Palette,
    color: 'text-purple-600 bg-purple-50 border-purple-200/80',
    badgeBg: 'bg-purple-50 text-purple-700 border-purple-200',
    accentBorder: 'border-l-purple-500',
  },
  {
    id: 'Quality & Packing',
    name: 'Quality Assurance & Packing Deck',
    shortDesc: 'Overhead D65 inspection canopies, conveyor needle detectors & carton tapers',
    head: 'D. Kalpana (QA Lead)',
    icon: ShieldCheck,
    color: 'text-emerald-600 bg-emerald-50 border-emerald-200/80',
    badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    accentBorder: 'border-l-emerald-500',
  },
  {
    id: 'Warehouse & Storage',
    name: 'Warehouse & Material Handling',
    shortDesc: 'Fabric roll cantilever racks, electric hydraulic pallet trucks & weight platforms',
    head: 'A. Manoharan (Store Manager)',
    icon: Boxes,
    color: 'text-blue-600 bg-blue-50 border-blue-200/80',
    badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
    accentBorder: 'border-l-blue-500',
  },
  {
    id: 'Central Utilities & Plant',
    name: 'Central Utilities & Power Plant',
    shortDesc: 'Rotary screw air compressors, 250kVA diesel genset, water softener & sub-station',
    head: 'Chief Electrical Engineer',
    icon: Zap,
    color: 'text-yellow-600 bg-yellow-50 border-yellow-200/80',
    badgeBg: 'bg-yellow-50 text-yellow-800 border-yellow-200',
    accentBorder: 'border-l-yellow-500',
  },
  {
    id: 'Maintenance Workshop',
    name: 'Maintenance Workshop & Tool Crib',
    shortDesc: 'Heavy toolroom lathes, mechanic workbenches, parts storage & buffer standby',
    head: 'Ramesh Kumar (Senior Mechanic)',
    icon: Wrench,
    color: 'text-cyan-600 bg-cyan-50 border-cyan-200/80',
    badgeBg: 'bg-cyan-50 text-cyan-700 border-cyan-200',
    accentBorder: 'border-l-cyan-500',
  },
  {
    id: 'Scrap Bay',
    name: 'Scrap & Salvage Yard',
    shortDesc: 'Decommissioned frames, parts harvesting & metal recycling staging',
    head: 'Salvage Officer',
    icon: Archive,
    color: 'text-slate-600 bg-slate-100 border-slate-200/80',
    badgeBg: 'bg-slate-100 text-slate-700 border-slate-200',
    accentBorder: 'border-l-slate-400',
  },
];

function getAssetDepartment(asset: Machine): FactoryDepartment {
  if (asset.department) return asset.department;
  const line = asset.currentLine || '';
  if (line.includes('Cutting')) return 'Cutting Department';
  if (line.includes('Finishing')) return 'Finishing & Pressing';
  if (line.includes('Embroidery') || line.includes('Printing')) return 'Embroidery & Printing';
  if (line.includes('Quality') || line.includes('Packing')) return 'Quality & Packing';
  if (line.includes('Warehouse')) return 'Warehouse & Storage';
  if (line.includes('Utilities') || line.includes('Boiler') || line.includes('Compressor'))
    return 'Central Utilities & Plant';
  if (line.includes('Buffer') || line.includes('Workshop') || line.includes('Maintenance'))
    return 'Maintenance Workshop';
  if (line.includes('Scrap') || line.includes('Salvage')) return 'Scrap Bay';
  return 'Sewing Floor';
}

function getCategoryMeta(category?: AssetCategory, asset?: Machine) {
  switch (category) {
    case 'FURNITURE':
    case 'TABLE':
    case 'CHAIR': {
      const isChair =
        asset?.type?.startsWith('CHAIR') ||
        asset?.id?.startsWith('CHR') ||
        asset?.category === 'CHAIR';
      if (isChair) {
        return {
          label: 'Ergonomic Chair',
          plural: 'Chairs & Seating',
          icon: Armchair,
          color: 'text-teal-700 bg-teal-50/80 border-teal-200/60',
          badge: 'bg-teal-50 text-teal-800 border-teal-200',
          dot: 'bg-teal-500',
        };
      }
      return {
        label: 'Work Table',
        plural: 'Furniture & Workstations',
        icon: LayoutGrid,
        color: 'text-amber-700 bg-amber-50/80 border-amber-200/60',
        badge: 'bg-amber-50 text-amber-800 border-amber-200',
        dot: 'bg-amber-500',
      };
    }
    case 'VEHICLE':
      return {
        label: 'Plant Vehicle',
        plural: 'Vehicles & Transport',
        icon: Truck,
        color: 'text-stone-700 bg-stone-50/80 border-stone-200/60',
        badge: 'bg-stone-50 text-stone-800 border-stone-200',
        dot: 'bg-stone-500',
      };
    case 'LIGHT':
      return {
        label: 'Lighting Fixture',
        plural: 'Lighting Fixtures',
        icon: Lightbulb,
        color: 'text-yellow-700 bg-yellow-50/80 border-yellow-200/60',
        badge: 'bg-yellow-50 text-yellow-800 border-yellow-200',
        dot: 'bg-yellow-500',
      };
    case 'FAN':
      return {
        label: 'Fan / Vent',
        plural: 'Fans & Ventilation',
        icon: Fan,
        color: 'text-cyan-700 bg-cyan-50/80 border-cyan-200/60',
        badge: 'bg-cyan-50 text-cyan-800 border-cyan-200',
        dot: 'bg-cyan-500',
      };
    case 'UTILITY': {
      const isLight =
        asset?.type?.startsWith('LIGHT') ||
        asset?.id?.startsWith('LGT') ||
        asset?.category === 'LIGHT';
      const isFan =
        asset?.type?.startsWith('FAN') ||
        asset?.id?.startsWith('FAN') ||
        asset?.category === 'FAN';
      if (isLight) {
        return {
          label: 'Lighting Fixture (Utility)',
          plural: 'Utilities, Light & Vent',
          icon: Lightbulb,
          color: 'text-yellow-700 bg-yellow-50/80 border-yellow-200/60',
          badge: 'bg-yellow-50 text-yellow-800 border-yellow-200',
          dot: 'bg-yellow-500',
        };
      }
      if (isFan) {
        return {
          label: 'Ventilation Fan (Utility)',
          plural: 'Utilities, Light & Vent',
          icon: Fan,
          color: 'text-cyan-700 bg-cyan-50/80 border-cyan-200/60',
          badge: 'bg-cyan-50 text-cyan-800 border-cyan-200',
          dot: 'bg-cyan-500',
        };
      }
      return {
        label: 'Plant Utility',
        plural: 'Utilities, Light & Vent',
        icon: Flame,
        color: 'text-purple-700 bg-purple-50/80 border-purple-200/60',
        badge: 'bg-purple-50 text-purple-800 border-purple-200',
        dot: 'bg-purple-500',
      };
    }
    case 'MACHINE':
    default:
      return {
        label: 'Machinery',
        plural: 'Production Machinery',
        icon: Wrench,
        color: 'text-indigo-700 bg-indigo-50/80 border-indigo-200/60',
        badge: 'bg-indigo-50 text-indigo-800 border-indigo-200',
        dot: 'bg-indigo-500',
      };
  }
}

export default function FloorTrackerPage() {
  const { showToast } = useToast();
  const { user, role } = useAuth();
  const isAdmin = isUserAdmin(role);
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

  const [rawMachines, setRawMachines] = useState<Machine[]>([]);
  const machines = useMemo(() => {
    if (isAdmin && selectedUnit === 'ALL') return rawMachines;
    return rawMachines.filter((m) => matchesUnit(m.unit, effectiveUnit));
  }, [rawMachines, isAdmin, selectedUnit, effectiveUnit]);

  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
  const [targetMoveMachineId, setTargetMoveMachineId] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Asset Inspection Popup Modal State
  const [selectedAssetForModal, setSelectedAssetForModal] = useState<Machine | null>(null);
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [modalInitialCategory, setModalInitialCategory] = useState<AssetCategory>('MACHINE');

  // Inline Category Table State (replacing modal popups for category cards)
  const [inlineCategoryView, setInlineCategoryView] = useState<AssetCategory | null>(null);
  const [selectedInlineAsset, setSelectedInlineAsset] = useState<Machine | null>(null);

  const toggleInlineCategory = (cat: AssetCategory) => {
    if (inlineCategoryView === cat) {
      setInlineCategoryView(null);
      setSelectedInlineAsset(null);
    } else {
      setInlineCategoryView(cat);
      setSelectedInlineAsset(null);
    }
  };

  // Expanded department view state (toggle showing all assets for a department)
  const [expandedDepts, setExpandedDepts] = useState<Record<string, boolean>>({});

  const toggleDeptExpand = (deptId: string) => {
    setExpandedDepts((prev) => ({ ...prev, [deptId]: !prev[deptId] }));
  };

  const handleOpenAssetModal = (assetOrId?: Machine | string, category?: AssetCategory) => {
    if (typeof assetOrId === 'string') {
      const found = machines.find((m) => m.id === assetOrId);
      if (found) {
        setSelectedAssetForModal(found);
        setModalInitialCategory(found.category || 'MACHINE');
      }
    } else if (assetOrId) {
      setSelectedAssetForModal(assetOrId);
      setModalInitialCategory(assetOrId.category || 'MACHINE');
    } else if (category) {
      const firstInCat = machines.find((m) => (m.category || 'MACHINE') === category);
      setSelectedAssetForModal(firstInCat || null);
      setModalInitialCategory(category);
    } else {
      setSelectedAssetForModal(machines[0] || null);
      setModalInitialCategory('MACHINE');
    }
    setIsAssetModalOpen(true);
  };

  // Filters & Views
  const [selectedDepartment, setSelectedDepartment] = useState<FactoryDepartment | 'ALL'>('ALL');
  const [activeCategory, setActiveCategory] = useState<AssetCategory | 'ALL' | 'FURNITURE' | 'VEHICLE'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'BREAKDOWN' | 'BUFFER'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'DEPARTMENTS' | 'ASSETS' | 'WORKSTATIONS'>('DEPARTMENTS');

  // New Asset Form State
  const [newCategory, setNewCategory] = useState<AssetCategory>('TABLE');
  const [newUtilitySubtype, setNewUtilitySubtype] = useState<'PLANT' | 'LIGHT' | 'FAN'>('PLANT');
  const [newMachineCat, setNewMachineCat] = useState<MachineCategoryGroup>('OVERLOCK');
  const [newMachineType, setNewMachineType] = useState<MachineType>('OVERLOCK_4_THREAD');
  const [newDepartment, setNewDepartment] = useState<FactoryDepartment>('Cutting Department');
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newBrand, setNewBrand] = useState('');
  const [newModel, setNewModel] = useState('');
  const [newLine, setNewLine] = useState<FloorLine>('Cutting Department');
  const [newStation, setNewStation] = useState('');
  const [newCost, setNewCost] = useState<number | ''>('');
  const [newSpecs, setNewSpecs] = useState('');
  const [newStatus, setNewStatus] = useState<MachineStatus>('ACTIVE');

  const [hasCheckedUrlParams, setHasCheckedUrlParams] = useState(false);

  useEffect(() => {
    const unsub = subscribeMachines((data) => setRawMachines(data));
    return () => unsub();
  }, []);

  // Handle URL query parameters (e.g. ?category=CHAIR or ?openModal=true)
  useEffect(() => {
    if (!hasCheckedUrlParams && typeof window !== 'undefined' && machines.length > 0) {
      setHasCheckedUrlParams(true);
      const params = new URLSearchParams(window.location.search);
      const catParam = params.get('category')?.toUpperCase() as AssetCategory | null;
      const assetIdParam = params.get('assetId');
      const openModalParam = params.get('openModal');

      if (assetIdParam) {
        const found = machines.find((m) => m.id === assetIdParam);
        if (found) {
          setSelectedAssetForModal(found);
          const fCat = found.category || 'MACHINE';
          setModalInitialCategory(fCat === 'LIGHT' || fCat === 'FAN' ? 'UTILITY' : fCat);
          setIsAssetModalOpen(true);
        }
      } else if (catParam && ['MACHINE', 'TABLE', 'CHAIR', 'LIGHT', 'FAN', 'UTILITY'].includes(catParam)) {
        const targetCat = catParam === 'LIGHT' || catParam === 'FAN' ? 'UTILITY' : catParam;
        const firstInCat = machines.find((m) => {
          const mCat = m.category || 'MACHINE';
          return targetCat === 'UTILITY'
            ? mCat === 'UTILITY' || mCat === 'LIGHT' || mCat === 'FAN'
            : mCat === targetCat;
        });
        setSelectedAssetForModal(firstInCat || null);
        setModalInitialCategory(targetCat);
        if (openModalParam === 'true' || params.has('category')) {
          setIsAssetModalOpen(true);
        }
      } else if (openModalParam === 'true') {
        setSelectedAssetForModal(machines[0] || null);
        setModalInitialCategory('MACHINE');
        setIsAssetModalOpen(true);
      }
    }
  }, [machines, hasCheckedUrlParams]);

  // KPIs
  const totalAssets = machines.length;
  const totalValuation = useMemo(
    () => machines.reduce((acc, m) => acc + (m.cost || 0), 0),
    [machines]
  );

  const activeCount = useMemo(() => machines.filter((m) => m.status === 'ACTIVE').length, [machines]);
  const breakdownCount = useMemo(() => machines.filter((m) => m.status === 'BREAKDOWN').length, [machines]);
  const bufferCount = useMemo(() => machines.filter((m) => m.status === 'BUFFER').length, [machines]);
  const scrapCount = useMemo(() => machines.filter((m) => m.status === 'SCRAP').length, [machines]);

  const categoryCounts = useMemo(() => {
    const counts: Record<AssetCategory, number> = {
      MACHINE: 0,
      FURNITURE: 0,
      TABLE: 0,
      CHAIR: 0,
      VEHICLE: 0,
      LIGHT: 0,
      FAN: 0,
      UTILITY: 0,
    };
    machines.forEach((m) => {
      let cat = m.category || 'MACHINE';
      if (cat === 'LIGHT' || cat === 'FAN') cat = 'UTILITY';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return counts;
  }, [machines]);

  const categoryValuations = useMemo(() => {
    const vals: Record<AssetCategory, number> = {
      MACHINE: 0,
      FURNITURE: 0,
      TABLE: 0,
      CHAIR: 0,
      VEHICLE: 0,
      LIGHT: 0,
      FAN: 0,
      UTILITY: 0,
    };
    machines.forEach((m) => {
      let cat = m.category || 'MACHINE';
      if (cat === 'LIGHT' || cat === 'FAN') cat = 'UTILITY';
      vals[cat] = (vals[cat] || 0) + (m.cost || 0);
    });
    return vals;
  }, [machines]);

  const inlineCategoryAssets = useMemo(() => {
    if (!inlineCategoryView) return [];
    if (inlineCategoryView === 'TABLE' || inlineCategoryView === 'FURNITURE') {
      return machines.filter((m) => m.category === 'TABLE' || m.category === 'CHAIR' || m.category === 'FURNITURE');
    }
    if (inlineCategoryView === 'UTILITY') {
      return machines.filter((m) => m.category === 'UTILITY' || m.category === 'LIGHT' || m.category === 'FAN');
    }
    return machines.filter((m) => (m.category || 'MACHINE') === inlineCategoryView);
  }, [machines, inlineCategoryView]);

  // Department counts
  const departmentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    machines.forEach((m) => {
      const dept = getAssetDepartment(m);
      counts[dept] = (counts[dept] || 0) + 1;
    });
    return counts;
  }, [machines]);

  // Filtered Assets Master
  const filteredAssets = useMemo(() => {
    return machines.filter((m) => {
      // Category filter
      if (activeCategory !== 'ALL') {
        const cat = m.category || 'MACHINE';
        if (activeCategory === 'UTILITY') {
          if (cat !== 'UTILITY' && cat !== 'LIGHT' && cat !== 'FAN') return false;
        } else if (activeCategory === 'FURNITURE') {
          if (cat !== 'TABLE' && cat !== 'CHAIR') return false;
        } else if (cat !== activeCategory) {
          return false;
        }
      }
      // Department filter
      const dept = getAssetDepartment(m);
      if (selectedDepartment !== 'ALL' && dept !== selectedDepartment) {
        return false;
      }
      // Status filter
      if (statusFilter !== 'ALL' && m.status !== statusFilter) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const idMatch = textValue(m.id).toLowerCase().includes(q);
        const nameMatch = textValue(m.name)?.toLowerCase().includes(q) || false;
        const brandMatch = textValue(m.brand).toLowerCase().includes(q);
        const modelMatch = textValue(m.model).toLowerCase().includes(q);
        const stationMatch = textValue(m.stationNo).toLowerCase().includes(q);
        const deptMatch = dept.toLowerCase().includes(q);
        const lineMatch = textValue(m.currentLine).toLowerCase().includes(q);
        const specsMatch = textValue(m.specs)?.toLowerCase().includes(q) || false;
        const opMatch = textValue(m.operator)?.toLowerCase().includes(q) || false;
        return (
          idMatch ||
          nameMatch ||
          brandMatch ||
          modelMatch ||
          stationMatch ||
          deptMatch ||
          lineMatch ||
          specsMatch ||
          opMatch
        );
      }
      return true;
    });
  }, [machines, activeCategory, selectedDepartment, statusFilter, searchQuery]);

  // Workstation Matrix specifically for Sewing Lines
  const workstationMatrix = useMemo(() => {
    const sewingMachines = machines.filter((m) => getAssetDepartment(m) === 'Sewing Floor');
    const map: Record<
      string,
      {
        line: FloorLine;
        station: string;
        table?: Machine;
        chair?: Machine;
        machine?: Machine;
        light?: Machine;
        fan?: Machine;
      }
    > = {};

    sewingMachines.forEach((m) => {
      const key = `${m.currentLine}-${m.stationNo}`;
      if (!map[key]) {
        map[key] = {
          line: m.currentLine,
          station: m.stationNo,
        };
      }
      const cat = m.category || 'MACHINE';
      if (cat === 'TABLE') map[key].table = m;
      else if (cat === 'CHAIR') map[key].chair = m;
      else if (
        cat === 'LIGHT' ||
        (cat === 'UTILITY' && (m.type?.startsWith('LIGHT') || m.id?.startsWith('LGT')))
      ) {
        map[key].light = m;
      } else if (
        cat === 'FAN' ||
        (cat === 'UTILITY' && (m.type?.startsWith('FAN') || m.id?.startsWith('FAN')))
      ) {
        map[key].fan = m;
      } else if (cat === 'MACHINE') {
        map[key].machine = m;
      }
    });

    return Object.values(map);
  }, [machines]);

  const handleOpenMove = (assetId: string) => {
    setTargetMoveMachineId(assetId);
    setIsMoveModalOpen(true);
  };

  const handleUtilitySubtypeChangeInForm = (sub: 'PLANT' | 'LIGHT' | 'FAN') => {
    setNewUtilitySubtype(sub);
  };

  const handleCategoryChangeInForm = (cat: AssetCategory) => {
    setNewCategory(cat);
    if (cat === 'LIGHT') {
      setNewUtilitySubtype('LIGHT');
    } else if (cat === 'FAN') {
      setNewUtilitySubtype('FAN');
    }
  };

  const handleMachineCatChangeInForm = (cat: MachineCategoryGroup) => {
    setNewMachineCat(cat);
  };

  const handleMachineSubtypeChangeInForm = (type: MachineType) => {
    setNewMachineType(type);
  };

  const handleCreateAssetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newId.trim()) {
      showToast('Please enter an Asset ID', 'warning');
      return;
    }

    const typeMapping: Record<AssetCategory, MachineType> = {
      MACHINE: 'OVERLOCK_4_THREAD',
      FURNITURE: 'TABLE_SEWING',
      TABLE: 'TABLE_SEWING',
      CHAIR: 'CHAIR_OPERATOR',
      VEHICLE: 'VEHICLE_FORKLIFT',
      LIGHT: 'LIGHT_HIGHBAY',
      FAN: 'FAN_CEILING',
      UTILITY: 'UTILITY_BOILER',
    };

    const targetType =
      newCategory === 'MACHINE'
        ? newMachineType
        : newCategory === 'UTILITY'
        ? newUtilitySubtype === 'LIGHT'
          ? 'LIGHT_HIGHBAY'
          : newUtilitySubtype === 'FAN'
          ? 'FAN_CEILING'
          : 'UTILITY_BOILER'
        : typeMapping[newCategory];

    const subMeta = newCategory === 'MACHINE' ? SUBTYPE_LOOKUP[newMachineType] : undefined;
    const targetTypeName = subMeta
      ? subMeta.name
      : newCategory === 'UTILITY'
      ? newUtilitySubtype === 'LIGHT'
        ? `${newBrand || 'Overhead'} High-Bay LED`
        : newUtilitySubtype === 'FAN'
        ? `${newBrand || 'Industrial'} Ventilation Fan`
        : `${newBrand || 'Plant'} Utility`
      : `${newBrand ? `${newBrand} ` : ''}${getCategoryMeta(newCategory).label}`;

    const newAsset: Machine = {
      id: newId.trim().toUpperCase(),
      name:
        newName.trim() ||
        (newBrand.trim()
          ? `${newBrand.trim()} ${subMeta ? subMeta.name : getCategoryMeta(newCategory).label}${newModel.trim() ? ` (${newModel.trim()})` : ''}`
          : `${subMeta ? subMeta.name : getCategoryMeta(newCategory).label}`),
      brand: newBrand.trim() || 'Generic',
      model: newModel.trim() || 'Standard',
      category: newCategory,
      machineClass: newCategory === 'MACHINE' ? newMachineCat : undefined,
      department: newDepartment,
      type: targetType,
      typeName: targetTypeName,
      purchaseDate: new Date().toISOString().split('T')[0],
      cost: typeof newCost === 'number' ? newCost : Number(newCost) || 0,
      status: newStatus,
      unit: !isAdmin ? effectiveUnit : (selectedUnit !== 'ALL' ? selectedUnit : user?.unit || 'UNIT - 1'),
      area: newDepartment || newLine,
      currentLine: newLine,
      stationNo: newStation.trim() || 'Unassigned Station',
      totalDowntimeMinutes: 0,
      ageYears: 0,
      specs: newSpecs.trim() || (subMeta?.specs || ''),
    };

    try {
      await createMachine(newAsset);
      showToast(`Asset ${newAsset.id} registered at ${newDepartment} (${newStation})!`, 'success');
      setIsAddModalOpen(false);
    } catch (err) {
      showToast('Failed to register asset', 'error');
    }
  };

  const hasActiveFilters = selectedDepartment !== 'ALL' || activeCategory !== 'ALL' || statusFilter !== 'ALL' || searchQuery.trim() !== '';

  const clearAllFilters = () => {
    setSelectedDepartment('ALL');
    setActiveCategory('ALL');
    setStatusFilter('ALL');
    setSearchQuery('');
  };

  if (role === 'MECHANIC' || role === 'SENIOR_MECHANIC' || role === 'ELECTRICIAN' || role === 'SENIOR_ELECTRICIAN') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 bg-white rounded-3xl border border-slate-200 shadow-sm max-w-xl mx-auto space-y-5 my-8">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shadow-xs">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
            Role Access Restriction
          </span>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            Floor Workstations Restricted
          </h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            Floor layouts, workstation matrix, and departmental infrastructure are managed by <strong>Plant Administrators</strong>. Technicians attend machine tickets and monthly maintenance routines.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <Link
            href="/dashboard/calendar"
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-xs"
          >
            <CalendarCheck className="w-4 h-4" />
            <span>Go to Mechanic Calendar</span>
          </Link>
          <Link
            href="/dashboard/inventory"
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition border border-slate-200 flex items-center gap-2"
          >
            <Boxes className="w-4 h-4" />
            <span>Tool Crib &amp; Indents</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. PROFESSIONAL COMMAND-CENTER HEADER */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-2.5 py-0.5 rounded-md flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" />
              <span>Plant Enterprise CMMS</span>
            </span>
            <span className="text-slate-300">•</span>
            {isAdmin ? (
              <select
                value={selectedUnit}
                onChange={(e) => setSelectedUnit(e.target.value)}
                className="text-xs font-bold bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg px-2 py-0.5 text-slate-800 outline-none cursor-pointer"
              >
                <option value="ALL">All Plants</option>
                <option value="UNIT - 1">UNIT - 1</option>
                <option value="UNIT-2">UNIT-2</option>
              </select>
            ) : (
              <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                {effectiveUnit}
              </span>
            )}
            <span className="text-slate-300">•</span>
            <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-md flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>9 Operational Sectors</span>
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Factory Asset Directory & Infrastructure
          </h1>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          {/* Segmented View Mode Tabs */}
          <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewMode('DEPARTMENTS')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'DEPARTMENTS'
                  ? 'bg-white text-indigo-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Departments</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('ASSETS')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'ASSETS'
                  ? 'bg-white text-indigo-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Asset Grid</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('WORKSTATIONS')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'WORKSTATIONS'
                  ? 'bg-white text-indigo-700 shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Workstations</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              handleCategoryChangeInForm('MACHINE');
              setIsAddModalOpen(true);
            }}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition flex items-center gap-2 cursor-pointer shadow-sm shadow-indigo-600/20 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Register Asset</span>
          </button>
        </div>
      </div>

      {/* 2. EXECUTIVE KPI & ASSET METRICS DECK */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Plant Capital & Health Overview Card */}
        <div className="lg:col-span-4 bg-white text-slate-800 rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between text-[11px] font-bold text-indigo-700 uppercase tracking-wider">
              <span>Plant Capital Valuation</span>
              <span className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Audited Fleet
              </span>
            </div>
            <div className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-slate-900 mt-2">
              ₹{totalValuation.toLocaleString('en-IN')}
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
              <span className="text-slate-800 font-bold">{totalAssets} Units Registered</span>
              <span className="text-slate-300">•</span>
              <span className="text-emerald-700 font-semibold">{activeCount} Operational</span>
              {breakdownCount > 0 && (
                <>
                  <span className="text-slate-300">•</span>
                  <span className="text-rose-600 font-bold">{breakdownCount} Defect</span>
                </>
              )}
            </div>
          </div>

          {/* Operational Health Meter Bar */}
          <div className="space-y-2 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 font-medium">Operational Availability</span>
              <span className="font-bold text-emerald-700 font-mono">
                {totalAssets > 0 ? Math.round((activeCount / totalAssets) * 100) : 100}%
              </span>
            </div>

            {/* Segmented Meter */}
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex border border-slate-200/60">
              <div
                style={{ width: `${totalAssets > 0 ? (activeCount / totalAssets) * 100 : 100}%` }}
                className="bg-emerald-500 h-full transition-all"
                title={`Operational: ${activeCount}`}
              />
              <div
                style={{ width: `${totalAssets > 0 ? (bufferCount / totalAssets) * 100 : 0}%` }}
                className="bg-amber-500 h-full transition-all"
                title={`Buffer Standby: ${bufferCount}`}
              />
              <div
                style={{ width: `${totalAssets > 0 ? (breakdownCount / totalAssets) * 100 : 0}%` }}
                className="bg-rose-500 h-full transition-all"
                title={`Breakdown: ${breakdownCount}`}
              />
              <div
                style={{ width: `${totalAssets > 0 ? (scrapCount / totalAssets) * 100 : 0}%` }}
                className="bg-slate-300 h-full transition-all"
                title={`Scrap: ${scrapCount}`}
              />
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1 text-[11px]">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                <span className="text-slate-300 font-mono">{activeCount} Active</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                <span className="text-slate-300 font-mono">{bufferCount} Buffer</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-400 shrink-0" />
                <span className="text-rose-300 font-mono">{breakdownCount} Down</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: 4 Simplified Category Selector Buttons (Enlarged Numbers) */}
        <div className="lg:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          {/* 1. Machinery */}
          <button
            type="button"
            onClick={() => toggleInlineCategory('MACHINE')}
            className={`p-4 sm:p-5 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between min-h-[125px] ${
              inlineCategoryView === 'MACHINE'
                ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-500/20 shadow-sm'
                : 'bg-white border-slate-200/90 hover:border-indigo-300 shadow-xs hover:shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-bold text-slate-800">Machinery</span>
              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-200/60 shadow-2xs">
                <Wrench className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-slate-900">
                {categoryCounts.MACHINE || 0}
              </span>
              <span className="text-[11px] font-bold text-indigo-600">
                {inlineCategoryView === 'MACHINE' ? 'Active Table ✕' : 'Click to View'}
              </span>
            </div>
          </button>

          {/* 2. Furniture */}
          <button
            type="button"
            onClick={() => toggleInlineCategory('TABLE')}
            className={`p-4 sm:p-5 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between min-h-[125px] ${
              inlineCategoryView === 'TABLE' || inlineCategoryView === 'FURNITURE'
                ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-500/20 shadow-sm'
                : 'bg-white border-slate-200/90 hover:border-amber-300 shadow-xs hover:shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-bold text-slate-800">Furniture</span>
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200/60 shadow-2xs">
                <Armchair className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-slate-900">
                {(categoryCounts.TABLE || 0) + (categoryCounts.CHAIR || 0)}
              </span>
              <span className="text-[11px] font-bold text-amber-600">
                {inlineCategoryView === 'TABLE' ? 'Active Table ✕' : 'Click to View'}
              </span>
            </div>
          </button>

          {/* 3. Vehicles */}
          <button
            type="button"
            onClick={() => toggleInlineCategory('VEHICLE')}
            className={`p-4 sm:p-5 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between min-h-[125px] ${
              inlineCategoryView === 'VEHICLE'
                ? 'bg-stone-50 border-stone-500 ring-2 ring-stone-500/20 shadow-sm'
                : 'bg-white border-slate-200/90 hover:border-stone-300 shadow-xs hover:shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-bold text-slate-800">Vehicles</span>
              <div className="w-9 h-9 rounded-xl bg-stone-50 text-stone-600 flex items-center justify-center border border-stone-200/60 shadow-2xs">
                <Truck className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-slate-900">
                {categoryCounts.VEHICLE || 0}
              </span>
              <span className="text-[11px] font-bold text-stone-600">
                {inlineCategoryView === 'VEHICLE' ? 'Active Table ✕' : 'Click to View'}
              </span>
            </div>
          </button>

          {/* 4. Utilities & Plant */}
          <button
            type="button"
            onClick={() => toggleInlineCategory('UTILITY')}
            className={`p-4 sm:p-5 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between min-h-[125px] ${
              inlineCategoryView === 'UTILITY'
                ? 'bg-purple-50 border-purple-500 ring-2 ring-purple-500/20 shadow-sm'
                : 'bg-white border-slate-200/90 hover:border-purple-300 shadow-xs hover:shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-bold text-slate-800">Utilities & Plant</span>
              <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-200/60 shadow-2xs">
                <Flame className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-3xl sm:text-4xl font-black font-mono tracking-tight text-slate-900">
                {categoryCounts.UTILITY || 0}
              </span>
              <span className="text-[11px] font-bold text-purple-600">
                {inlineCategoryView === 'UTILITY' ? 'Active Table ✕' : 'Click to View'}
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* INLINE CATEGORY DATA TABLE (Directly displays data down below without popup) */}
      {inlineCategoryView && (
        <div className="bg-white rounded-2xl border border-indigo-200 shadow-sm p-4 sm:p-5 space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                {inlineCategoryView === 'MACHINE' ? (
                  <Wrench className="w-4 h-4" />
                ) : inlineCategoryView === 'TABLE' ? (
                  <Armchair className="w-4 h-4" />
                ) : inlineCategoryView === 'VEHICLE' ? (
                  <Truck className="w-4 h-4" />
                ) : (
                  <Flame className="w-4 h-4" />
                )}
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-slate-900">
                  {inlineCategoryView === 'MACHINE'
                    ? 'Machinery Asset Register'
                    : inlineCategoryView === 'TABLE'
                    ? 'Workstation Furniture Register'
                    : inlineCategoryView === 'VEHICLE'
                    ? 'Plant Vehicles Register'
                    : 'Utilities & Plant Infrastructure Register'}
                </h3>
                <span className="text-xs text-slate-500 font-medium">
                  {inlineCategoryAssets.length} Registered Units &bull; Click any item to inspect details below
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setInlineCategoryView(null);
                setSelectedInlineAsset(null);
              }}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition cursor-pointer"
            >
              ✕ Close
            </button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-lg border border-slate-300 shadow-2xs">
            <table className="w-full text-left text-xs text-slate-800 border-collapse border border-slate-300">
              <thead className="bg-slate-100 font-bold text-slate-700 uppercase text-[10px] tracking-wider border-b border-slate-300 select-none">
                <tr>
                  <th className="py-2.5 px-3 bg-slate-100 border-r border-b border-slate-300 font-mono">Asset ID</th>
                  <th className="py-2.5 px-3.5 bg-slate-100 border-r border-b border-slate-300 min-w-[180px]">Model / Name</th>
                  <th className="py-2.5 px-3 bg-slate-100 border-r border-b border-slate-300">Brand</th>
                  <th className="py-2.5 px-3.5 bg-slate-100 border-r border-b border-slate-300">Plant Unit &amp; Area</th>
                  <th className="py-2.5 px-3 bg-slate-100 border-r border-b border-slate-300 font-mono">Line &amp; Station</th>
                  <th className="py-2.5 px-3 text-center bg-slate-100 border-r border-b border-slate-300">Status</th>
                  <th className="py-2.5 px-3 text-right bg-slate-100 border-b border-slate-300">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-medium bg-white">
                {inlineCategoryAssets.map((asset) => {
                  const isSelected = selectedInlineAsset?.id === asset.id;
                  const isDown = asset.status === 'BREAKDOWN';
                  const isBuffer = asset.status === 'BUFFER';

                  return (
                    <tr
                      key={asset.id}
                      onClick={() => setSelectedInlineAsset(isSelected ? null : asset)}
                      className={`hover:bg-blue-50/60 even:bg-slate-50/40 cursor-pointer transition ${
                        isSelected ? 'bg-indigo-50/80 ring-1 ring-indigo-300' : ''
                      }`}
                    >
                      <td className="py-2 px-3 font-mono font-bold text-indigo-700 border-r border-b border-slate-200">{asset.id}</td>
                      <td className="py-2 px-3.5 font-bold text-slate-900 border-r border-b border-slate-200">{asset.name || asset.model}</td>
                      <td className="py-2 px-3 text-slate-700 border-r border-b border-slate-200">{asset.brand}</td>
                      <td className="py-2 px-3.5 text-slate-700 border-r border-b border-slate-200">
                        <span className="font-bold text-slate-900">{asset.unit || 'Unit 01'}</span>
                        <span className="text-slate-400 mx-1">•</span>
                        <span className="text-slate-600">{asset.area || asset.department || asset.currentLine || 'Sewing Floor'}</span>
                      </td>
                      <td className="py-2 px-3 font-mono text-slate-700 border-r border-b border-slate-200 tabular-nums">{asset.area || asset.currentLine} ({asset.stationNo})</td>
                      <td className="py-2 px-3 text-center border-r border-b border-slate-200">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isDown
                              ? 'bg-rose-100 text-rose-700 border border-rose-200'
                              : isBuffer
                              ? 'bg-amber-100 text-amber-700 border border-amber-200'
                              : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {asset.status}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right border-b border-slate-200">
                        <span className="text-xs text-indigo-600 font-bold hover:underline">
                          {isSelected ? 'Hide ▲' : 'View ▼'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Selected Asset Inline Details Card */}
          {selectedInlineAsset && (
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2 animate-in fade-in duration-100">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-900">
                  {selectedInlineAsset.id} &mdash; {selectedInlineAsset.name || selectedInlineAsset.model}
                </span>
                <span className="font-mono text-xs font-semibold text-slate-600">
                  ₹{selectedInlineAsset.cost?.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div>
                  <span className="text-slate-500">Brand:</span>{' '}
                  <span className="font-semibold text-slate-800">{selectedInlineAsset.brand}</span>
                </div>
                <div>
                  <span className="text-slate-500">Plant Unit:</span>{' '}
                  <span className="font-semibold text-slate-800">{selectedInlineAsset.unit || 'Unit 01'}</span>
                </div>
                <div>
                  <span className="text-slate-500">Located Area:</span>{' '}
                  <span className="font-semibold text-slate-800">
                    {selectedInlineAsset.area || selectedInlineAsset.department || 'Sewing Floor'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500">Station / Line:</span>{' '}
                  <span className="font-semibold text-slate-800">{selectedInlineAsset.area || selectedInlineAsset.currentLine} ({selectedInlineAsset.stationNo})</span>
                </div>
              </div>
              {selectedInlineAsset.specs && (
                <div className="text-[11px] text-slate-600 pt-1 border-t border-slate-200">
                  <span className="font-bold text-slate-700">Specifications:</span> {selectedInlineAsset.specs}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 3. UNIFIED NEAT & CLEAN FILTER TOOLBAR */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-3 sm:p-4 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Left Side: Search + Dropdown Selectors */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
          {/* Search Input */}
          <div className="relative min-w-[240px] flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Tag ID, brand, model, station, specs..."
              className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-800 transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Department Filter Dropdown */}
          <div className="relative min-w-[190px]">
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value as any)}
              className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer appearance-none pr-8"
            >
              <option value="ALL">All Departments ({totalAssets})</option>
              {FACTORY_DEPARTMENTS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name.replace('Department', 'Dept')} ({departmentCounts[d.id] || 0})
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-3 text-slate-400 pointer-events-none" />
          </div>

          {/* Category Filter Dropdown */}
          <div className="relative min-w-[150px]">
            <select
              value={activeCategory}
              onChange={(e) => setActiveCategory(e.target.value as any)}
              className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer appearance-none pr-8"
            >
              <option value="ALL">All Categories ({totalAssets})</option>
              <option value="MACHINE">Machinery ({categoryCounts.MACHINE || 0})</option>
              <option value="FURNITURE">Furniture ({(categoryCounts.TABLE || 0) + (categoryCounts.CHAIR || 0)})</option>
              <option value="VEHICLE">Vehicles ({categoryCounts.VEHICLE || 0})</option>
              <option value="UTILITY">Utilities & Facilities ({categoryCounts.UTILITY || 0})</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-3 text-slate-400 pointer-events-none" />
          </div>

          {/* Status Filter Dropdown */}
          <div className="relative min-w-[140px]">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer appearance-none pr-8"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Operational ({activeCount})</option>
              <option value="BREAKDOWN">Breakdown ({breakdownCount})</option>
              <option value="BUFFER">Buffer Standby ({bufferCount})</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-3 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {/* Right Side: Active count indicator & Clear button */}
        <div className="flex items-center justify-between sm:justify-end gap-2.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 shrink-0">
          <span className="text-xs font-medium text-slate-500">
            Showing <strong className="text-slate-800 font-mono">{filteredAssets.length}</strong> of{' '}
            <span className="font-mono">{totalAssets}</span> assets
          </span>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/70 px-2.5 py-1.5 rounded-lg transition flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3 h-3" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* 4. VIEW RENDERING MODES */}

      {/* VIEW MODE 1: FACTORY DEPARTMENTS VIEW */}
      {viewMode === 'DEPARTMENTS' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FACTORY_DEPARTMENTS.filter(
              (dept) => selectedDepartment === 'ALL' || dept.id === selectedDepartment
            ).map((dept) => {
              const deptAssets = filteredAssets.filter((m) => getAssetDepartment(m) === dept.id);
              const allDeptAssets = machines.filter((m) => getAssetDepartment(m) === dept.id);
              const deptDownCount = allDeptAssets.filter((m) => m.status === 'BREAKDOWN').length;
              const deptValuation = allDeptAssets.reduce((sum, m) => sum + (m.cost || 0), 0);
              const DeptIcon = dept.icon;
              const isExpanded = !!expandedDepts[dept.id];
              const visibleAssets = isExpanded ? deptAssets : deptAssets.slice(0, 4);

              return (
                <div
                  key={dept.id}
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-sm p-4 space-y-3 flex flex-col justify-between transition"
                >
                  <div>
                    {/* Department Card Header */}
                    <div className="flex items-start justify-between border-b border-slate-100 pb-3 gap-2">
                      <div className="flex items-start gap-2.5">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${dept.color}`}
                        >
                          <DeptIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h4 className="font-extrabold text-slate-900 text-sm tracking-tight">
                              {dept.name}
                            </h4>
                            {deptDownCount > 0 && (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
                                {deptDownCount} Defect
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] font-medium text-slate-400 block truncate mt-0.5">
                            {dept.head}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 font-mono">
                          {deptAssets.length} Units
                        </span>
                        <div className="text-[10px] font-bold text-slate-400 font-mono mt-0.5">
                          ₹{deptValuation.toLocaleString('en-IN')}
                        </div>
                      </div>
                    </div>

                    {/* Staged Assets in Department (Clean row layout without heavy nested boxes) */}
                    <div className="divide-y divide-slate-100 mt-3">
                      {deptAssets.length === 0 ? (
                        <div className="text-center py-6 text-slate-400 space-y-1">
                          <AlertCircle className="w-5 h-5 mx-auto text-slate-300" />
                          <p className="text-xs">No assets matching criteria.</p>
                        </div>
                      ) : (
                        visibleAssets.map((m) => {
                          const meta = getCategoryMeta(m.category);
                          const IconComp = meta.icon;

                          const isDown = m.status === 'BREAKDOWN';
                          const isBuffer = m.status === 'BUFFER';
                          const isScrap = m.status === 'SCRAP';

                          const statusBadgeClass = isDown
                            ? 'bg-rose-50 border-rose-200 text-rose-700 font-bold'
                            : isBuffer
                            ? 'bg-amber-50 border-amber-200 text-amber-700 font-bold'
                            : isScrap
                            ? 'bg-slate-100 border-slate-200 text-slate-600'
                            : 'bg-emerald-50 border-emerald-200 text-emerald-700 font-bold';

                          return (
                            <div
                              key={m.id}
                              className="py-2.5 hover:bg-slate-50/80 px-1.5 rounded-xl transition flex flex-col gap-1.5 group"
                            >
                              {/* Top Row: Tag ID + Model + Status */}
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span
                                    className={`w-5 h-5 rounded-lg flex items-center justify-center border text-[11px] shrink-0 ${meta.color}`}
                                    title={meta.label}
                                  >
                                    <IconComp className="w-3 h-3" />
                                  </span>
                                  <span className="font-mono font-extrabold text-slate-900 text-xs shrink-0">
                                    {m.id}
                                  </span>
                                  <span className="text-xs text-slate-700 font-medium truncate">
                                    {m.name || `${m.brand} ${m.model}`}
                                  </span>
                                </div>

                                <span
                                  className={`text-[9px] px-1.5 py-0.2 rounded border shrink-0 ${statusBadgeClass}`}
                                >
                                  {m.status}
                                </span>
                              </div>

                              {/* Bottom Details Row: Station, Cost & Action Buttons */}
                              <div className="flex items-center justify-between text-[11px] text-slate-400 pl-7">
                                <div className="flex items-center gap-1.5 truncate">
                                  <span className="font-semibold text-slate-600 truncate">{m.stationNo}</span>
                                  <span>•</span>
                                  <span className="font-mono font-medium text-slate-500">₹{(m.cost || 0).toLocaleString('en-IN')}</span>
                                  {m.variety && (
                                    <>
                                      <span>•</span>
                                      <span className="inline-flex items-center text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.2 rounded shrink-0">
                                        {m.variety}
                                      </span>
                                    </>
                                  )}
                                  {m.previousLine && (
                                    <>
                                      <span>•</span>
                                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.2 rounded-md shrink-0" title={`Previously installed at ${m.previousLine} (${m.previousStation || 'Station'})`}>
                                        <ArrowRightLeft className="w-2.5 h-2.5 text-amber-600" />
                                        <span>Held before: {m.previousLine}</span>
                                      </span>
                                    </>
                                  )}
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenAssetModal(m);
                                    }}
                                    className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 font-semibold px-2 py-0.5 rounded-md transition text-[10px] cursor-pointer flex items-center gap-0.5"
                                    title="Inspect specifications and history"
                                  >
                                    <SlidersHorizontal className="w-3 h-3" />
                                    <span>Specs</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenMove(m.id);
                                    }}
                                    className="text-slate-500 hover:text-slate-800 hover:bg-slate-100 font-semibold px-1.5 py-0.5 rounded-md transition text-[10px] cursor-pointer flex items-center"
                                    title="Relocate asset"
                                  >
                                    <span>Move</span>
                                    <ArrowRight className="w-2.5 h-2.5 ml-0.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Expand / Collapse button if department has more than 4 items */}
                  {deptAssets.length > 4 && (
                    <div className="pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => toggleDeptExpand(dept.id)}
                        className="w-full py-1.5 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50/60 rounded-xl transition flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <span>
                          {isExpanded
                            ? 'Show Less'
                            : `View All ${deptAssets.length} Assets (+${deptAssets.length - 4} more)`}
                        </span>
                        <ChevronDown
                          className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW MODE 2: MASTER ASSET GRID */}
      {viewMode === 'ASSETS' && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
            {filteredAssets.map((m) => {
              const meta = getCategoryMeta(m.category);
              const IconComp = meta.icon;
              const dept = getAssetDepartment(m);

              const isDown = m.status === 'BREAKDOWN';
              const isBuffer = m.status === 'BUFFER';
              const isScrap = m.status === 'SCRAP';

              return (
                <div
                  key={m.id}
                  onClick={() => handleOpenAssetModal(m)}
                  className="bg-slate-50/70 hover:bg-white border border-slate-200/80 rounded-2xl p-3.5 text-xs transition space-y-2 cursor-pointer flex flex-col justify-between hover:border-indigo-300 hover:shadow-sm group"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-5 h-5 rounded-lg flex items-center justify-center border text-[11px] ${meta.color}`}>
                          <IconComp className="w-3 h-3" />
                        </span>
                        <span className="font-mono font-black text-slate-900">{m.id}</span>
                      </div>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                          isDown
                            ? 'bg-rose-50 border-rose-200 text-rose-700'
                            : isBuffer
                            ? 'bg-amber-50 border-amber-200 text-amber-700'
                            : isScrap
                            ? 'bg-slate-100 border-slate-200 text-slate-600'
                            : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        }`}
                      >
                        {m.status}
                      </span>
                    </div>

                    <div>
                      <h5 className="font-semibold text-slate-900 text-xs truncate">
                        {m.name || `${m.brand} ${m.model}`}
                      </h5>
                      <span className="text-[10px] text-slate-500 font-medium block truncate mt-0.5">
                        {dept} • <span className="font-bold text-slate-700">{m.stationNo}</span>
                      </span>
                      {m.previousLine && (
                        <div className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/80 truncate">
                          <ArrowRightLeft className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                          <span className="truncate">Held before: {m.previousLine} ({m.previousStation || 'St.'})</span>
                        </div>
                      )}
                    </div>

                    {m.specs && (
                      <p className="text-[10px] text-slate-500 bg-white px-2 py-1 rounded border border-slate-200/60 truncate">
                        {m.specs}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/50 text-[11px]">
                    <span className="font-mono text-slate-700 font-bold">₹{(m.cost || 0).toLocaleString('en-IN')}</span>
                    <span className="text-indigo-600 font-bold group-hover:translate-x-0.5 transition flex items-center gap-0.5">
                      Inspect <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW MODE 3: SEWING WORKSTATIONS MATRIX */}
      {viewMode === 'WORKSTATIONS' && (
        <div className="space-y-4">
          <div className="bg-white text-slate-800 p-4 sm:p-5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-slate-200 shadow-2xs">
            <div>
              <h3 className="font-bold text-sm tracking-tight flex items-center gap-2 text-slate-900">
                <LayoutGrid className="w-4 h-4 text-indigo-600" />
                <span>Sewing Floor Workstation Matrix (Lines 01–04)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Physical workstation bundles (Work Table + Sewing Machine + Operator Chair + Task Light + Fan) across sewing lines.
              </p>
            </div>
            <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-3 py-1 rounded-xl border border-slate-200 self-start sm:self-auto">
              {workstationMatrix.length} Workstations Staged
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workstationMatrix.map((ws, index) => {
              const hasBreakdown =
                ws.table?.status === 'BREAKDOWN' ||
                ws.machine?.status === 'BREAKDOWN' ||
                ws.chair?.status === 'BREAKDOWN' ||
                ws.light?.status === 'BREAKDOWN' ||
                ws.fan?.status === 'BREAKDOWN';

              return (
                <div
                  key={`${ws.line}-${ws.station}-${index}`}
                  className={`bg-white rounded-2xl border p-4 shadow-xs space-y-3 transition ${
                    hasBreakdown
                      ? 'border-rose-300 ring-2 ring-rose-300/40 bg-rose-50/10'
                      : 'border-slate-200/90 hover:border-slate-300'
                  }`}
                >
                  {/* Station Header */}
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900 text-sm">{ws.station}</span>
                        <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                          {ws.line}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {ws.machine?.operator ? `Operator: ${ws.machine.operator}` : 'Workstation Unit'}
                      </span>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        hasBreakdown
                          ? 'bg-rose-100 text-rose-800 border-rose-300 animate-pulse'
                          : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      }`}
                    >
                      {hasBreakdown ? 'Defect Alert' : 'Operational'}
                    </span>
                  </div>

                  {/* Component Slots Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {/* 1. Work Table Slot */}
                    <div
                      onClick={() => ws.table && handleOpenAssetModal(ws.table)}
                      className={`p-2 rounded-xl border transition flex flex-col justify-between ${
                        ws.table
                          ? ws.table.status === 'BREAKDOWN'
                            ? 'bg-rose-50 border-rose-300 cursor-pointer'
                            : 'bg-amber-50/40 border-amber-200/70 hover:bg-amber-50 cursor-pointer'
                          : 'bg-slate-50 border-dashed border-slate-200 opacity-60'
                      }`}
                      title={ws.table ? 'Click to inspect Table details & specifications' : undefined}
                    >
                      <div className="flex items-center justify-between text-[10px] font-bold text-amber-800">
                        <span className="flex items-center gap-1">
                          <LayoutGrid className="w-3 h-3 text-amber-600" />
                          <span>Table</span>
                        </span>
                        <span className="font-mono text-[9px]">{ws.table?.id || 'EMPTY'}</span>
                      </div>
                      <div className="text-[9px] text-slate-500 truncate mt-1">
                        {ws.table ? ws.table.model : 'No Table Staged'}
                      </div>
                    </div>

                    {/* 2. Machine Slot */}
                    <div
                      onClick={() => ws.machine && handleOpenAssetModal(ws.machine)}
                      className={`p-2 rounded-xl border transition flex flex-col justify-between ${
                        ws.machine
                          ? ws.machine.status === 'BREAKDOWN'
                            ? 'bg-rose-50 border-rose-300 cursor-pointer'
                            : 'bg-indigo-50/40 border-indigo-200/70 hover:bg-indigo-50 cursor-pointer'
                          : 'bg-slate-50 border-dashed border-slate-200 opacity-60'
                      }`}
                      title={ws.machine ? 'Click to inspect Machinery details & specifications' : undefined}
                    >
                      <div className="flex items-center justify-between text-[10px] font-bold text-indigo-800">
                        <span className="flex items-center gap-1">
                          <Wrench className="w-3 h-3 text-indigo-600" />
                          <span>Machinery</span>
                        </span>
                        <span className="font-mono text-[9px]">{ws.machine?.id || 'EMPTY'}</span>
                      </div>
                      <div className="text-[9px] text-slate-500 truncate mt-1">
                        {ws.machine ? `${ws.machine.brand} ${ws.machine.type}` : 'No Machine'}
                      </div>
                    </div>

                    {/* 3. Chair Slot */}
                    <div
                      onClick={() => ws.chair && handleOpenAssetModal(ws.chair)}
                      className={`p-2 rounded-xl border transition flex flex-col justify-between ${
                        ws.chair
                          ? ws.chair.status === 'BREAKDOWN'
                            ? 'bg-rose-50 border-rose-300 cursor-pointer'
                            : 'bg-teal-50/40 border-teal-200/70 hover:bg-teal-50 cursor-pointer'
                          : 'bg-slate-50 border-dashed border-slate-200 opacity-60'
                      }`}
                      title={ws.chair ? 'Click to inspect Chair details & specifications' : undefined}
                    >
                      <div className="flex items-center justify-between text-[10px] font-bold text-teal-800">
                        <span className="flex items-center gap-1">
                          <Armchair className="w-3 h-3 text-teal-600" />
                          <span>Seating</span>
                        </span>
                        <span className="font-mono text-[9px]">{ws.chair?.id || 'EMPTY'}</span>
                      </div>
                      <div className="text-[9px] text-slate-500 truncate mt-1">
                        {ws.chair ? ws.chair.brand : 'Operator Stool'}
                      </div>
                    </div>

                    {/* 4. Light Slot */}
                    <div
                      onClick={() => ws.light && handleOpenAssetModal(ws.light)}
                      className={`p-2 rounded-xl border transition flex flex-col justify-between ${
                        ws.light
                          ? ws.light.status === 'BREAKDOWN'
                            ? 'bg-rose-50 border-rose-300 cursor-pointer'
                            : 'bg-yellow-50/40 border-yellow-200/70 hover:bg-yellow-50 cursor-pointer'
                          : 'bg-slate-50 border-dashed border-slate-200 opacity-60'
                      }`}
                      title={ws.light ? 'Click to inspect Light details & specifications' : undefined}
                    >
                      <div className="flex items-center justify-between text-[10px] font-bold text-yellow-800">
                        <span className="flex items-center gap-1">
                          <Lightbulb className="w-3 h-3 text-yellow-600" />
                          <span>Lighting</span>
                        </span>
                        <span className="font-mono text-[9px]">{ws.light?.id || 'EMPTY'}</span>
                      </div>
                      <div className="text-[9px] text-slate-500 truncate mt-1">
                        {ws.light ? ws.light.brand : 'Line Illumination'}
                      </div>
                    </div>
                  </div>

                  {/* Fan Accessory bar */}
                  {ws.fan && (
                    <div
                      onClick={() => handleOpenAssetModal(ws.fan!)}
                      className="bg-cyan-50/50 hover:bg-cyan-100/60 border border-cyan-200/70 p-2 rounded-xl text-xs flex items-center justify-between cursor-pointer transition"
                      title="Click to inspect Fan details & specifications"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Fan className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
                        <span className="font-bold text-cyan-900 text-[11px]">{ws.fan.id}</span>
                        <span className="text-[10px] text-cyan-700 truncate">{ws.fan.specs}</span>
                      </div>
                      <span className="text-[10px] font-semibold text-cyan-800 shrink-0">Vent</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Relocate / Report Modal */}
      <ScanModal
        isOpen={isMoveModalOpen}
        onClose={() => setIsMoveModalOpen(false)}
        preselectedMachineId={targetMoveMachineId}
      />

      {/* Interactive Asset & Category Details Popup Modal */}
      <AssetModal
        isOpen={isAssetModalOpen}
        onClose={() => setIsAssetModalOpen(false)}
        asset={selectedAssetForModal}
        allAssets={machines}
        initialCategory={modalInitialCategory}
      />

      {/* Add New Factory Asset Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-150">
            <div className="bg-slate-950 p-5 text-white flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm tracking-tight">Register Factory Asset</h3>
                  <p className="text-[11px] text-slate-400">
                    Add physical assets to any factory department or plant section
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white transition cursor-pointer p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAssetSubmit} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto" autoComplete="off">
              {/* Category Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Asset Category *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 text-xs font-semibold">
                  {[
                    { id: 'MACHINE', label: 'Machinery', icon: Wrench },
                    { id: 'TABLE', label: 'Work Table', icon: LayoutGrid },
                    { id: 'CHAIR', label: 'Chair / Seat', icon: Armchair },
                    { id: 'VEHICLE', label: 'Vehicle', icon: Truck },
                    { id: 'UTILITY', label: 'Plant Utility', icon: Flame },
                  ].map((cat) => {
                    const CatIcon = cat.icon;
                    const isSelected = newCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => handleCategoryChangeInForm(cat.id as AssetCategory)}
                        className={`p-2 rounded-xl border transition flex items-center gap-1.5 justify-center cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-600 font-bold shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <CatIcon className="w-3.5 h-3.5" />
                        <span>{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Utility Sub-Category Selector */}
              {newCategory === 'UTILITY' && (
                <div className="bg-purple-50/60 p-3 rounded-2xl border border-purple-200 space-y-2">
                  <label className="block text-[11px] font-bold text-purple-900 uppercase tracking-wider">
                    Utility Equipment Type *
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 text-xs font-semibold">
                    {[
                      { id: 'PLANT', label: 'Power & Steam', icon: Flame },
                      { id: 'LIGHT', label: 'Lighting Fixture', icon: Lightbulb },
                      { id: 'FAN', label: 'Ventilation Fan', icon: Fan },
                    ].map((sub) => {
                      const SubIcon = sub.icon;
                      const isSelected = newUtilitySubtype === sub.id;
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => handleUtilitySubtypeChangeInForm(sub.id as any)}
                          className={`p-2 rounded-xl border transition flex items-center gap-1.5 justify-center cursor-pointer ${
                            isSelected
                              ? 'bg-purple-600 text-white border-purple-600 font-bold shadow-xs'
                              : 'bg-white text-slate-700 border-purple-200 hover:bg-purple-100/50'
                          }`}
                        >
                          <SubIcon className="w-3.5 h-3.5" />
                          <span>{sub.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Department Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Target Factory Department *
                </label>
                <select
                  value={newDepartment}
                  onChange={(e) => {
                    const dept = e.target.value as FactoryDepartment;
                    setNewDepartment(dept);
                    setNewLine(dept as FloorLine);
                  }}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-800 font-medium"
                >
                  {FACTORY_DEPARTMENTS.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* ID & Station */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Asset Tag ID *
                  </label>
                  <input
                    type="text"
                    value={newId}
                    onChange={(e) => setNewId(e.target.value)}
                    required
                    placeholder="e.g. MC-OVK-101"
                    className="w-full px-3 py-2 text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Department Station / Bay *
                  </label>
                  <input
                    type="text"
                    value={newStation}
                    onChange={(e) => setNewStation(e.target.value)}
                    required
                    placeholder="e.g. Cutting Bay 01, Station 04"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-800"
                  />
                </div>
              </div>

              {/* Machine Specific Classification or General Brand/Model */}
              {newCategory === 'MACHINE' ? (
                <div className="space-y-3 bg-indigo-50/50 p-3 rounded-2xl border border-indigo-100">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Machine Category *
                    </label>
                    <div className="grid grid-cols-3 gap-1.5 text-xs font-semibold">
                      {MACHINE_CATALOG.map((cat) => {
                        const isSelected = newMachineCat === cat.id;
                        return (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => handleMachineCatChangeInForm(cat.id)}
                            className={`p-2 rounded-xl border text-center transition cursor-pointer flex flex-col items-center justify-center ${
                              isSelected
                                ? 'bg-indigo-600 text-white border-indigo-600 font-bold shadow-xs'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <span className="text-xs">{cat.name}</span>
                            <span className={`text-[10px] ${isSelected ? 'text-indigo-100' : 'text-slate-400'}`}>
                              {cat.brands.join(', ')}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Subtype / Variety *
                      </label>
                      <select
                        value={newMachineType}
                        onChange={(e) => handleMachineSubtypeChangeInForm(e.target.value as MachineType)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-800 font-bold"
                      >
                        {MACHINE_CATALOG.find((c) => c.id === newMachineCat)?.subtypes.map((sub) => (
                          <option key={sub.id} value={sub.id}>
                            {sub.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">
                        Permitted OEM Brand *
                      </label>
                      <select
                        value={newBrand}
                        onChange={(e) => setNewBrand(e.target.value)}
                        className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-800 font-bold"
                      >
                        <option value="" disabled>-- Select OEM Brand --</option>
                        {MACHINE_CATALOG.find((c) => c.id === newMachineCat)?.brands.map((b) => (
                          <option key={b} value={b}>
                            {b}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Model / Descriptor *
                    </label>
                    <input
                      type="text"
                      value={newModel}
                      onChange={(e) => setNewModel(e.target.value)}
                      required
                      placeholder="e.g. AZ-8000G / 4-Thread High-Speed"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-800 font-medium"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Brand / Manufacturer
                    </label>
                    <input
                      type="text"
                      value={newBrand}
                      onChange={(e) => setNewBrand(e.target.value)}
                      placeholder="e.g. Brand Name"
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      Model / Descriptor
                    </label>
                    <input
                      type="text"
                      value={newModel}
                      onChange={(e) => setNewModel(e.target.value)}
                      placeholder="e.g. Model Number / Spec"
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-800"
                    />
                  </div>
                </div>
              )}

              {/* Valuation & Initial Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Cost / Capital (₹ INR)
                  </label>
                  <input
                    type="number"
                    value={newCost}
                    onChange={(e) => setNewCost(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="e.g. 50000"
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-800 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    Operational Status
                  </label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as MachineStatus)}
                    className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-800"
                  >
                    <option value="ACTIVE">ACTIVE (Operational)</option>
                    <option value="BUFFER">BUFFER (Standby)</option>
                    <option value="BREAKDOWN">BREAKDOWN (Defective)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Specifications & Material Attributes
                </label>
                <textarea
                  value={newSpecs}
                  onChange={(e) => setNewSpecs(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-800"
                  placeholder="e.g. Anti-vibration rubber feet, 360° pneumatic gas lift, 18,000 lm daylight"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md shadow-indigo-600/20 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Register Asset</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// End of file

