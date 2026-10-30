'use client';

import { textValue } from '@/lib/textValue';

import React, { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Layers,
  Search,
  CheckCircle2,
  PauseCircle,
  AlertTriangle,
  QrCode,
  Camera,
  ArrowRightLeft,
  RotateCw,
  Filter,
  CheckSquare,
  Square,
  Sparkles,
  Volume2,
  VolumeX,
  History,
  FileSpreadsheet,
  Printer,
  ChevronDown,
  Wrench,
  Activity,
  ArrowRight,
  MapPin,
  Clock,
  UserCheck,
  Tag,
  ShieldCheck,
  Radio,
  Plus,
  Pencil,
  Building2,
} from 'lucide-react';
import { EditAssetModal } from '@/components/asset/EditAssetModal';
import { Machine, MachineStatus, AssetLogEntry, FloorLine } from '@/types/cmms';
import {
  subscribeMachines,
  updateMachineStatus,
} from '@/lib/services/cmmsService';
import {
  CLIENT_ZONES,
  CLIENT_LINES,
  ClientZone,
  ClientLine,
  getMachineZone,
  getMachineLine,
  subscribeAssetLogs,
  toggleMachineActiveIdle,
  assignMachineZoneLine,
  setMachineStatusWithLog,
  addExtraMachineToZone,
} from '@/lib/services/assetLogService';
import { LineAvailabilityWidget } from '@/components/dashboard/LineAvailabilityWidget';
import { CameraScannerModal } from '@/components/scan/CameraScannerModal';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import { matchesUnit, isUserAdmin, getUserScopedUnit } from '@/lib/constants/units';

function AssetLogContent() {
  const { user, role } = useAuth();
  const { showToast } = useToast();
  const searchParams = useSearchParams();

  const [machines, setMachines] = useState<Machine[]>([]);
  const [assetLogs, setAssetLogs] = useState<AssetLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Quick Enter Input State
  const [scanInput, setScanInput] = useState<string>('');
  const [scanActionTarget, setScanActionTarget] = useState<'ACTIVE' | 'IDLE'>('ACTIVE');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [lastToggledResult, setLastToggledResult] = useState<{
    machineId: string;
    prevStatus: MachineStatus;
    newStatus: MachineStatus;
    timestamp: Date;
    machineName?: string;
  } | null>(null);

  // Camera Scanner Modal State
  const [isCameraModalOpen, setIsCameraModalOpen] = useState<boolean>(false);

  // Filter State
  const [activeTab, setActiveTab] = useState<'LEDGER' | 'REPORT' | 'LOGS'>('LEDGER');
  const isAdmin = isUserAdmin(role);
  const [selectedUnit, setSelectedUnit] = useState<string>(() => {
    if (isUserAdmin(role)) return 'ALL';
    return getUserScopedUnit(user, role);
  });
  const effectiveUnit = getUserScopedUnit(user, role, selectedUnit === 'ALL' ? null : selectedUnit);
  const [selectedZone, setSelectedZone] = useState<ClientZone | 'ALL'>('ALL');
  const [selectedLine, setSelectedLine] = useState<ClientLine | 'ALL'>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<MachineStatus | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    if (!isUserAdmin(role)) {
      setSelectedUnit(getUserScopedUnit(user, role));
    } else if (user?.unit && user.unit !== 'All Units') {
      setSelectedUnit(user.unit);
    }
  }, [user, role]);

  // Base machines filtered by unit scope (locked to mechanic's unit for non-admins)
  const baseMachines = useMemo(() => {
    if (isAdmin && selectedUnit === 'ALL') return machines;
    return machines.filter((m) => matchesUnit(m.unit, effectiveUnit));
  }, [machines, isAdmin, selectedUnit, effectiveUnit]);

  // Scoped asset logs filtered by unit scope
  const scopedAssetLogs = useMemo(() => {
    if (isAdmin && selectedUnit === 'ALL') return assetLogs;
    const validIds = new Set(baseMachines.map((m) => textValue(m.id).toUpperCase()));
    return assetLogs.filter((log) => {
      if (log.machineId && validIds.has(textValue(log.machineId).toUpperCase())) return true;
      if (log.machineUnit && matchesUnit(log.machineUnit, effectiveUnit)) return true;
      return false;
    });
  }, [assetLogs, baseMachines, isAdmin, selectedUnit, effectiveUnit]);

  // Batch Selection State
  const [selectedMachineIds, setSelectedMachineIds] = useState<string[]>([]);

  // Reassign Zone/Line Modal State
  const [isReassignModalOpen, setIsReassignModalOpen] = useState<boolean>(false);
  const [targetMachineForReassign, setTargetMachineForReassign] = useState<Machine | null>(null);
  const [reassignZone, setReassignZone] = useState<ClientZone>('Zone 1');
  const [reassignLine, setReassignLine] = useState<ClientLine>('Line 01');
  const [reassignStation, setReassignStation] = useState<string>('Station 01');

  // Edit Asset Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [machineToEdit, setMachineToEdit] = useState<Machine | null>(null);

  // Add Extra Machine Modal State
  const [isAddExtraModalOpen, setIsAddExtraModalOpen] = useState<boolean>(false);
  const [extraZone, setExtraZone] = useState<ClientZone>('Zone 1');
  const [extraLine, setExtraLine] = useState<ClientLine>('Line 01');
  const [extraMachineId, setExtraMachineId] = useState<string>('');
  const [extraMachineBrand, setExtraMachineBrand] = useState<string>('Juki');
  const [extraMachineType, setExtraMachineType] = useState<string>('Single Needle Lockstitch');
  const [extraMachineModel, setExtraMachineModel] = useState<string>('DDL-9000C');
  const [extraMachineStatus, setExtraMachineStatus] = useState<MachineStatus>('ACTIVE');

  // Input ref for auto-focus
  const scanInputRef = useRef<HTMLInputElement | null>(null);

  // ─── Play Audio Synthesis Feedback ───
  const playAudioTone = (type: 'ACTIVE' | 'IDLE' | 'ERROR') => {
    if (!soundEnabled || typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      if (type === 'ACTIVE') {
        // High upbeat ascending chime
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22);
        osc.start(now);
        osc.stop(now + 0.22);
      } else if (type === 'IDLE') {
        // Soft mellow chime
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.exponentialRampToValueAtTime(392.0, now + 0.15); // G4
        gain.gain.setValueAtTime(0.16, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
      } else {
        // Error buzz
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
        osc.start(now);
        osc.stop(now + 0.18);
      }
    } catch {
      // AudioContext not allowed before user gesture
    }
  };

  // ─── Initialize Data ───
  useEffect(() => {
    let isSubscribed = true;

    const unsubMachines = subscribeMachines((data) => {
      if (!isSubscribed) return;
      setMachines(data || []);
      setIsLoading(false);
    });

    const unsubLogs = subscribeAssetLogs((logs) => {
      if (!isSubscribed) return;
      setAssetLogs(logs);
    });

    return () => {
      isSubscribed = false;
      unsubMachines();
      unsubLogs();
    };
  }, []);

  // Matched machine lookup for fast live preview in the dispatch bar (unit scoped)
  const matchedMachine = useMemo(() => {
    if (!scanInput.trim()) return null;
    const q = scanInput.trim().toUpperCase();
    return baseMachines.find((m) => textValue(m.id).toUpperCase() === q);
  }, [scanInput, baseMachines]);

  // ─── Handler: Direct Dispatch by ID ("Move to active" or "idle") ───
  const handleDispatchById = async (targetId: string, status: 'ACTIVE' | 'IDLE') => {
    const cleanId = targetId.trim();
    if (!cleanId) return;

    // Unit-boundary check: non-admins cannot dispatch machines from other units
    if (!isAdmin) {
      const existsInUnit = baseMachines.some((m) => textValue(m.id).toUpperCase() === cleanId.toUpperCase());
      if (!existsInUnit) {
        playAudioTone('ERROR');
        showToast(`Machine ${cleanId} is not in your assigned plant (${effectiveUnit || 'your unit'}).`, 'error');
        return;
      }
    }

    const changedByName = user?.name || (role === 'SENIOR_ELECTRICIAN' ? 'Senior Electrician' : 'Senior Mechanic');
    const result = await setMachineStatusWithLog(cleanId, status, changedByName);

    if (result.success && result.machine && result.previousStatus && result.newStatus) {
      playAudioTone(result.newStatus === 'ACTIVE' ? 'ACTIVE' : 'IDLE');
      showToast(result.message, result.newStatus === 'ACTIVE' ? 'success' : 'info');
      setLastToggledResult({
        machineId: result.machine.id,
        prevStatus: result.previousStatus,
        newStatus: result.newStatus,
        timestamp: new Date(),
        machineName: result.machine.name,
      });
      setScanInput('');
    } else {
      playAudioTone('ERROR');
      showToast(result.message || 'Machine ID not found or could not be updated.', 'error');
    }
  };

  // ─── Handler: Dispatch Machine on [Enter] key ───
  const handleScanSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!scanInput.trim()) return;
    await handleDispatchById(scanInput, scanActionTarget);
  };

  // ─── Handler: Direct 1-Click Toggle Switch from Row ───
  const handleRowToggle = async (machine: Machine) => {
    const changedByName = user?.name || (role === 'SENIOR_ELECTRICIAN' ? 'Senior Electrician' : 'Senior Mechanic');
    const result = await toggleMachineActiveIdle(machine.id, changedByName);
    if (result.success && result.machine && result.previousStatus && result.newStatus) {
      playAudioTone(result.newStatus === 'ACTIVE' ? 'ACTIVE' : 'IDLE');
      showToast(result.message, result.newStatus === 'ACTIVE' ? 'success' : 'info');
      setLastToggledResult({
        machineId: result.machine.id,
        prevStatus: result.previousStatus,
        newStatus: result.newStatus,
        timestamp: new Date(),
        machineName: result.machine.name,
      });
    } else {
      showToast(result.message, 'error');
    }
  };

  // ─── Handler: Dropdown Status Selection ("idle" or "Move to active") ───
  const handleStatusChange = async (machine: Machine, targetStatus: 'ACTIVE' | 'IDLE') => {
    if (machine.status === targetStatus) return;
    const changedByName = user?.name || (role === 'SENIOR_ELECTRICIAN' ? 'Senior Electrician' : 'Senior Mechanic');
    const result = await setMachineStatusWithLog(machine.id, targetStatus, changedByName);
    if (result.success && result.machine && result.previousStatus && result.newStatus) {
      playAudioTone(result.newStatus === 'ACTIVE' ? 'ACTIVE' : 'IDLE');
      showToast(result.message, result.newStatus === 'ACTIVE' ? 'success' : 'info');
      setLastToggledResult({
        machineId: result.machine.id,
        prevStatus: result.previousStatus,
        newStatus: result.newStatus,
        timestamp: new Date(),
        machineName: result.machine.name,
      });
    } else {
      showToast(result.message || 'Failed to update machine status', 'error');
    }
  };

  // ─── Handler: Add Extra Machine to Zone (increments zone total & active count) ───
  const handleAddExtraMachineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = (
      extraMachineId.trim() ||
      `MC-${extraZone.replace('Zone ', 'Z0')}-${extraLine.replace('Line ', 'L')}-EXT${Math.floor(
        Math.random() * 899 + 100
      )}`
    ).toUpperCase();
    const changedByName = user?.name || (role === 'SENIOR_ELECTRICIAN' ? 'Senior Electrician' : 'Senior Mechanic');

    const result = await addExtraMachineToZone({
      machineId: cleanId,
      brand: extraMachineBrand,
      type: extraMachineType,
      model: extraMachineModel,
      zone: extraZone,
      line: extraLine,
      status: extraMachineStatus,
      unit: selectedUnit !== 'ALL' ? selectedUnit : user?.unit || 'Unit 1',
      changedBy: changedByName,
    });

    if (result.success) {
      playAudioTone(extraMachineStatus === 'ACTIVE' ? 'ACTIVE' : 'IDLE');
      showToast(result.message, 'success');
      setIsAddExtraModalOpen(false);
      setExtraMachineId('');
    } else {
      showToast('Failed to add extra machine', 'error');
    }
  };

  // ─── Handler: Batch Set Status ───
  const handleBatchStatus = async (targetStatus: 'ACTIVE' | 'IDLE') => {
    if (selectedMachineIds.length === 0) return;
    const changedByName = user?.name || 'Senior Mechanic';

    let count = 0;
    for (const id of selectedMachineIds) {
      const mach = machines.find((m) => m.id === id);
      if (mach && mach.status !== targetStatus) {
        await updateMachineStatus(id, targetStatus);
        count++;
      }
    }

    playAudioTone(targetStatus);
    showToast(
      `Successfully updated ${count} machines to ${targetStatus}.`,
      'success'
    );
    setSelectedMachineIds([]);
  };

  // ─── Handler: Reassign Zone & Line ───
  const handleReassignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetMachineForReassign) return;

    const changedByName = user?.name || 'Senior Mechanic';
    const success = await assignMachineZoneLine(
      targetMachineForReassign.id,
      reassignZone,
      reassignLine,
      reassignStation,
      changedByName
    );

    if (success) {
      showToast(
        `Machine ${targetMachineForReassign.id} moved to ${reassignZone} • ${reassignLine}`,
        'success'
      );
      setIsReassignModalOpen(false);
      setTargetMachineForReassign(null);
    } else {
      showToast('Failed to update machine location', 'error');
    }
  };

  // ─── Filtered Machines List ───
  const filteredMachines = useMemo(() => {
    return baseMachines.filter((m) => {
      const mZone = getMachineZone(m);
      const mLine = getMachineLine(m);

      if (selectedZone !== 'ALL' && mZone !== selectedZone) return false;
      if (selectedLine !== 'ALL' && mLine !== selectedLine) return false;

      if (selectedStatus !== 'ALL') {
        if (selectedStatus === 'IDLE') {
          if (m.status !== 'IDLE' && m.status !== 'BUFFER') return false;
        } else if (selectedStatus === 'ACTIVE') {
          if (m.status !== 'ACTIVE') return false;
        } else if (selectedStatus === 'BREAKDOWN') {
          if (m.status !== 'BREAKDOWN' && m.status !== 'UNDER_MAINTENANCE') return false;
        } else if (m.status !== selectedStatus) {
          return false;
        }
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchId = textValue(m.id).toLowerCase().includes(q);
        const matchName = textValue((m.name || '')).toLowerCase().includes(q);
        const matchBrand = textValue((m.brand || '')).toLowerCase().includes(q);
        const matchModel = textValue((m.model || '')).toLowerCase().includes(q);
        const matchStation = textValue((m.stationNo || '')).toLowerCase().includes(q);
        const matchOperator = textValue((m.operator || '')).toLowerCase().includes(q);
        if (!matchId && !matchName && !matchBrand && !matchModel && !matchStation && !matchOperator) {
          return false;
        }
      }

      return true;
    });
  }, [baseMachines, selectedZone, selectedLine, selectedStatus, searchQuery]);

  // Overall counts
  const totalCount = baseMachines.length;
  const activeCount = baseMachines.filter((m) => m.status === 'ACTIVE').length;
  const idleCount = baseMachines.filter((m) => m.status === 'IDLE' || m.status === 'BUFFER').length;
  const breakdownCount = baseMachines.filter(
    (m) => m.status === 'BREAKDOWN' || m.status === 'UNDER_MAINTENANCE'
  ).length;

  return (
    <div className="space-y-6 pb-16 animate-fade-in max-w-7xl mx-auto">
      {/* ─── 1. TOP HEADER & QUICK STATS ─── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-teal-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                Senior Mechanic Asset Log
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800 flex items-center gap-1">
                <Radio className="w-2.5 h-2.5 text-indigo-600 animate-pulse" />
                Live Machine Dispatch
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Change machine Active ⇋ Idle status instantly on Enter &amp; monitor the 8 Zones × 8 Lines availability report
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setSoundEnabled((prev) => !prev)}
            title={soundEnabled ? 'Mute audio feedback chime' : 'Enable audio feedback chime'}
            className={`p-2 rounded-xl text-xs font-semibold transition border cursor-pointer flex items-center gap-1.5 ${
              soundEnabled
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                : 'bg-slate-100 border-slate-200 text-slate-500'
            }`}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span className="hidden sm:inline">{soundEnabled ? 'Sound On' : 'Muted'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (selectedZone !== 'ALL') setExtraZone(selectedZone);
              if (selectedLine !== 'ALL') setExtraLine(selectedLine);
              setIsAddExtraModalOpen(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Extra Machine</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCameraModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>Camera Scanner</span>
          </button>
        </div>
      </div>

      {/* ─── 2. INSTANT MACHINE DISPATCH STATION (REPLACED TOGGLE WITH DUAL DISPATCH & ACTION SELECTOR) ─── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-5 text-white shadow-xl shadow-indigo-950/25 border border-indigo-500/20">
        <div className="relative z-10 space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400/50" />
              <h2 className="text-sm sm:text-base font-extrabold tracking-tight">
                Instant Machine Dispatch Station
              </h2>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/20">
                Direct Dispatch
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-indigo-200/80">
              <span>Action on <kbd className="px-1.5 py-0.5 bg-white/10 rounded font-mono text-[10px] text-white">Enter ↵</kbd>:</span>
              <select
                value={scanActionTarget}
                onChange={(e) => setScanActionTarget(e.target.value as 'ACTIVE' | 'IDLE')}
                className="bg-white/10 hover:bg-white/15 border border-white/20 rounded-lg px-2.5 py-1 text-xs font-bold text-white outline-none cursor-pointer focus:ring-2 focus:ring-indigo-400"
              >
                <option value="ACTIVE" className="bg-slate-900 text-emerald-400 font-bold">🟢 Move to active</option>
                <option value="IDLE" className="bg-slate-900 text-amber-400 font-bold">🟡 idle</option>
              </select>
            </div>
          </div>

          <form onSubmit={handleScanSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-indigo-300">
                <QrCode className="w-5 h-5" />
              </div>
              <input
                ref={scanInputRef}
                type="text"
                value={scanInput}
                onChange={(e) => setScanInput(e.target.value)}
                placeholder="Scan QR or Enter Machine ID (e.g. MC-Zone1-L01-101)..."
                autoFocus
                autoComplete="off"
                className="w-full pl-11 pr-24 py-3 bg-white/10 hover:bg-white/15 focus:bg-white text-white focus:text-slate-900 placeholder:text-indigo-200/60 rounded-xl border border-white/20 focus:border-white focus:ring-4 focus:ring-indigo-500/30 outline-none text-sm font-mono font-bold transition shadow-inner"
              />
              <div className="absolute inset-y-0 right-0 pr-2 flex items-center">
                <span className="px-2 py-1 rounded-md text-[10px] font-extrabold bg-indigo-500/40 text-indigo-100 border border-indigo-400/30 pointer-events-none">
                  ↵ Enter ({scanActionTarget === 'ACTIVE' ? 'Active' : 'Idle'})
                </span>
              </div>
            </div>

            {/* Direct Dual Action Buttons replacing the old Toggle button */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={!scanInput.trim()}
                onClick={() => handleDispatchById(scanInput, 'ACTIVE')}
                title="Immediately move this machine to active production"
                className="flex-1 sm:flex-initial px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs transition shadow-md shadow-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Move to active</span>
              </button>

              <button
                type="button"
                disabled={!scanInput.trim()}
                onClick={() => handleDispatchById(scanInput, 'IDLE')}
                title="Immediately set this machine to idle standby"
                className="flex-1 sm:flex-initial px-4 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-black text-xs transition shadow-md shadow-amber-400/20 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-1.5"
              >
                <PauseCircle className="w-4 h-4" />
                <span>idle</span>
              </button>
            </div>
          </form>

          {/* Machine Live Match Preview Chip */}
          {scanInput.trim() && (
            <div className="text-xs">
              {matchedMachine ? (
                <div className="p-2.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 flex flex-wrap items-center justify-between gap-2 animate-fade-in">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-white text-xs px-2 py-0.5 rounded bg-white/10">
                      {matchedMachine.id}
                    </span>
                    <span className="text-indigo-200 font-medium text-xs">
                      {matchedMachine.name || `${matchedMachine.brand} ${matchedMachine.typeName || matchedMachine.type}`}
                    </span>
                    <span className="text-[11px] text-slate-300">
                      ({getMachineZone(matchedMachine)} • {getMachineLine(matchedMachine)})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-300">Current:</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                        matchedMachine.status === 'ACTIVE'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                          : matchedMachine.status === 'IDLE' || matchedMachine.status === 'BUFFER'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-400/30'
                          : 'bg-rose-500/20 text-rose-300 border border-rose-400/30'
                      }`}
                    >
                      {matchedMachine.status}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex flex-wrap items-center justify-between gap-2 text-slate-300 animate-fade-in">
                  <span className="text-xs">
                    Machine ID <span className="font-mono font-bold text-white">"{scanInput.trim()}"</span> is not currently registered.
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setExtraMachineId(scanInput.trim().toUpperCase());
                      setIsAddExtraModalOpen(true);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add as Extra Machine to Zone</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Last Dispatched Confirmation Flash Banner */}
          {lastToggledResult && !scanInput.trim() && (
            <div className="p-3 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 flex items-center justify-between gap-3 text-xs animate-fade-in">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                    lastToggledResult.newStatus === 'ACTIVE'
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-amber-400 text-slate-950'
                  }`}
                >
                  {lastToggledResult.newStatus === 'ACTIVE' ? 'ACT' : 'IDL'}
                </div>
                <div>
                  <span className="font-bold text-white font-mono mr-2">
                    {lastToggledResult.machineId}
                  </span>
                  <span className="text-slate-300">
                    dispatched to{' '}
                    <span
                      className={`font-black ${
                        lastToggledResult.newStatus === 'ACTIVE'
                          ? 'text-emerald-400'
                          : 'text-amber-300'
                      }`}
                    >
                      {lastToggledResult.newStatus === 'ACTIVE' ? 'Active' : 'Idle'}
                    </span>
                    {lastToggledResult.prevStatus && (
                      <span className="text-slate-400 ml-1.5">
                        (was {lastToggledResult.prevStatus})
                      </span>
                    )}
                  </span>
                </div>
              </div>
              <div className="text-[10px] text-indigo-200/80 font-mono">
                {lastToggledResult.timestamp.toLocaleTimeString()}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── 3. THE 8-ZONE × 8-LINE AVAILABILITY REPORT WIDGET ─── */}
      <LineAvailabilityWidget
        machines={baseMachines}
        selectedZone={selectedZone === 'ALL' ? 'Zone 1' : selectedZone}
        selectedLine={selectedLine}
        onSelectZoneLine={(zone, line) => {
          setSelectedZone(zone);
          setSelectedLine(line);
        }}
        onQuickToggleMachine={(id) => {
          const mach = baseMachines.find((m) => m.id === id);
          if (mach) handleRowToggle(mach);
        }}
        onAddExtraMachine={(zone) => {
          setExtraZone(zone);
          if (selectedLine !== 'ALL') setExtraLine(selectedLine);
          setIsAddExtraModalOpen(true);
        }}
      />

      {/* ─── 4. ASSET LOG TABS & CONTROLS ─── */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center justify-between border-b border-slate-100 p-3 sm:px-5 gap-3 bg-slate-50/50">
          <div className="flex items-center gap-1 bg-slate-200/70 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('LEDGER')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'LEDGER'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Asset Status Ledger ({filteredMachines.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('LOGS')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'LOGS'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Status Activity Logs ({scopedAssetLogs.length})</span>
            </button>
          </div>

          {/* Quick Filters / Search */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Unit / Plant Scope Control */}
            {isAdmin ? (
              <select
                value={selectedUnit}
                onChange={(e) => setSelectedUnit(e.target.value)}
                className="px-2.5 py-1.5 text-xs font-bold bg-white border border-slate-200 rounded-xl text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                title="Admin facility switcher"
              >
                <option value="ALL">All Plants</option>
                <option value="UNIT - 1">UNIT - 1</option>
                <option value="UNIT-2">UNIT-2</option>
              </select>
            ) : (
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-200/80 rounded-xl text-xs font-bold text-indigo-700"
                title="Your assigned facility unit"
              >
                <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                <span>{effectiveUnit || user?.unit || 'Assigned Plant'}</span>
              </div>
            )}

            {/* Zone Filter */}
            <select
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value as any)}
              className="px-2.5 py-1.5 text-xs font-bold bg-white border border-slate-200 rounded-xl text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="ALL">All 8 Zones</option>
              {CLIENT_ZONES.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>

            {/* Line Filter */}
            <select
              value={selectedLine}
              onChange={(e) => setSelectedLine(e.target.value as any)}
              className="px-2.5 py-1.5 text-xs font-bold bg-white border border-slate-200 rounded-xl text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="ALL">All 8 Lines</option>
              {CLIENT_LINES.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as any)}
              className="px-2.5 py-1.5 text-xs font-bold bg-white border border-slate-200 rounded-xl text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">🟢 Active Only</option>
              <option value="IDLE">🟡 Idle / Standby Only</option>
              <option value="BREAKDOWN">🔴 Breakdown Only</option>
            </select>

            {/* Text Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search machine ID, model..."
                className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 outline-none w-44"
              />
            </div>
          </div>
        </div>

        {/* ─── BATCH ACTION BAR (if rows selected) ─── */}
        {selectedMachineIds.length > 0 && (
          <div className="p-3 bg-indigo-50 border-b border-indigo-100 flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="font-bold text-indigo-900">
              {selectedMachineIds.length} machines selected:
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleBatchStatus('ACTIVE')}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-xs transition cursor-pointer"
              >
                Set All to Active 🟢
              </button>
              <button
                type="button"
                onClick={() => handleBatchStatus('IDLE')}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-900 rounded-lg font-bold shadow-xs transition cursor-pointer"
              >
                Set All to Idle 🟡
              </button>
              <button
                type="button"
                onClick={() => setSelectedMachineIds([])}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg font-bold transition cursor-pointer"
              >
                Deselect
              </button>
            </div>
          </div>
        )}

        {/* ─── TAB 1: ASSET STATUS LEDGER TABLE ─── */}
        {activeTab === 'LEDGER' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-3 px-3 w-10 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedMachineIds.length === filteredMachines.length) {
                          setSelectedMachineIds([]);
                        } else {
                          setSelectedMachineIds(filteredMachines.map((m) => m.id));
                        }
                      }}
                      className="cursor-pointer text-slate-400 hover:text-slate-700"
                    >
                      {selectedMachineIds.length > 0 &&
                      selectedMachineIds.length === filteredMachines.length ? (
                        <CheckSquare className="w-4 h-4 text-indigo-600" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="py-3 px-3">Machine / Asset ID</th>
                  <th className="py-3 px-3">Zone &amp; Line</th>
                  <th className="py-3 px-3">Brand &amp; Type</th>
                  <th className="py-3 px-3">Current Status</th>
                  <th className="py-3 px-3 text-center">Status Action (Idle / Move to active)</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMachines.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">
                      No machines match the selected filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredMachines.map((machine) => {
                    const zone = getMachineZone(machine);
                    const line = getMachineLine(machine);
                    const isSelected = selectedMachineIds.includes(machine.id);
                    const isActive = machine.status === 'ACTIVE';
                    const isIdle = machine.status === 'IDLE' || machine.status === 'BUFFER';
                    const isBreakdown =
                      machine.status === 'BREAKDOWN' || machine.status === 'UNDER_MAINTENANCE';

                    return (
                      <tr
                        key={machine.id}
                        className={`hover:bg-slate-50/80 transition ${
                          isSelected ? 'bg-indigo-50/40' : ''
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedMachineIds((prev) =>
                                prev.includes(machine.id)
                                  ? prev.filter((id) => id !== machine.id)
                                  : [...prev, machine.id]
                              );
                            }}
                            className="cursor-pointer text-slate-400 hover:text-slate-700"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-indigo-600" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </td>

                        {/* ID & Name */}
                        <td className="py-3 px-3">
                          <div className="font-mono font-bold text-slate-900 text-sm">
                            {machine.id}
                          </div>
                          <div className="text-[11px] text-slate-500 line-clamp-1">
                            {machine.name || `${machine.brand} ${machine.model}`}
                          </div>
                        </td>

                        {/* Zone & Line */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                              {zone}
                            </span>
                            <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                              {line}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {machine.stationNo || 'Station Unassigned'}
                          </div>
                        </td>

                        {/* Brand & Type */}
                        <td className="py-3 px-3">
                          <span className="font-bold text-slate-800">{machine.brand}</span>
                          <span className="text-slate-400 mx-1">•</span>
                          <span className="text-slate-600">
                            {machine.typeName || machine.type}
                          </span>
                        </td>

                        {/* Status Badge */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          {isActive ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                              ACTIVE
                            </span>
                          ) : isIdle ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-200">
                              <span className="w-2 h-2 rounded-full bg-amber-500" />
                              IDLE / STANDBY
                            </span>
                          ) : isBreakdown ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-800 border border-rose-200">
                              <span className="w-2 h-2 rounded-full bg-rose-500" />
                              BREAKDOWN
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                              {machine.status}
                            </span>
                          )}
                        </td>

                        {/* Status Dropdown: "idle" and "Move to active" */}
                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <div className="inline-flex items-center justify-center">
                            <div className="relative inline-block text-left">
                              <select
                                value={isActive ? 'ACTIVE' : isIdle ? 'IDLE' : machine.status}
                                onChange={async (e) => {
                                  const val = e.target.value as 'ACTIVE' | 'IDLE';
                                  await handleStatusChange(machine, val);
                                }}
                                aria-label={`Select status for machine ${machine.id}`}
                                className={`appearance-none pl-3 pr-8 py-1.5 rounded-xl text-xs font-black border transition cursor-pointer outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs font-sans ${
                                  isActive
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 hover:border-emerald-400'
                                    : isBreakdown
                                    ? 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100 hover:border-rose-400'
                                    : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 hover:border-amber-400'
                                }`}
                              >
                                <option value="ACTIVE" className="bg-white text-slate-900 font-bold py-1">
                                  Move to active
                                </option>
                                <option value="IDLE" className="bg-white text-slate-900 font-bold py-1">
                                  idle
                                </option>
                                {isBreakdown && (
                                  <option value={machine.status} disabled className="bg-white text-rose-600 font-bold py-1">
                                    Breakdown ({machine.status})
                                  </option>
                                )}
                              </select>
                              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                                <ChevronDown className="w-3.5 h-3.5" />
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Row Actions */}
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setMachineToEdit(machine);
                                setIsEditModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg text-xs font-bold transition cursor-pointer"
                              title={`Edit asset specifications for ${machine.id}`}
                            >
                              <Pencil className="w-3 h-3" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setTargetMachineForReassign(machine);
                                setReassignZone(zone);
                                setReassignLine(line);
                                setReassignStation(machine.stationNo || 'Station 01');
                                setIsReassignModalOpen(true);
                              }}
                              className="px-2.5 py-1 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg text-xs font-semibold transition cursor-pointer"
                            >
                              Move / Reassign
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : (
          /* ─── TAB 2: STATUS ACTIVITY LOG AUDIT TRAIL ─── */
          <div className="p-4 sm:p-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 text-sm">
                  Recent Machine Status Change Ledger
                </h3>
                <span className="text-xs text-slate-500 font-medium">
                  Showing latest {scopedAssetLogs.length} logged events
                </span>
              </div>

              {scopedAssetLogs.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  No status change logs recorded yet for {effectiveUnit || 'your facility'}. Toggle a machine above to create the first log entry!
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {scopedAssetLogs.map((log) => {
                    const isToActive = log.action === 'IDLE_TO_ACTIVE';
                    const isToIdle = log.action === 'ACTIVE_TO_IDLE';

                    return (
                      <div
                        key={log.id}
                        className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50/70 p-2 rounded-xl transition"
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                              isToActive
                                ? 'bg-emerald-100 text-emerald-800'
                                : isToIdle
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-indigo-100 text-indigo-800'
                            }`}
                          >
                            <ArrowRightLeft className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono font-bold text-slate-900 text-xs">
                                {log.machineId}
                              </span>
                              <span className="text-[11px] font-bold text-slate-600">
                                {log.machineName || log.machineType}
                              </span>
                              <span className="text-[10px] px-2 py-0.2 rounded-full font-bold bg-slate-100 text-slate-700">
                                {log.zone} • {log.line}
                              </span>
                            </div>
                            <div className="text-xs text-slate-600 mt-0.5">
                              Status changed from{' '}
                              <span className="font-bold text-slate-800">{log.previousStatus}</span>{' '}
                              →{' '}
                              <span
                                className={`font-black ${
                                  log.newStatus === 'ACTIVE'
                                    ? 'text-emerald-600'
                                    : 'text-amber-600'
                                }`}
                              >
                                {log.newStatus}
                              </span>
                              {log.notes && (
                                <span className="text-slate-400 ml-1.5">— {log.notes}</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0 text-xs text-slate-400 flex sm:flex-col items-center sm:items-end justify-between sm:justify-center">
                          <div className="font-medium text-slate-700 flex items-center gap-1">
                            <UserCheck className="w-3 h-3 text-indigo-600" />
                            {log.changedBy}
                          </div>
                          <div className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" />
                            {new Date(log.changedAt).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── MODAL: REASSIGN MACHINE ZONE & LINE ─── */}
      {isReassignModalOpen && targetMachineForReassign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Reassign Zone &amp; Line Location
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsReassignModalOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-200 text-slate-500 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleReassignSubmit} className="p-5 space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <span className="block text-slate-400 text-[10px] uppercase font-bold">Selected Machine</span>
                <span className="font-mono font-bold text-slate-900 text-sm">{targetMachineForReassign.id}</span>
                <span className="block text-slate-600 mt-0.5">{targetMachineForReassign.name || targetMachineForReassign.brand}</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Destination Zone (Client Facility 1–8) *
                </label>
                <select
                  value={reassignZone}
                  onChange={(e) => setReassignZone(e.target.value as ClientZone)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {CLIENT_ZONES.map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Destination Line (Lines 01–08) *
                </label>
                <select
                  value={reassignLine}
                  onChange={(e) => setReassignLine(e.target.value as ClientLine)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {CLIENT_LINES.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Station / Bay Number
                </label>
                <input
                  type="text"
                  value={reassignStation}
                  onChange={(e) => setReassignStation(e.target.value)}
                  placeholder="e.g. Station 04"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-xl font-medium text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsReassignModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition cursor-pointer"
                >
                  Save Location
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── LIVE CAMERA QR SCANNER MODAL ─── */}
      <CameraScannerModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
      />

      {/* ─── EDIT ASSET MODAL ─── */}
      <EditAssetModal
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setMachineToEdit(null);
        }}
        asset={machineToEdit}
        onSave={(updated) => {
          setMachines((prev) =>
            prev.map((m) => (m.id === updated.id || m.id === machineToEdit?.id ? updated : m))
          );
        }}
      />

      {/* ─── MODAL: ADD EXTRA MACHINE TO ZONE ─── */}
      {isAddExtraModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-white">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Add Extra Machine to Zone
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Adds extra machine capacity directly to the zone total &amp; active count
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddExtraModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-500 cursor-pointer transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddExtraMachineSubmit} className="p-5 space-y-4">
              <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-100 text-xs text-indigo-900 flex items-center gap-2.5">
                <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
                <div>
                  When added with status <strong className="text-emerald-700">Move to active</strong>, it automatically increments both the <strong>total machine count</strong> and <strong>active machine count</strong> for the designated zone.
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Target Zone *
                  </label>
                  <select
                    value={extraZone}
                    onChange={(e) => setExtraZone(e.target.value as ClientZone)}
                    className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-300 rounded-xl text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {CLIENT_ZONES.map((z) => (
                      <option key={z} value={z}>
                        {z}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Target Line *
                  </label>
                  <select
                    value={extraLine}
                    onChange={(e) => setExtraLine(e.target.value as ClientLine)}
                    className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-300 rounded-xl text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {CLIENT_LINES.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Machine / Asset ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={extraMachineId}
                    onChange={(e) => setExtraMachineId(e.target.value)}
                    placeholder={`e.g. MC-${extraZone.replace('Zone ', 'Z0')}-${extraLine.replace('Line ', 'L')}-EXT01`}
                    className="w-full px-3 py-2 text-xs font-mono font-bold bg-white border border-slate-300 rounded-xl text-slate-800 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    Leave blank to auto-generate unique ID
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Initial Status *
                  </label>
                  <select
                    value={extraMachineStatus}
                    onChange={(e) => setExtraMachineStatus(e.target.value as MachineStatus)}
                    className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-300 rounded-xl text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="ACTIVE">🟢 Move to active (Increments Active Count)</option>
                    <option value="IDLE">🟡 idle (Increments Idle Count)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Brand / Manufacturer *
                  </label>
                  <select
                    value={extraMachineBrand}
                    onChange={(e) => setExtraMachineBrand(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-300 rounded-xl text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {['Juki', 'Jack', 'Brother', 'Yamato', 'Pegasus', 'Siruba', 'Singer', 'Supreme'].map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Machine Model
                  </label>
                  <input
                    type="text"
                    value={extraMachineModel}
                    onChange={(e) => setExtraMachineModel(e.target.value)}
                    placeholder="e.g. DDL-9000C, AZ-8000G"
                    className="w-full px-3 py-2 text-xs font-medium bg-white border border-slate-300 rounded-xl text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Machine Type *
                </label>
                <select
                  value={extraMachineType}
                  onChange={(e) => setExtraMachineType(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-bold bg-white border border-slate-300 rounded-xl text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="Single Needle Lockstitch">Single Needle Lockstitch (SNLS)</option>
                  <option value="4-Thread High Speed Overlock">4-Thread High Speed Overlock (O/L)</option>
                  <option value="Cylinder Bed Interlock Flatlock">Cylinder Bed Interlock Flatlock (F/L)</option>
                  <option value="Electronic Buttonhole Indexer">Electronic Buttonhole Indexer (Kaja)</option>
                  <option value="Electronic Bartack Direct-Drive">Electronic Bartack Direct-Drive</option>
                  <option value="Twin Needle Lockstitch">Twin Needle Lockstitch (DNLS)</option>
                  <option value="Button Sewing Machine">Button Sewing Machine</option>
                  <option value="Feed-Off-The-Arm Flatlock">Feed-Off-The-Arm Flatlock</option>
                </select>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddExtraModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Extra Machine to {extraZone}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AssetLogPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-3">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs font-semibold text-slate-600">Loading Asset Log...</p>
          </div>
        </div>
      }
    >
      <AssetLogContent />
    </Suspense>
  );
}
