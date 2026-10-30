'use client';

import { textValue } from '@/lib/textValue';

import { assetScanUrl } from '@/lib/scanUrl';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  PlusCircle,
  Wrench,
  Tag,
  Printer,
  FileText,
  Camera,
  Info,
  CheckCircle,
  AlertOctagon,
  ArrowRight,
  LayoutGrid,
  Armchair,
  Zap,
  Truck,
  ChevronDown,
  ShieldAlert,
  CalendarCheck,
  Boxes,
  QrCode,
  Pencil,
  Search,
  X,
} from 'lucide-react';
import { EditAssetModal } from '@/components/asset/EditAssetModal';
import { QRCodeSVG } from 'qrcode.react';
import { Machine, MachineType, MotorType, FloorLine, MachineStatus, AssetCategory } from '@/types/cmms';
import { subscribeMachines, createMachine } from '@/lib/services/cmmsService';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import {
  matchesUnit,
  isUserAdmin,
  getUserScopedUnit,
  getZonesForUnit,
  getFactoryUnitsFromSettings,
  DynamicFactoryUnit,
} from '@/lib/constants/units';
import { ScanModal } from '@/components/scan/ScanModal';
import { PrintableAssetDocumentModal } from '@/components/print/PrintableAssetDocumentModal';
import {
  ASSET_CATEGORIES,
  ALL_ASSET_SUBTYPES,
  ASSET_SUBTYPE_LOOKUP,
  getAssetCategoryForType,
  AssetSubtypeDef,
} from '@/lib/machineCatalog';
import { PDF_MACHINE_TYPES, PDF_MACHINE_MAKES } from '@/lib/constants/machineCatalog';

export default function MachinesPage() {
  const { showToast } = useToast();
  const { user, role } = useAuth();
  const isAdmin = isUserAdmin(role);
  const [machines, setMachines] = useState<Machine[]>([]);

  // Asset Form State
  const [selectedCategory, setSelectedCategory] = useState<AssetCategory>('MACHINE');

  // User's assigned enterprise company from authenticated session
  const userCompany = useMemo(() => {
    if (user?.company && textValue(user.company).trim()) return textValue(user.company).trim();
    if (typeof window !== 'undefined') {
      const activeTenant = localStorage.getItem('cmms_active_tenant');
      if (activeTenant) return activeTenant.charAt(0).toUpperCase() + activeTenant.slice(1);
      const stored = localStorage.getItem('cmms_company_name');
      if (stored && stored.trim()) return stored.trim();
    }
    const email = textValue((user?.email || '')).toLowerCase();
    if (email.includes('@')) {
      const domain = email.split('@')[1];
      const namePart = domain ? domain.split('.')[0] : '';
      if (namePart && namePart !== 'gmail' && namePart !== 'yahoo' && namePart !== 'outlook') {
        return namePart.charAt(0).toUpperCase() + namePart.slice(1);
      }
    }
    return 'Esstee';
  }, [user]);

  const [mCompany, setMCompany] = useState<string>(() => userCompany);

  // Sync company if user auth session loads asynchronously
  useEffect(() => {
    if (userCompany && !mCompany) {
      setMCompany(userCompany);
    }
  }, [userCompany]);

  const [mId, setMId] = useState('');
  const [mBrand, setMBrand] = useState('');
  const [mType, setMType] = useState<MachineType | ''>('');
  const [mModel, setMModel] = useState('');
  const [mDate, setMDate] = useState('');
  const [mCost, setMCost] = useState<number | ''>('');
  const [mMotor, setMMotor] = useState<MotorType>('SERVO');

  // Configured factory units from Settings page (synced with localStorage)
  const [configuredUnits, setConfiguredUnits] = useState<DynamicFactoryUnit[]>(() => getFactoryUnitsFromSettings());

  useEffect(() => {
    setConfiguredUnits(getFactoryUnitsFromSettings());
    const handleStorage = (e?: StorageEvent | Event) => {
      if (!e || !('key' in e) || (e as StorageEvent).key === 'cmms_settings_factory_units') {
        setConfiguredUnits(getFactoryUnitsFromSettings());
      }
    };
    window.addEventListener('storage', handleStorage as EventListener);
    window.addEventListener('cmms_settings_factory_units_changed', handleStorage as EventListener);
    return () => {
      window.removeEventListener('storage', handleStorage as EventListener);
      window.removeEventListener('cmms_settings_factory_units_changed', handleStorage as EventListener);
    };
  }, []);

  const [mUnit, setMUnit] = useState<string>(() => {
    if (!isUserAdmin(role)) return getUserScopedUnit(user, role);
    return user?.unit && user.unit !== 'All Units' ? user.unit : 'UNIT - 1';
  });
  const effectiveUnit = getUserScopedUnit(user, role, mUnit || null);
  const activeUnitValue = !isAdmin ? effectiveUnit : mUnit;

  // Available zones categorized by the currently selected unit
  const availableZonesForUnit = useMemo(() => {
    return getZonesForUnit(activeUnitValue);
  }, [activeUnitValue]);

  // Zone / Area Dropdown & Custom State
  const [mArea, setMArea] = useState<string>('NETHAJI');
  const [isCustomZone, setIsCustomZone] = useState<boolean>(false);
  const [customZoneInput, setCustomZoneInput] = useState<string>('');

  // Floor Line & Serial Placement
  const [mLine, setMLine] = useState<string>('Line 01');
  const [mSerial, setMSerial] = useState<string>('');

  // Available lines for the current selected zone
  const availableLinesForZone = useMemo(() => {
    const match = availableZonesForUnit.find((z) => z.id === mArea);
    if (match && match.defaultLines.length > 0) {
      return match.defaultLines;
    }
    return ['Line 01', 'Line 02', 'Line 03', 'Line 04', 'Line 05', 'Line 06', 'Line 07', 'Line 08'];
  }, [availableZonesForUnit, mArea]);

  // When unit changes, update zone to first zone in that unit if current zone is not in list
  useEffect(() => {
    if (!isCustomZone) {
      const match = availableZonesForUnit.find((z) => z.id === mArea);
      if (!match && availableZonesForUnit.length > 0) {
        setMArea(availableZonesForUnit[0].id);
        if (availableZonesForUnit[0].defaultLines.length > 0) {
          setMLine(availableZonesForUnit[0].defaultLines[0]);
        }
      }
    }
  }, [availableZonesForUnit, isCustomZone, mArea]);

  useEffect(() => {
    if (!isUserAdmin(role)) {
      setMUnit(getUserScopedUnit(user, role));
    }
  }, [user, role]);

  // QR generated state
  const [isQrGenerated, setIsQrGenerated] = useState(false);

  // Scanner modal state
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [scanModalTargetId, setScanModalTargetId] = useState<string>('');

  // Print document modal state
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printModalMachine, setPrintModalMachine] = useState<Machine | null>(null);
  const [printModalMode, setPrintModalMode] = useState<'TAG' | 'DOCUMENT' | 'BATCH'>('TAG');

  // Custom brand & custom subtype state
  const [customBrands, setCustomBrands] = useState<string[]>([]);
  const [customSubtypes, setCustomSubtypes] = useState<AssetSubtypeDef[]>([]);
  const [isCustomBrand, setIsCustomBrand] = useState(false);
  const [customBrandInput, setCustomBrandInput] = useState('');
  const [isCustomType, setIsCustomType] = useState(false);
  const [customTypeName, setCustomTypeName] = useState('');
  const [customSpecs, setCustomSpecs] = useState('');

  // Edit Existing Asset State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAssetPickerOpen, setIsAssetPickerOpen] = useState(false);
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);
  const [pickerSearchQuery, setPickerSearchQuery] = useState('');

  const [origin, setOrigin] = useState('https://esstee.factory');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
      try {
        const savedBrands = localStorage.getItem('cmms_custom_brands');
        if (savedBrands) setCustomBrands(JSON.parse(savedBrands));
        const savedSubtypes = localStorage.getItem('cmms_custom_subtypes');
        if (savedSubtypes) setCustomSubtypes(JSON.parse(savedSubtypes));
      } catch (e) {
        console.error('Failed to load custom catalog from localStorage', e);
      }
    }
  }, []);

  useEffect(() => {
    const unsub = subscribeMachines((data) => {
      setMachines(data);
    });
    return () => unsub();
  }, []);

  // Compute machine/asset age dynamically
  const calculatedAge = useMemo(() => {
    if (!mDate) return '—';
    const pDate = new Date(mDate);
    if (isNaN(pDate.getTime())) return '—';
    const now = new Date();
    const diff = (now.getTime() - pDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    return diff > 0 ? `${diff.toFixed(1)} Years` : 'New Asset';
  }, [mDate]);

  // Current category definition
  const currentCategoryDef = useMemo(() => {
    return ASSET_CATEGORIES.find((c) => c.id === selectedCategory) || ASSET_CATEGORIES[0];
  }, [selectedCategory]);

  // Subtypes for the current category including any user-added custom varieties
  const allSubtypesForCategory = useMemo(() => {
    const std = currentCategoryDef.subtypes;
    const customs = customSubtypes.filter((s) => s.category === selectedCategory);
    return [...std, ...customs];
  }, [currentCategoryDef, customSubtypes, selectedCategory]);

  // Group subtypes for FURNITURE (Work Tables vs Chairs vs Custom)
  const furnitureGroups = useMemo(() => {
    if (selectedCategory !== 'FURNITURE') return null;
    const tables = allSubtypesForCategory.filter(
      (s) => s.id.startsWith('TABLE_') || s.idPrefix.startsWith('TBL-')
    );
    const chairs = allSubtypesForCategory.filter(
      (s) => s.id.startsWith('CHAIR_') || s.idPrefix.startsWith('CHR-')
    );
    const others = allSubtypesForCategory.filter(
      (s) =>
        !s.id.startsWith('TABLE_') &&
        !s.idPrefix.startsWith('TBL-') &&
        !s.id.startsWith('CHAIR_') &&
        !s.idPrefix.startsWith('CHR-')
    );
    return { tables, chairs, others };
  }, [selectedCategory, allSubtypesForCategory]);

  // Available brands for the current subtype or category (combines OEM catalog + custom brands)
  const availableBrands: string[] = useMemo(() => {
    if (selectedCategory === 'MACHINE') {
      return Array.from(new Set([...PDF_MACHINE_MAKES, ...customBrands])).filter(Boolean);
    }
    const subDef =
      (mType && ASSET_SUBTYPE_LOOKUP[mType]) || customSubtypes.find((s) => s.id === mType);
    let brands: string[] = [];
    if (subDef && subDef.brands && subDef.brands.length > 0) {
      brands = subDef.brands;
    } else {
      brands = currentCategoryDef.subtypes.flatMap((s) => s.brands);
    }
    return Array.from(new Set([...brands, ...customBrands])).filter(Boolean);
  }, [mType, currentCategoryDef, customBrands, customSubtypes, selectedCategory]);

  // Handler for category switch
  const handleCategorySelect = (cat: AssetCategory) => {
    setSelectedCategory(cat);
    setIsCustomType(false);
    setIsCustomBrand(false);
    setMType('');
  };

  // Handler for subtype change
  const handleSubtypeChange = (type: MachineType | '__CUSTOM_TYPE__') => {
    if (type === '__CUSTOM_TYPE__') {
      setIsCustomType(true);
      setCustomTypeName('');
      setCustomSpecs('');
      return;
    }

    setIsCustomType(false);
    setMType(type);
  };

  // Clear / Reset all inputs
  const handleResetForm = () => {
    setMCompany(userCompany);
    setMId('');
    setMBrand('');
    setMType('');
    setMModel('');
    setMDate('');
    setMCost('');
    setMUnit(!isAdmin ? effectiveUnit : 'UNIT - 1');
    setMArea('NETHAJI');
    setIsCustomZone(false);
    setCustomZoneInput('');
    setMLine('Line 01');
    setMSerial('');
    setIsCustomBrand(false);
    setCustomBrandInput('');
    setIsCustomType(false);
    setCustomTypeName('');
    setCustomSpecs('');
    setIsQrGenerated(false);
  };

  // Handler for form submit & registration
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = mId.trim();
    if (!cleanId) {
      showToast('Please enter an Asset ID', 'warning');
      return;
    }

    if (!mCompany.trim()) {
      showToast('Please enter a Company / Facility Name', 'warning');
      return;
    }

    const finalBrand =
      isCustomBrand && customBrandInput.trim() ? customBrandInput.trim() : mBrand.trim();
    if (!finalBrand) {
      showToast('Please select or specify a Brand', 'warning');
      return;
    }

    if (!mDate) {
      showToast('Please enter an Installation Date', 'warning');
      return;
    }

    const cleanSerial = mSerial.trim();
    if (!cleanSerial) {
      showToast('Please enter a Serial Number', 'warning');
      return;
    }

    let finalTypeName =
      (mType && ASSET_SUBTYPE_LOOKUP[mType]?.name) ||
      customSubtypes.find((s) => s.id === mType)?.name ||
      mType ||
      'General Asset';
    let finalSpecs =
      (mType && ASSET_SUBTYPE_LOOKUP[mType]?.specs) ||
      customSubtypes.find((s) => s.id === mType)?.specs ||
      '';

    // Persist newly added custom brand to localStorage
    if (isCustomBrand && customBrandInput.trim()) {
      const trimmed = customBrandInput.trim();
      if (!customBrands.includes(trimmed)) {
        const nextBrands = [...customBrands, trimmed];
        setCustomBrands(nextBrands);
        if (typeof window !== 'undefined') {
          localStorage.setItem('cmms_custom_brands', JSON.stringify(nextBrands));
        }
      }
    }

    // Persist newly added custom subtype to localStorage
    if (isCustomType && customTypeName.trim()) {
      finalTypeName = customTypeName.trim();
      finalSpecs = customSpecs.trim() || 'Custom factory specification';
      const customId = `CUSTOM_${selectedCategory}_${Date.now()}`;
      const prefix =
        selectedCategory === 'FURNITURE'
          ? 'FUR-CST-'
          : selectedCategory === 'CHAIR'
          ? 'CHR-CST-'
          : selectedCategory === 'TABLE'
          ? 'TBL-CST-'
          : selectedCategory === 'UTILITY'
          ? 'UTL-CST-'
          : selectedCategory === 'VEHICLE'
          ? 'VHC-CST-'
          : 'MC-CST-';

      const newDef: AssetSubtypeDef = {
        id: customId as any,
        name: finalTypeName,
        category: selectedCategory,
        brands: [finalBrand],
        defaultBrand: finalBrand,
        defaultModel: mModel,
        defaultCost: typeof mCost === 'number' ? mCost : Number(mCost) || 0,
        idPrefix: prefix,
        specs: finalSpecs,
      };

      const nextSubtypes = [...customSubtypes, newDef];
      setCustomSubtypes(nextSubtypes);
      if (typeof window !== 'undefined') {
        localStorage.setItem('cmms_custom_subtypes', JSON.stringify(nextSubtypes));
      }
    }

    const finalUnit = !isAdmin ? effectiveUnit : (mUnit.trim() || 'UNIT - 1');
    const finalZone = isCustomZone ? customZoneInput.trim() : mArea;
    const finalLine = mLine.trim() || 'Line 01';
    const userDept = 'Factory Floor' as any;

    const newAsset: Machine = {
      id: cleanId,
      name: `${finalBrand} ${finalTypeName}${mModel.trim() ? ` (${mModel.trim()})` : ''}`,
      company: mCompany.trim() || userCompany,
      brand: finalBrand,
      model: mModel.trim() || 'Standard Model',
      category: selectedCategory,
      machineClass:
        selectedCategory === 'MACHINE'
          ? mType && mType.startsWith('OVERLOCK')
            ? 'OVERLOCK'
            : mType && mType.startsWith('FLATLOCK')
            ? 'FLATLOCK'
            : 'SINGLE_NEEDLE'
          : undefined,
      type: (mType || 'OVERLOCK_4_THREAD') as MachineType,
      typeName: finalTypeName,
      motorType: mMotor,
      purchaseDate: mDate,
      cost: typeof mCost === 'number' ? mCost : Number(mCost) || 0,
      status: 'ACTIVE',
      unit: finalUnit,
      area: finalZone,
      zone: finalZone,
      currentLine: finalLine,
      department: userDept,
      serialNo: cleanSerial,
      serialNumber: cleanSerial,
      mcNo: cleanSerial,
      stationNo: cleanSerial,
      totalDowntimeMinutes: 0,
      ageYears: parseFloat(calculatedAge) || 0,
      specs: finalSpecs,
    };

    try {
      await createMachine(newAsset);
      setIsQrGenerated(true);
      showToast(
        `Asset ${cleanId} registered & QR sticker generated!`,
        'success'
      );
    } catch (err) {
      showToast('Failed to register asset', 'error');
      console.error(err);
    }
  };


  // Construct current active asset object for document preview & printing
  const currentMachineObj: Machine = useMemo(() => {
    const existing = machines.find((m) => m.id === mId);
    const activeBrand =
      isCustomBrand && customBrandInput.trim() ? customBrandInput.trim() : mBrand;
    const typeName =
      isCustomType && customTypeName.trim()
        ? customTypeName.trim()
        : (mType && ASSET_SUBTYPE_LOOKUP[mType]?.name) ||
          customSubtypes.find((s) => s.id === mType)?.name ||
          mType ||
          'Asset';
    const specs =
      isCustomType && customSpecs.trim()
        ? customSpecs.trim()
        : (mType && ASSET_SUBTYPE_LOOKUP[mType]?.specs) ||
          customSubtypes.find((s) => s.id === mType)?.specs ||
          '';

    const userDept = 'Factory Floor' as any;

    return {
      id: mId || 'ASSET-NEW',
      name: `${activeBrand} ${mModel}`.trim() || 'New Asset',
      company: mCompany.trim(),
      brand: activeBrand || 'Unassigned Brand',
      model: mModel || 'Standard',
      type: (mType || 'OVERLOCK_4_THREAD') as MachineType,
      typeName: typeName,
      cost: typeof mCost === 'number' ? mCost : Number(mCost) || 0,
      motorType: mMotor,
      unit: mUnit.trim() || 'Unassigned Unit',
      area: (isCustomZone ? customZoneInput.trim() : mArea) || 'Unassigned Area',
      zone: (isCustomZone ? customZoneInput.trim() : mArea) || '',
      currentLine: (mLine.trim() || existing?.currentLine || '') as FloorLine,
      serialNo: mSerial.trim() || 'SN-PENDING',
      serialNumber: mSerial.trim() || 'SN-PENDING',
      mcNo: mSerial.trim() || 'SN-PENDING',
      stationNo: mSerial.trim() || 'Unassigned Station',
      purchaseDate: mDate,
      status: existing?.status || 'ACTIVE',
      category: selectedCategory,
      department: userDept,
      operator: existing?.operator || 'Plant Operator',
      previousLine: existing?.previousLine,
      previousStation: existing?.previousStation,
      lastMovedAt: existing?.lastMovedAt,
      lastMovedReason: existing?.lastMovedReason,
      lastMovedBy: existing?.lastMovedBy,
      totalDowntimeMinutes: existing?.totalDowntimeMinutes || 0,
      ageYears: existing?.ageYears || 0,
      specs: specs,
    };
  }, [
    mId,
    mCompany,
    mBrand,
    mModel,
    mType,
    mCost,
    mMotor,
    mUnit,
    mArea,
    mLine,
    isCustomZone,
    customZoneInput,
    mSerial,
    mDate,
    machines,
    selectedCategory,
    isCustomBrand,
    customBrandInput,
    isCustomType,
    customTypeName,
    customSpecs,
    customSubtypes,
  ]);

  const handlePrint = () => {
    window.print();
  };

  // Encoded QR payload feeding all asset specifications into the QR code
  const qrData = useMemo(() => {
    const base = `${assetScanUrl(origin, mId || 'PENDING')}`;
    const activeBrand =
      isCustomBrand && customBrandInput.trim() ? customBrandInput.trim() : mBrand;
    const activeTypeName =
      isCustomType && customTypeName.trim()
        ? customTypeName.trim()
        : (mType && ASSET_SUBTYPE_LOOKUP[mType]?.name) ||
          customSubtypes.find((s) => s.id === mType)?.name ||
          mType ||
          '';

    const params = new URLSearchParams({
      id: mId || '',
      company: mCompany.trim() || '',
      brand: activeBrand || '',
      model: mModel || '',
      type: mType || '',
      typeName: activeTypeName,
      category: selectedCategory || '',
      unit: mUnit.trim() || '',
      area: mArea.trim() || '',
      serialNo: mSerial.trim() || '',
      station: mSerial.trim() || '',
      date: mDate || '',
      cost: mCost ? String(mCost) : '',
    });
    return `${base}?${params.toString()}`;
  }, [
    origin,
    mId,
    mCompany,
    mBrand,
    mModel,
    mType,
    selectedCategory,
    mUnit,
    mArea,
    mSerial,
    mDate,
    mCost,
    isCustomBrand,
    customBrandInput,
    isCustomType,
    customTypeName,
    customSubtypes,
  ]);


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
            Asset Registry &amp; QR Module Restricted
          </h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            Machine asset registration, relocation, and QR tag generation are reserved for <strong>Plant Administrators</strong>. Technicians manage daily maintenance tickets, preventative schedules, and spare parts indents.
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
      {/* Header Info */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <QrCode className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Asset Registration &amp; QR Tagging
              </h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                CR80 Standard
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Register new plant machinery, furniture, electrical assets and generate printable QR code tags.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsAssetPickerOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white transition cursor-pointer shadow-xs"
          >
            <Pencil className="w-3.5 h-3.5" />
            <span>Edit Existing Asset</span>
          </button>
          <Link
            href="/dashboard/asset-types"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition cursor-pointer"
          >
            <Boxes className="w-3.5 h-3.5 text-indigo-600" />
            <span>View All Registered Assets</span>
          </Link>
        </div>
      </div>

      {/* Main Grid: Form (Left) & QR Tag Preview (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 7 Columns: Asset Input Form */}
        <div className="lg:col-span-7 bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-5 no-print">
          <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <Tag className="w-4 h-4 text-indigo-600" />
            <span>Asset Specifications</span>
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
            {/* Company / Enterprise Name & Category */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-600">
                    Company / Organization Name *
                  </label>
                  <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                    Assigned from Login
                  </span>
                </div>
                <input
                  type="text"
                  required
                  value={mCompany}
                  onChange={(e) => setMCompany(e.target.value)}
                  placeholder="e.g. Esstee Industries"
                  autoComplete="off"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none text-slate-800 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Category *
                </label>
                <div className="relative">
                  <select
                    value={selectedCategory}
                    onChange={(e) => handleCategorySelect(e.target.value as AssetCategory)}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none text-slate-900 font-bold appearance-none cursor-pointer transition shadow-xs pr-10"
                  >
                    {ASSET_CATEGORIES.map((cat) => (
                      <option key={cat.id} value={cat.id} className="text-slate-800 py-1 font-bold">
                        {cat.name} ({cat.singular})
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-500">
                    <ChevronDown className="w-4 h-4" />
                  </div>
                </div>
              </div>
            </div>

            {/* Subtype and Brand Selection with Custom Entry Support */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Asset Variety / Subtype */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-600">
                    Asset Variety *
                  </label>
                  {!isCustomType ? (
                    <button
                      type="button"
                      onClick={() => handleSubtypeChange('__CUSTOM_TYPE__')}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 cursor-pointer"
                    >
                      <span>+ New Variety</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomType(false);
                        setMType('');
                      }}
                      className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                    >
                      Use Standard List
                    </button>
                  )}
                </div>

                {!isCustomType ? (
                  <select
                    required
                    value={mType}
                    onChange={(e) => handleSubtypeChange(e.target.value as MachineType)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none text-slate-800 font-bold"
                  >
                    <option value="" disabled>-- Select Asset Variety --</option>
                    {selectedCategory === 'MACHINE' ? (
                      <optgroup label="Plant Sheet Machine Types (from PDF)">
                        {PDF_MACHINE_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </optgroup>
                    ) : selectedCategory === 'FURNITURE' && furnitureGroups ? (
                      <>
                        <optgroup label="Work Tables & Workstations">
                          {furnitureGroups.tables.map((sub) => (
                            <option key={sub.id} value={sub.id}>
                              {sub.name}
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Chairs & Floor Seating">
                          {furnitureGroups.chairs.map((sub) => (
                            <option key={sub.id} value={sub.id}>
                              {sub.name}
                            </option>
                          ))}
                        </optgroup>
                      </>
                    ) : (
                      <optgroup label={`Standard ${currentCategoryDef.singular} Models`}>
                        {allSubtypesForCategory.map((sub) => (
                          <option key={sub.id} value={sub.id}>
                            {sub.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    <option value="__CUSTOM_TYPE__" className="text-indigo-600 font-bold">
                      Add New / Custom {currentCategoryDef.singular} Type...
                    </option>
                  </select>
                ) : (
                  <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-indigo-900 mb-0.5">
                        New Variety / Model Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={customTypeName}
                        onChange={(e) => setCustomTypeName(e.target.value)}
                        placeholder="e.g. Model Name"
                        autoComplete="off"
                        className="w-full px-3 py-1.5 text-xs bg-white border border-indigo-300 rounded-lg text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-indigo-800 mb-0.5">
                        Technical Specs
                      </label>
                      <input
                        type="text"
                        value={customSpecs}
                        onChange={(e) => setCustomSpecs(e.target.value)}
                        placeholder="e.g. Technical specifications"
                        autoComplete="off"
                        className="w-full px-3 py-1.5 text-[11px] bg-white border border-indigo-200 rounded-lg text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Brand / Manufacturer OEM */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-600">
                    Brand *
                  </label>
                  {!isCustomBrand ? (
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomBrand(true);
                        setCustomBrandInput('');
                      }}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 cursor-pointer"
                    >
                      <span>+ New Brand</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomBrand(false);
                        setMBrand('');
                      }}
                      className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                    >
                      Use Brand List
                    </button>
                  )}
                </div>

                {!isCustomBrand ? (
                  <select
                    required
                    value={mBrand}
                    onChange={(e) => {
                      if (e.target.value === '__CUSTOM_BRAND__') {
                        setIsCustomBrand(true);
                        setCustomBrandInput('');
                      } else {
                        setMBrand(e.target.value);
                      }
                    }}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none text-slate-800 font-bold"
                  >
                    <option value="" disabled>-- Select Brand --</option>
                    <optgroup label="Available Brands">
                      {availableBrands.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </optgroup>
                    <option value="__CUSTOM_BRAND__" className="text-indigo-600 font-bold">
                      + Add Custom Brand...
                    </option>
                  </select>
                ) : (
                  <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-indigo-900 mb-0.5">
                        Brand Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={customBrandInput}
                        onChange={(e) => {
                          setCustomBrandInput(e.target.value);
                          setMBrand(e.target.value);
                        }}
                        placeholder="e.g. Brand Name"
                        autoComplete="off"
                        className="w-full px-3 py-1.5 text-xs bg-white border border-indigo-300 rounded-lg text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                        autoFocus
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Asset ID & Model Number */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Asset ID *
                </label>
                <input
                  type="text"
                  required
                  value={mId}
                  onChange={(e) => setMId(e.target.value)}
                  placeholder="e.g. MC-OVK-4TH-101"
                  autoComplete="off"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none font-mono font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Model / Specification *
                </label>
                <input
                  type="text"
                  required
                  value={mModel}
                  onChange={(e) => setMModel(e.target.value)}
                  placeholder="e.g. AZ-8000G"
                  autoComplete="off"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none font-medium text-slate-900"
                />
              </div>
            </div>

            {/* Date, Age, and Valuation */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Installation Date *
                </label>
                <input
                  type="date"
                  required
                  value={mDate}
                  onChange={(e) => setMDate(e.target.value)}
                  autoComplete="off"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none text-slate-800 font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Asset Age
                </label>
                <input
                  type="text"
                  readOnly
                  value={calculatedAge}
                  className="w-full px-3 py-2 text-sm bg-slate-100 border border-slate-200 text-slate-700 rounded-xl font-bold outline-none cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Cost (₹)
                </label>
                <input
                  type="number"
                  value={mCost}
                  onChange={(e) => setMCost(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                  placeholder="e.g. 65000"
                  autoComplete="off"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white outline-none font-mono font-medium text-slate-900"
                />
              </div>
            </div>

            {/* ─── Plant Unit, Categorized Zone & Floor Line Placement ─── */}
            <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <LayoutGrid className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Factory Location &amp; Floor Placement</span>
                </span>
                <span className="text-[10px] text-slate-500 font-medium">
                  Unit ➔ Categorized Zone ➔ Line Placement
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* 1. Plant Unit Dropdown */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Plant Unit * {!isAdmin && <span className="text-[10px] text-indigo-600 font-bold">(Locked to your assigned unit)</span>}
                  </label>
                  <select
                    value={!isAdmin ? effectiveUnit : mUnit}
                    disabled={!isAdmin}
                    onChange={(e) => {
                      const nextUnit = e.target.value;
                      setMUnit(nextUnit);
                      const zones = getZonesForUnit(nextUnit);
                      if (zones.length > 0) {
                        setMArea(zones[0].id);
                        setIsCustomZone(false);
                        if (zones[0].defaultLines.length > 0) {
                          setMLine(zones[0].defaultLines[0]);
                        }
                      }
                    }}
                    className={`w-full px-3 py-2 text-sm border rounded-xl outline-none font-bold text-slate-800 ${
                      !isAdmin
                        ? 'bg-slate-100 border-slate-200 cursor-not-allowed'
                        : 'bg-white border-slate-300 focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs'
                    }`}
                  >
                    {configuredUnits.map((u) => (
                      <option key={u.code} value={u.code}>
                        {u.code}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Categorized Zone / Area Dropdown */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Zone / Area *
                    </label>
                    {!isCustomZone ? (
                      <button
                        type="button"
                        onClick={() => {
                          setIsCustomZone(true);
                          setCustomZoneInput('');
                        }}
                        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                      >
                        + Custom Zone
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setIsCustomZone(false);
                          if (availableZonesForUnit.length > 0) {
                            setMArea(availableZonesForUnit[0].id);
                          }
                        }}
                        className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                      >
                        Use Zone List
                      </button>
                    )}
                  </div>

                  {!isCustomZone ? (
                    <select
                      required
                      value={mArea}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '__CUSTOM_ZONE__') {
                          setIsCustomZone(true);
                          setCustomZoneInput('');
                        } else {
                          setMArea(val);
                          const matched = availableZonesForUnit.find((z) => z.id === val);
                          if (matched && matched.defaultLines.length > 0) {
                            setMLine(matched.defaultLines[0]);
                          }
                        }
                      }}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800 font-bold cursor-pointer shadow-2xs"
                    >
                      <optgroup label={`Available Zones in ${!isAdmin ? effectiveUnit : mUnit}`}>
                        {availableZonesForUnit.map((z) => (
                          <option key={z.id} value={z.id}>
                            {z.name}
                          </option>
                        ))}
                      </optgroup>
                      <option value="__CUSTOM_ZONE__" className="text-indigo-600 font-bold">
                        + Enter Custom Zone...
                      </option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      required
                      value={customZoneInput}
                      onChange={(e) => {
                        setCustomZoneInput(e.target.value);
                        setMArea(e.target.value);
                      }}
                      placeholder="e.g. NETHAJI, PEACOCK, Sampling Section"
                      autoFocus
                      className="w-full px-3 py-2 text-sm bg-white border border-indigo-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800 font-bold"
                    />
                  )}
                </div>
              </div>

              {/* 2. Serial Number (Required) */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Serial Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={mSerial}
                    onChange={(e) => setMSerial(e.target.value)}
                    placeholder="e.g. SN-4DORD15615"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800 font-medium font-mono"
                  />
                </div>

              {/* 3. Floor Line Input (Manual Entry + Available Line Chips) */}
              <div className="pt-1">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Floor Line *
                  </label>
                  <span className="text-[10px] text-slate-400">Mention line manually or click chip below</span>
                </div>

                <input
                  type="text"
                  required
                  list="floor-lines-suggestions"
                  value={mLine}
                  onChange={(e) => setMLine(e.target.value)}
                  placeholder="e.g. Line 01, Line 04, Cutting Bay"
                  autoComplete="off"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 font-bold"
                />
                <datalist id="floor-lines-suggestions">
                  {availableLinesForZone.map((l) => (
                    <option key={l} value={l} />
                  ))}
                </datalist>

                {/* Quick-Pick Line Chips */}
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-[10px] font-semibold text-slate-400">Available in {mArea}:</span>
                  {availableLinesForZone.map((l) => {
                    const isSelected = mLine === l;
                    return (
                      <button
                        key={l}
                        type="button"
                        onClick={() => setMLine(l)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        {l}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="pt-3 flex items-center justify-between border-t border-slate-100">
              <button
                type="button"
                onClick={handleResetForm}
                className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Clear Form
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-xs rounded-xl shadow-md shadow-indigo-600/20 transition flex items-center gap-2 cursor-pointer"
              >
                <QrCode className="w-4 h-4" />
                <span>Generate</span>
              </button>
            </div>
          </form>
        </div>

        {/* Right 5 Columns: Printable QR Sticker Preview */}
        <div className="lg:col-span-5 space-y-4 print:w-full print:max-w-none print:m-0">
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4 print:border-none print:shadow-none print:p-0">
            <div className="flex items-center justify-between no-print">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <QrCode className="w-4 h-4 text-indigo-600" />
                <span>Asset ID Card Preview</span>
              </h3>
              {isQrGenerated && (
                <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold px-2 py-0.5 rounded uppercase">
                  Generated (CR80)
                </span>
              )}
            </div>

            {isQrGenerated ? (
              <>
                {/* Printable ID Card: QR on Left, company/unit/id and unique id on Right */}
                <div
                  id="printable-qr-tag"
                  className="bg-white border-2 border-slate-900 rounded-2xl p-4 sm:p-5 shadow-sm flex flex-row items-center justify-start gap-4 mx-auto w-full max-w-[420px] aspect-[85.6/54] relative overflow-hidden print:w-[85.6mm] print:h-[54mm] print:max-w-[85.6mm] print:max-h-[54mm] print:p-[3.5mm] print:gap-[3.5mm] print:border-[1.5pt] print:border-black print:rounded-[3mm] print:shadow-none print:m-auto"
                >
                  {/* Left: High-Resolution QR Code Box */}
                  <div className="shrink-0 p-2 bg-white border-2 border-slate-900 rounded-xl flex items-center justify-center shadow-xs print:border print:border-black print:p-[1.5mm] print:rounded-[2mm]">
                    <QRCodeSVG
                      value={qrData}
                      size={120}
                      level="H"
                      bgColor="#ffffff"
                      fgColor="#000000"
                      className="w-20 h-20 sm:w-24 sm:h-24 print:w-[32mm] print:h-[32mm]"
                    />
                  </div>

                  {/* Right: ID Card Metadata (Only first two lines) */}
                  <div className="flex flex-col justify-center text-left min-w-0 flex-1 space-y-2.5 sm:space-y-3 print:space-y-[2mm]">
                    {/* Line 1: company / unit / id */}
                    <div>
                      <div className="text-[9px] sm:text-[10px] print:text-[6.5pt] font-extrabold uppercase tracking-widest text-slate-400 mb-0.5">
                        Company / Unit / ID
                      </div>
                      <div className="text-xs sm:text-sm print:text-[9pt] font-black uppercase tracking-wider text-slate-800 truncate flex items-center gap-1">
                        <span>{mCompany.trim() || userCompany || 'Esstee'}</span>
                        <span className="text-slate-400">/</span>
                        <span>{mUnit.trim() || 'Unit'}</span>
                        <span className="text-slate-400">/</span>
                        <span className="text-indigo-700 print:text-black font-mono">{mId.trim() || 'ASSET-TAG'}</span>
                      </div>
                    </div>

                    {/* Line 2: unique id */}
                    <div className="pt-2 border-t border-slate-200 print:border-black print:pt-[1.5mm]">
                      <div className="text-[9px] sm:text-[10px] print:text-[6.5pt] font-extrabold uppercase tracking-widest text-slate-400 mb-0.5">
                        Unique ID
                      </div>
                      <div className="text-lg sm:text-2xl print:text-[14pt] font-black text-slate-950 font-mono tracking-wide truncate leading-tight">
                        {mId.trim() || 'ASSET-TAG'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Tag Action Buttons */}
                <div className="flex flex-col sm:flex-row items-center gap-2 pt-1 no-print">
                  <button
                    type="button"
                    onClick={handlePrint}
                    className="w-full sm:flex-1 py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print ID Card</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPrintModalMachine(currentMachineObj);
                      setPrintModalMode('TAG');
                      setIsPrintModalOpen(true);
                    }}
                    className="w-full sm:flex-1 py-2.5 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Print Options</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setScanModalTargetId(mId);
                      setIsScanModalOpen(true);
                    }}
                    className="w-full sm:w-auto py-2.5 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Scan</span>
                  </button>
                </div>
              </>
            ) : (
              <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center text-center mx-auto max-w-[280px] min-h-[300px]">
                <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 text-slate-400 flex items-center justify-center mb-3 shadow-2xs">
                  <QrCode className="w-6 h-6 text-slate-400" />
                </div>
                <p className="text-xs font-bold text-slate-700">QR Not Generated</p>
                <p className="text-[11px] text-slate-400 mt-1 max-w-[190px]">
                  Fill in asset specifications and click <strong>Generate</strong> to create the QR tag.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reusable Scan Modal */}
      <ScanModal
        isOpen={isScanModalOpen}
        onClose={() => setIsScanModalOpen(false)}
        preselectedMachineId={scanModalTargetId || mId}
      />

      {/* Printable Asset Document Modal */}
      {printModalMachine && (
        <PrintableAssetDocumentModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          asset={printModalMachine}
          allAssets={machines}
          initialMode={printModalMode}
        />
      )}

      {/* Asset Search & Select Modal for Editing */}
      {isAssetPickerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                  <Pencil className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Select Asset to Edit</h3>
                  <p className="text-xs text-slate-500">Search plant machinery or assets to update details</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAssetPickerOpen(false);
                  setPickerSearchQuery('');
                }}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-200/60 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b border-slate-100 bg-white shrink-0">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  autoFocus
                  value={pickerSearchQuery}
                  onChange={(e) => setPickerSearchQuery(e.target.value)}
                  placeholder="Search by M/C NO, brand (Juki, Jack), type (SNLS, O/L), or location..."
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 divide-y divide-slate-100">
              {machines
                .filter((m) => {
                  if (!isAdmin && !matchesUnit(m.unit, effectiveUnit)) return false;
                  if (!pickerSearchQuery.trim()) return true;
                  const q = pickerSearchQuery.toLowerCase();
                  return (
                    textValue(m.id)?.toLowerCase().includes(q) ||
                    textValue(m.name)?.toLowerCase().includes(q) ||
                    textValue(m.serialNo)?.toLowerCase().includes(q) ||
                    textValue(m.serialNumber)?.toLowerCase().includes(q) ||
                    textValue(m.brand)?.toLowerCase().includes(q) ||
                    textValue(m.model)?.toLowerCase().includes(q) ||
                    textValue(m.type)?.toLowerCase().includes(q) ||
                    textValue(m.typeName)?.toLowerCase().includes(q) ||
                    textValue(m.area)?.toLowerCase().includes(q) ||
                    textValue(m.unit)?.toLowerCase().includes(q)
                  );
                })
                .slice(0, 50)
                .map((m) => (
                  <div
                    key={m.id}
                    className="py-2.5 px-3 hover:bg-indigo-50/50 rounded-xl transition flex items-center justify-between gap-3 group"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-slate-900 group-hover:text-indigo-600 transition">
                          {m.id}
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                          {m.typeName || m.type}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-400">
                          {m.brand} {m.model}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                        <span>{m.area || 'NETHAJI'}</span>
                        <span>•</span>
                        <span>{m.unit || 'UNIT - 1'}</span>
                        <span>•</span>
                        <span className="font-mono text-slate-400">Year: {(m as any).year || m.purchaseDate?.slice(0, 4) || '—'}</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingMachine(m);
                        setIsAssetPickerOpen(false);
                        setIsEditModalOpen(true);
                      }}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 shadow-xs cursor-pointer shrink-0"
                    >
                      <Pencil className="w-3 h-3" />
                      <span>Edit</span>
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Edit Asset Information Modal */}
      <EditAssetModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingMachine(null);
        }}
        asset={editingMachine}
        onSave={(updated) => {
          setMachines((prev) =>
            prev.map((m) => (m.id === updated.id || m.id === editingMachine?.id ? updated : m))
          );
        }}
      />
    </div>
  );
}
