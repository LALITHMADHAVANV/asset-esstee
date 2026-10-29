'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Pencil,
  Tag,
  Building2,
  Calendar,
  IndianRupee,
  MapPin,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  Save,
  RotateCcw,
} from 'lucide-react';
import { Machine, MachineStatus, MotorType, FloorLine, AssetCategory } from '@/types/cmms';
import { updateMachine } from '@/lib/services/cmmsService';
import { useToast } from '@/context/ToastContext';

interface EditAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: Machine | null;
  onSave?: (updated: Machine) => void;
}

const COMMON_MACHINE_TYPES = [
  'SNLS',
  'O/L',
  'OVERLOCK',
  'FB.F/L',
  'FLATLOCK',
  'H.F/L',
  'PULLER. F/L',
  'S/N EDGE CUTTER',
  'SMALL FUSHING',
  'BIG FUSHING',
  'LFC O/L',
  'MINI TEMPLATE',
  'RIP OVER LOCK',
  'PIC',
  'BUTTON',
  'BUTTON HOLE',
  'BUTTON ATTACH',
  'BUTTON(AUTOMATIC)',
  'BARTACK',
  'KAJA',
  'MULTI NEEDLE',
  'DOUBLE NEEDLE',
  'MEDIUM FUSHING',
  'PATTERN TAKER',
  'TEMPLATE M/C',
];

const COMMON_MAKES = [
  'JUKI',
  'JACK',
  'BROTHER',
  'PEGASUS',
  'YAMATO',
  'PGS',
  'SUPREME',
  'KANSAI',
  'BHARATH',
  'HI-TECH',
  'EASTMAN',
  'SINGER',
  'FEATHERLITE',
  'GODREJ',
];

const FLOOR_LINES: FloorLine[] = [
  'Line 01',
  'Line 02',
  'Line 03',
  'Line 04',
  'Line 05',
  'Line 06',
  'Line 07',
  'Line 08',
  'Buffer Workshop',
  'Scrap Bay',
];

export function EditAssetModal({ isOpen, onClose, asset, onSave }: EditAssetModalProps) {
  const { showToast } = useToast();

  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<AssetCategory>('MACHINE');
  const [type, setType] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState<string>('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [area, setArea] = useState('NETHAJI');
  const [zone, setZone] = useState('');
  const [unit, setUnit] = useState('UNIT - 1');
  const [currentLine, setCurrentLine] = useState<FloorLine>('Line 01');
  const [stationNo, setStationNo] = useState('');
  const [serialNo, setSerialNo] = useState('');
  const [department, setDepartment] = useState('Sewing Floor');
  const [status, setStatus] = useState<MachineStatus>('ACTIVE');
  const [cost, setCost] = useState<number | ''>(45000);
  const [motorType, setMotorType] = useState<MotorType>('SERVO');
  const [specs, setSpecs] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (asset && isOpen) {
      setId(asset.id || '');
      setName(asset.name || `${asset.brand} ${asset.typeName || asset.type || ''}`);
      setCategory(asset.category || 'MACHINE');
      setType(asset.typeName || asset.type || '');
      setBrand(asset.brand || '');
      setModel(asset.model || '');
      
      // Determine year
      const y = (asset as any).year || (asset.purchaseDate ? new Date(asset.purchaseDate).getFullYear() : 2023);
      setYear(String(y));
      setPurchaseDate(asset.purchaseDate || `${y}-01-01`);

      setArea((asset as any).location || asset.area || 'NETHAJI');
      setZone((asset as any).zone || '');
      setUnit((asset as any).plant || asset.unit || 'UNIT - 1');
      setCurrentLine(asset.currentLine || 'Line 01');
      setStationNo(asset.stationNo || 'Station 01');
      setSerialNo(asset.serialNo || asset.serialNumber || asset.mcNo || asset.stationNo || '');
      setDepartment(asset.department || 'Sewing Floor');
      setStatus(asset.status || 'ACTIVE');
      setCost(asset.cost ?? 45000);
      setMotorType(asset.motorType || 'SERVO');
      setSpecs(asset.specs || '');
    }
  }, [asset, isOpen]);

  if (!isOpen || !asset) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id.trim()) {
      showToast('Machine / Asset ID (M/C NO) is required', 'error');
      return;
    }
    if (!brand.trim()) {
      showToast('Machine Make / Brand is required', 'error');
      return;
    }
    if (!serialNo.trim()) {
      showToast('Serial Number is required', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const parsedYear = parseInt(year, 10);
      const computedPurchaseDate = purchaseDate || (parsedYear ? `${parsedYear}-01-01` : asset.purchaseDate);

      const updatedData: Partial<Machine> & { [key: string]: any } = {
        id: id.trim(),
        name: name.trim() || `${brand.trim()} ${type.trim()}`,
        brand: brand.trim(),
        model: model.trim() || type.trim(),
        category,
        type: type.trim(),
        typeName: type.trim(),
        year: isNaN(parsedYear) ? undefined : parsedYear,
        purchaseDate: computedPurchaseDate,
        area: area.trim(),
        location: area.trim(),
        zone: '',
        unit: unit.trim(),
        plant: unit.trim(),
        currentLine: currentLine || '',
        serialNo: serialNo.trim(),
        serialNumber: serialNo.trim(),
        mcNo: serialNo.trim(),
        stationNo: serialNo.trim() || stationNo.trim(),
        department: department as any,
        status,
        cost: typeof cost === 'number' ? cost : 0,
        motorType,
        specs: specs.trim() || `Plant ${unit.trim()} • Location ${area.trim()} • Year ${year}`,
      };

      await updateMachine(asset.id, updatedData);

      const fullUpdated: Machine = {
        ...asset,
        ...updatedData,
      };

      if (onSave) {
        onSave(fullUpdated);
      }

      showToast(`Asset "${updatedData.id}" updated successfully!`, 'success');
      onClose();
    } catch (err) {
      console.error('Failed to update asset:', err);
      showToast('Failed to save changes. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200 overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <Pencil className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  Edit Asset Details
                </h2>
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 border border-indigo-200">
                  {asset.id}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Update machine make, serial number, factory placement, and operational state.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body - Scrollable */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-5 space-y-5 flex-1">
          {/* Section 1: Core Identification */}
          <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 space-y-3.5">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-indigo-600" />
              <span>Asset Identification</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Asset ID / M/C NO */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Machine No / Serial (M/C NO) *
                </label>
                <input
                  type="text"
                  required
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  placeholder="e.g. 4DORD15615"
                  className="w-full px-3 py-2 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                />
              </div>

              {/* Asset Name */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Asset Display Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Juki SNLS"
                  className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Category *
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as AssetCategory)}
                  className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition cursor-pointer"
                >
                  <option value="MACHINE">Sewing &amp; Industrial Machinery</option>
                  <option value="FURNITURE">Furniture &amp; Workstations</option>
                  <option value="UTILITY">Electrical Utilities</option>
                  <option value="VEHICLE">Vehicles &amp; Transport</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Technical Specs */}
          <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 space-y-3.5">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-indigo-600" />
              <span>Machine Specifications</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Machine Type */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Machine Type *
                </label>
                <input
                  type="text"
                  required
                  list="machine-types-list"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  placeholder="e.g. SNLS, O/L, H.F/L"
                  className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                />
                <datalist id="machine-types-list">
                  {COMMON_MACHINE_TYPES.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </div>

              {/* Machine Make / Brand */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Machine Make (Brand) *
                </label>
                <input
                  type="text"
                  required
                  list="makes-list"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  placeholder="e.g. JUKI, BROTHER, JACK"
                  className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition uppercase"
                />
                <datalist id="makes-list">
                  {COMMON_MAKES.map((m) => (
                    <option key={m} value={m} />
                  ))}
                </datalist>
              </div>

              {/* Model */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  M/C Model
                </label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="e.g. DDL-8700 or —"
                  className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Motor Type */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Motor Drive Type
                </label>
                <select
                  value={motorType}
                  onChange={(e) => setMotorType(e.target.value as MotorType)}
                  className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition cursor-pointer"
                >
                  <option value="SERVO">Direct-Drive Energy Servo</option>
                  <option value="CLUTCH">Traditional Clutch Motor</option>
                </select>
              </div>

              {/* Year */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Manufacturing / Commission Year
                </label>
                <input
                  type="number"
                  min="1990"
                  max="2035"
                  value={year}
                  onChange={(e) => {
                    setYear(e.target.value);
                    if (e.target.value) {
                      setPurchaseDate(`${e.target.value}-01-01`);
                    }
                  }}
                  placeholder="e.g. 2024"
                  className="w-full px-3 py-2 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Location & Placement */}
          <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 space-y-3.5">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-indigo-600" />
              <span>Location &amp; Plant Placement</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Location */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Location *
                </label>
                <input
                  type="text"
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  placeholder="e.g. NETHAJI, PEACOCK"
                  className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition uppercase"
                />
              </div>

              {/* Plant */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Plant / Section *
                </label>
                <input
                  type="text"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="e.g. UNIT - 1, UNIT-2"
                  className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition uppercase"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Serial Number */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Serial Number *
                </label>
                <input
                  type="text"
                  required
                  value={serialNo}
                  onChange={(e) => setSerialNo(e.target.value)}
                  placeholder="e.g. SN-4DORD15615"
                  className="w-full px-3 py-2 text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                />
              </div>

              {/* Department */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Factory Department
                </label>
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Sewing Floor"
                  className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Operational Status & Cost */}
          <div className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/80 space-y-3.5">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-indigo-600" />
              <span>Operational Status &amp; Valuation</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Status */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Machine Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as MachineStatus)}
                  className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition cursor-pointer"
                >
                  <option value="ACTIVE" className="text-emerald-700 font-bold">🟢 ACTIVE (Running in Production)</option>
                  <option value="IDLE" className="text-amber-700 font-bold">🟡 IDLE (Standby on Line)</option>
                  <option value="BUFFER" className="text-blue-700 font-bold">🔵 BUFFER (Workshop Standby)</option>
                  <option value="BREAKDOWN" className="text-rose-700 font-bold">🔴 BREAKDOWN (Fault Reported)</option>
                  <option value="UNDER_MAINTENANCE" className="text-orange-700 font-bold">🟠 UNDER MAINTENANCE</option>
                  <option value="SCRAP" className="text-slate-600 font-bold">⚫ SCRAP (Decommissioned)</option>
                </select>
              </div>

              {/* Asset Value / Cost */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Asset Value (₹ INR)
                </label>
                <input
                  type="number"
                  min="0"
                  step="500"
                  value={cost}
                  onChange={(e) => setCost(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. 45000"
                  className="w-full px-3 py-2 text-xs font-mono font-semibold bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                />
              </div>
            </div>

            {/* Notes / Specs */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Technical Specifications &amp; Notes
              </label>
              <textarea
                rows={2}
                value={specs}
                onChange={(e) => setSpecs(e.target.value)}
                placeholder="Specifications, modifications, special attachments..."
                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Asset Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
