'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useParams, useRouter, useSearchParams, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Wrench,
  QrCode,
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  Radio,
  ArrowLeft,
  Clock,
  MapPin,
  Tag,
  ShieldCheck,
  Loader2,
  History,
  Pencil,
  UserCheck,
} from 'lucide-react';
import { EditAssetModal } from '@/components/asset/EditAssetModal';
import { Machine, FloorLine, RepairUrgency } from '@/types/cmms';
import {
  subscribeMachines,
  createBreakdownTicket,
  relocateMachine,
  subscribeRepairs,
} from '@/lib/services/cmmsService';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import { AssetHistoryModal } from '@/components/scan/AssetHistoryModal';
import { formatAssetLocation } from '@/lib/formatters';
import { matchesUnit } from '@/lib/constants/units';

function MobileScanContent() {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const expected = (typeof window !== 'undefined' ? window.location.pathname : pathname).match(/^\/([^/]+)\/scan\//)?.[1]?.toLowerCase();

  // If URL has company slug (e.g. /esstee/scan/MC-01), cache company tenant for public API queries
  useEffect(() => {
    if (expected && typeof window !== 'undefined') {
      localStorage.setItem('cmms_active_company', expected);
      localStorage.setItem('cmms_active_tenant', expected);
    }
  }, [expected]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-600">Opening Asset Scanner...</p>
        </div>
      </div>
    );
  }

  // Cross-tenant notice only if a logged-in user scans an asset from another company
  if (user && expected && expected !== user.companySlug) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-6 border border-slate-200 shadow-xl text-center space-y-4">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto border border-amber-200">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-bold text-slate-900">Different Company Workspace</h1>
          <p className="text-xs text-slate-500 leading-relaxed">
            This asset tag belongs to <strong>{expected.toUpperCase()}</strong>, but you are signed in as <strong>{user.company || user.companySlug}</strong>.
          </p>
          <div className="pt-2 flex flex-col gap-2">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition"
            >
              <span>Switch Account</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <AuthenticatedScanContent />;
}

function AuthenticatedScanContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const machineId = typeof params?.id === 'string' ? decodeURIComponent(params.id) : '';

  const { showToast } = useToast();
  const { user, role } = useAuth();

  const [machine, setMachine] = useState<Machine | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'report' | 'relocate'>('report');
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [assetHistoryCount, setAssetHistoryCount] = useState<number>(0);

  // Breakdown Form
  const [faultType, setFaultType] = useState('Skipping Stitches / Looper Timing Misalignment');
  const [urgency, setUrgency] = useState<RepairUrgency>('CRITICAL');
  const [faultNotes, setFaultNotes] = useState('');
  const [selectedMechanic, setSelectedMechanic] = useState('');
  const [reporterName, setReporterName] = useState('');
  const [registeredTechs, setRegisteredTechs] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Relocate Form
  const [targetLine, setTargetLine] = useState<FloorLine>('Line 01');
  const [targetStation, setTargetStation] = useState('');
  const [relocateReason, setRelocateReason] = useState('');

  // Fetch registered mechanics / technicians
  useEffect(() => {
    fetch('/api/users')
      .then((r) => r.json())
      .then((data) => {
        if (data.users && Array.isArray(data.users)) {
          const techs = data.users.filter((u: any) =>
            ['MECHANIC', 'ELECTRICIAN', 'SENIOR_MECHANIC', 'SENIOR_ELECTRICIAN'].includes((u.role || '').toUpperCase())
          );
          setRegisteredTechs(techs);
        }
      })
      .catch(() => {});
  }, []);

  // Show all registered technicians across all units (prioritizing machine's unit first)
  const availableMechanics = useMemo(() => {
    const machineUnit = machine?.unit || '';
    return [...registeredTechs].sort((a, b) => {
      const aMatches = machineUnit && matchesUnit(a.unit, machineUnit) ? 1 : 0;
      const bMatches = machineUnit && matchesUnit(b.unit, machineUnit) ? 1 : 0;
      if (aMatches !== bMatches) return bMatches - aMatches;
      const uComp = (a.unit || '').localeCompare(b.unit || '');
      if (uComp !== 0) return uComp;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [registeredTechs, machine?.unit]);

  // Group technicians by unit for organized dropdown display
  const groupedMechanics = useMemo(() => {
    const groups: Record<string, any[]> = {};
    availableMechanics.forEach((m: any) => {
      const u = m.unit || 'All Units';
      if (!groups[u]) groups[u] = [];
      groups[u].push(m);
    });
    return groups;
  }, [availableMechanics]);

  useEffect(() => {
    const unsub = subscribeMachines((machines) => {
      const found = machines.find((m) => m.id.toLowerCase() === machineId.toLowerCase());
      if (found) {
        setMachine(found);
        setTargetLine(found.currentLine);
        setTargetStation(found.stationNo);
      } else {
        setMachine(null);
      }
      setIsLoading(false);
    });

    const unsubRepairs = subscribeRepairs((repairs) => {
      const matching = repairs.filter(
        (r) => r.machineId?.toLowerCase() === machineId.toLowerCase()
      );
      setAssetHistoryCount(matching.length);
    });

    return () => {
      unsub();
      unsubRepairs();
    };
  }, [machineId, searchParams]);

  const handleBreakdownSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!machine) return;
    setIsSubmitting(true);

    try {
      const reporterDisplay = user
        ? `${user.name} (${user.title || 'Line'})`
        : (reporterName.trim() ? `${reporterName.trim()} (Floor Operator)` : 'Floor Operator (QR Scan)');

      const ticketId = await createBreakdownTicket({
        machineId: machine.id,
        machineType: machine.typeName || machine.type,
        line: machine.currentLine,
        reportedAt: new Date().toISOString(),
        reportedBy: reporterDisplay,
        faultCategory: faultType,
        faultDetails: faultNotes.trim() || 'Logged via QR sticker scan on production floor.',
        urgency,
        attendedBy: selectedMechanic.trim() || null,
        assignedBy: user?.name || reporterName.trim() || 'Floor QR Dispatch',
      });

      showToast(
        selectedMechanic
          ? `Breakdown #${ticketId} dispatched and assigned to ${selectedMechanic} (${machine.unit || 'Floor'})!`
          : `Breakdown #${ticketId} broadcasted to Mechanic Queue for ${machine.id}!`,
        selectedMechanic ? 'success' : 'error'
      );
      setFaultNotes('');
      setSelectedMechanic('');
      setReporterName('');
      if (user) {
        if (role === 'CEO') {
          router.push('/dashboard/messages');
        } else if (role === 'ADMIN' || role === 'ASSET_MANAGER') {
          router.push('/dashboard/machines');
        } else {
          router.push('/dashboard/calendar');
        }
      }
    } catch (err) {
      showToast('Failed to dispatch breakdown ticket', 'error');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRelocateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!machine) return;
    setIsSubmitting(true);

    try {
      await relocateMachine(
        machine.id,
        targetLine,
        targetStation || 'Station 01',
        relocateReason.trim() || 'Floor line balancing',
        user?.name || reporterName.trim() || 'Floor Operator'
      );

      showToast(`Machine ${machine.id} relocated to ${targetLine} (${targetStation})`, 'success');
      setRelocateReason('');
      if (user) {
        if (role === 'ADMIN' || role === 'ASSET_MANAGER') {
          router.push('/dashboard/floor-tracker');
        } else {
          router.push('/dashboard');
        }
      }
    } catch (err) {
      showToast('Failed to relocate machine', 'error');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold text-slate-600">Scanning Asset Tag...</p>
        </div>
      </div>
    );
  }

  if (!machine) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl p-6 border border-slate-200 shadow-xl text-center space-y-4">
          <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto border border-rose-200">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Unrecognized Asset Tag</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Machine tag <code className="bg-slate-100 px-2 py-1 rounded text-amber-700 font-mono border border-slate-200">{machineId}</code> was not found in the factory registry.
          </p>
          <Link
            href={user ? (role === 'CEO' ? '/dashboard' : '/dashboard/machines') : '/login'}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{user ? (role === 'CEO' ? 'Return to Executive Dashboard' : 'Return to Machine Registry') : 'Staff Sign In'}</span>
          </Link>
        </div>
      </div>
    );
  }

  const isDown = machine.status === 'BREAKDOWN';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col p-4 sm:p-6 antialiased selection:bg-indigo-500 selection:text-white">
      {/* Mobile Top Header with Prominent History Button */}
      <div className="max-w-lg w-full mx-auto flex items-center justify-between py-3 border-b border-slate-200 mb-4 gap-2">
        <Link
          href={user ? (role === 'CEO' ? '/dashboard' : '/dashboard/machines') : '/login'}
          className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1.5 transition font-semibold"
        >
          <ArrowLeft className="w-4 h-4 text-slate-500" />
          <span>{user ? (role === 'CEO' ? 'Executive Dashboard' : 'Maintenance Dashboard') : 'Staff Sign In'}</span>
        </Link>

        {/* Top Actions: Edit Button + History Button + Live Status */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsEditModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer"
            title="Edit this asset's specifications, location, and operational details"
          >
            <Pencil className="w-3.5 h-3.5 text-indigo-600" />
            <span>Edit Asset</span>
          </button>

          <button
            type="button"
            onClick={() => setIsHistoryModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-xs font-bold shadow-xs transition active:scale-95 cursor-pointer"
            title="Inspect full asset maintenance and relocation history"
          >
            <History className="w-3.5 h-3.5" />
            <span>Asset History</span>
            {assetHistoryCount > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] bg-white/20 rounded-full font-mono">
                {assetHistoryCount}
              </span>
            )}
          </button>

          <div className="hidden sm:flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-2 py-1 rounded-lg border border-emerald-200 text-[11px] font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>Live Floor Terminal</span>
          </div>
        </div>
      </div>

      {/* Main Card */}
      <div className="max-w-lg w-full mx-auto bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
        {/* Machine Identity Banner */}
        <div className="p-6 bg-gradient-to-br from-indigo-50/70 via-white to-slate-50 border-b border-slate-200 relative">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-600">
                SCANNED ASSET
              </div>
              <h1 className="text-2xl font-extrabold font-mono text-slate-900 mt-0.5 tracking-tight">
                {machine.id}
              </h1>
              <p className="text-sm font-bold text-indigo-700 mt-0.5">
                {machine.brand} • {machine.model}
              </p>
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="font-black uppercase tracking-wider bg-slate-900 text-white px-2 py-0.5 rounded text-[10px]">
                  {machine.unit || 'Unit 01'}
                </span>
                <span className="text-xs font-bold text-slate-700 truncate max-w-[200px]">
                  {machine.area || machine.department || 'Sewing Floor'}
                </span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  isDown
                    ? 'bg-rose-50 text-rose-700 border border-rose-200 urgent-pulse'
                    : machine.status === 'BUFFER'
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}
              >
                {machine.status}
              </span>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(true)}
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Pencil className="w-3 h-3" />
                <span>Edit Details</span>
              </button>
              <button
                type="button"
                onClick={() => setIsHistoryModalOpen(true)}
                className="text-[11px] font-bold text-slate-500 hover:text-slate-800 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <History className="w-3 h-3" />
                <span>Timeline ({assetHistoryCount})</span>
              </button>
            </div>
          </div>

          {/* Machine specs strip */}
          <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
            <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] text-slate-500 block font-medium">Class / Type</span>
              <span className="font-semibold text-slate-800 truncate block">
                {machine.typeName || machine.type}
              </span>
            </div>
            <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[10px] text-slate-500 block font-medium">Located Area</span>
              <span className="font-semibold text-emerald-700 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-emerald-600" />
                {formatAssetLocation(machine)}
              </span>
            </div>
          </div>

          {machine.previousLine && (
            <div className="mt-2.5 p-2 rounded-xl bg-indigo-50/80 border border-indigo-200 text-[11px] flex items-center justify-between text-indigo-900">
              <div className="flex items-center gap-1.5 truncate">
                <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span className="text-slate-600">Held before:</span>
                <span className="font-semibold text-slate-900 truncate">{machine.previousLine} ({machine.previousStation || 'Station'})</span>
              </div>
              {machine.lastMovedAt && (
                <span className="text-[10px] text-slate-500 shrink-0 ml-2 font-mono">
                  {new Date(machine.lastMovedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Action Tabs: Report vs Relocate */}
        <div className="flex border-b border-slate-200 text-xs font-bold bg-slate-50">
          <button
            type="button"
            onClick={() => setActiveTab('report')}
            className={`flex-1 py-3.5 text-center border-b-2 transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'report'
                ? 'border-rose-600 text-rose-700 bg-rose-50/60 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
          >
            <AlertTriangle className="w-4 h-4 text-rose-600" />
            <span>1. Report Breakdown</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('relocate')}
            className={`flex-1 py-3.5 text-center border-b-2 transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'relocate'
                ? 'border-indigo-600 text-indigo-700 bg-indigo-50/60 font-extrabold'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
          >
            <ArrowRightLeft className="w-4 h-4 text-indigo-600" />
            <span>2. Relocate Asset</span>
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6">
          {activeTab === 'report' ? (
            <form onSubmit={handleBreakdownSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Specific Asset Defect / Breakdown *
                </label>
                <select
                  value={faultType}
                  onChange={(e) => setFaultType(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 text-slate-800 outline-none font-medium focus:bg-white transition"
                >
                  {machine.category === 'TABLE' ? (
                    <>
                      <option value="Table Surface Damaged / Laminate Chipped">
                        Table Surface Damaged / Laminate Chipped
                      </option>
                      <option value="Levelling Bolt Loose / Table Wobble">
                        Levelling Bolt Loose / Table Wobble
                      </option>
                      <option value="Ruler / Measurement Tape Decal Peeling">
                        Ruler / Measurement Tape Decal Peeling
                      </option>
                      <option value="Air-Flotation Blower Inoperative / Duct Clogged">
                        Air-Flotation Blower Inoperative / Duct Clogged
                      </option>
                      <option value="Table Leg Structural Weld / Bolt Cracked">
                        Table Leg Structural Weld / Bolt Cracked
                      </option>
                    </>
                  ) : machine.category === 'CHAIR' ? (
                    <>
                      <option value="Pneumatic Gas Cylinder Sinking / Pressure Loss">
                        Pneumatic Gas Cylinder Sinking / Pressure Loss
                      </option>
                      <option value="Castor Wheel Broken / Thread Jammed">
                        Castor Wheel Broken / Thread Jammed
                      </option>
                      <option value="Lumbar Support / Backrest Tilt Broken">
                        Lumbar Support / Backrest Tilt Broken
                      </option>
                      <option value="Seat Base Foam Cracked / Loose Mounting">
                        Seat Base Foam Cracked / Loose Mounting
                      </option>
                    </>
                  ) : machine.category === 'UTILITY' || machine.category === 'LIGHT' || machine.category === 'FAN' ? (
                    <>
                      <option value="High-Bay / Task Light Flickering or Dead Ballast">
                        High-Bay / Task Light Flickering or Dead Ballast
                      </option>
                      <option value="Light Tube Broken / Low Lumens">
                        Light Tube Broken / Low Lumens
                      </option>
                      <option value="Industrial Fan Motor Bearing Noise / Blade Vibration">
                        Industrial Fan Motor Bearing Noise / Blade Vibration
                      </option>
                      <option value="Steam Boiler Heating Element / Pressure Valve Drop">
                        Steam Boiler Heating Element / Pressure Valve Drop
                      </option>
                      <option value="Compressor Pneumatic Pressure Drop / Air Hose Leak">
                        Compressor Pneumatic Pressure Drop / Air Hose Leak
                      </option>
                      <option value="Fire Station Inspection Overdue / Gauge Low">
                        Fire Station Inspection Overdue / Gauge Low
                      </option>
                    </>
                  ) : (
                    <>
                      <option value="Skipping Stitches / Looper Timing Misalignment">
                        Skipping Stitches / Looper Timing Misalignment
                      </option>
                      <option value="Frequent Needle Breakage">
                        Frequent Needle Breakage (Deflection / Feed clash)
                      </option>
                      <option value="Thread Tension / Puckering">
                        Thread Tension / Seam Puckering (Birdnesting)
                      </option>
                      <option value="Motor Error / E-07 Controller">
                        Motor Error / Direct-Drive Controller E-07
                      </option>
                      <option value="Oil Reservoir Leakage">
                        Oil Reservoir Leakage / Siphon Failure
                      </option>
                      <option value="Bobbin Winder / Cutter Jam">
                        Under-bed Thread Trimmer (UTT) / Cutter Jam
                      </option>
                      <option value="Severe Noise & Vibration">
                        Severe Noise &amp; Bearing Vibration
                      </option>
                    </>
                  )}
                </select>
              </div>

              {/* Mechanic Selection Dropdown across All Units */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Assign To Technician (All Units) *</span>
                  </label>
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                    {availableMechanics.length} available
                  </span>
                </div>
                <div className="relative">
                  <select
                    value={selectedMechanic}
                    onChange={(e) => setSelectedMechanic(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-800 outline-none font-semibold focus:bg-white transition cursor-pointer"
                  >
                    <option value="">-- Select Technician (All Units) --</option>
                    {Object.entries(groupedMechanics).map(([unitGroup, techs]) => (
                      <optgroup key={unitGroup} label={`📍 ${unitGroup}`}>
                        {techs.map((m: any) => (
                          <option key={m.uid || m.id || m.name} value={m.name}>
                            {m.name} ({m.role || 'Mechanic'}) • {m.unit || unitGroup}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Issue will automatically appear on this technician&apos;s workbench and login dashboard.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Severity / Line Impact *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`flex items-center p-3 rounded-xl border text-xs font-bold cursor-pointer transition ${
                      urgency === 'CRITICAL'
                        ? 'border-rose-500 bg-rose-50 text-rose-700 ring-2 ring-rose-500'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <input
                      type="radio"
                      name="urgency"
                      checked={urgency === 'CRITICAL'}
                      onChange={() => setUrgency('CRITICAL')}
                      className="mr-2 text-rose-600"
                    />
                    <span>Critical (Line Stopped)</span>
                  </label>
                  <label
                    className={`flex items-center p-3 rounded-xl border text-xs font-bold cursor-pointer transition ${
                      urgency === 'WARNING'
                        ? 'border-amber-500 bg-amber-50 text-amber-700 ring-2 ring-amber-500'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <input
                      type="radio"
                      name="urgency"
                      checked={urgency === 'WARNING'}
                      onChange={() => setUrgency('WARNING')}
                      className="mr-2 text-amber-600"
                    />
                    <span>Warning (Quality Defect)</span>
                  </label>
                </div>
              </div>

              {!user && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                    Your Name / Operator ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={reporterName}
                    onChange={(e) => setReporterName(e.target.value)}
                    placeholder="e.g. Ramesh (Line 01 Operator)"
                    className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 text-slate-800 outline-none font-medium focus:bg-white transition"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Floor Notes for Attending Mechanic
                </label>
                <textarea
                  value={faultNotes}
                  onChange={(e) => setFaultNotes(e.target.value)}
                  rows={3}
                  placeholder="e.g. Breaking needle on heavy seam crossover on pocket attachment..."
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-rose-500 text-slate-800 outline-none focus:bg-white transition"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/25 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Radio className="w-4 h-4" />
                <span>Broadcast Breakdown to Mechanic Queue</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleRelocateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Move To Target Line / Area *
                </label>
                <select
                  value={targetLine}
                  onChange={(e) => setTargetLine(e.target.value as FloorLine)}
                  required
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-800 outline-none font-medium focus:bg-white transition"
                >
                  <option value="Line 01">Line 01 (Polo / Knit)</option>
                  <option value="Line 02">Line 02 (T-Shirts Basic)</option>
                  <option value="Line 03">Line 03 (Woven Shirts)</option>
                  <option value="Line 04">Line 04 (Denim Bottoms)</option>
                  <option value="Buffer Workshop">Buffer Workshop (Standby Pool)</option>
                  <option value="Scrap Bay">Scrap Bay (Decommissioned)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Target Station Position
                </label>
                <input
                  type="text"
                  value={targetStation}
                  onChange={(e) => setTargetStation(e.target.value)}
                  placeholder="e.g. Station 06"
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-800 outline-none font-medium focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
                  Reason for Relocation
                </label>
                <input
                  type="text"
                  value={relocateReason}
                  onChange={(e) => setRelocateReason(e.target.value)}
                  placeholder="e.g. Style changeover: line balancing for heavy seam"
                  className="w-full px-3.5 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-800 outline-none focus:bg-white transition"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/25 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <ArrowRightLeft className="w-4 h-4" />
                <span>Confirm Machine Movement</span>
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Asset Maintenance & Relocation History Modal */}
      <AssetHistoryModal
        machine={machine}
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
      />

      {/* Edit Asset Information Modal */}
      <EditAssetModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        asset={machine}
        onSave={(updated) => {
          setMachine(updated);
        }}
      />
    </div>
  );
}

export default function MobileScanPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 text-slate-600">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
          <div className="text-sm font-semibold text-slate-800">
            Loading Asset QR Record...
          </div>
        </div>
      }
    >
      <MobileScanContent />
    </Suspense>
  );
}

