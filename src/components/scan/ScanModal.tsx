'use client';

import { textValue } from '@/lib/textValue';

import React, { useState, useEffect, useMemo } from 'react';
import { QrCode, X, AlertTriangle, ArrowRightLeft, Radio, Camera, UserCheck } from 'lucide-react';
import { Machine, FloorLine, RepairUrgency } from '@/types/cmms';
import { subscribeMachines, createBreakdownTicket, relocateMachine } from '@/lib/services/cmmsService';
import { formatAssetLocation } from '@/lib/formatters';
import { useToast } from '@/context/ToastContext';
import { useAuth } from '@/context/AuthContext';
import { matchesUnit } from '@/lib/constants/units';

interface ScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedMachineId?: string;
  onOpenLiveScanner?: () => void;
}

export function ScanModal({
  isOpen,
  onClose,
  preselectedMachineId,
  onOpenLiveScanner,
}: ScanModalProps) {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [selectedMachineId, setSelectedMachineId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'report' | 'relocate'>('report');

  // Report fault fields
  const [faultType, setFaultType] = useState<string>(
    'Skipping Stitches / Looper Timing Misalignment'
  );
  const [urgency, setUrgency] = useState<RepairUrgency>('CRITICAL');
  const [faultNotes, setFaultNotes] = useState<string>('');
  const [selectedMechanic, setSelectedMechanic] = useState<string>('');
  const [registeredTechs, setRegisteredTechs] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Relocate fields
  const [targetLine, setTargetLine] = useState<FloorLine>('Line 01');
  const [targetStation, setTargetStation] = useState<string>('Station 01');
  const [relocateReason, setRelocateReason] = useState<string>('');

  const { showToast } = useToast();
  const { user, role } = useAuth();

  // Fetch registered mechanics / technicians
  useEffect(() => {
    fetch('/api/users')
      .then((r) => r.json())
      .then((data) => {
        if (data.users && Array.isArray(data.users)) {
          const techs = data.users.filter((u: any) =>
            ['MECHANIC', 'ELECTRICIAN', 'SENIOR_MECHANIC', 'SENIOR_ELECTRICIAN'].includes(textValue((u.role || '')).toUpperCase())
          );
          setRegisteredTechs(techs);
        }
      })
      .catch(() => {});
  }, []);

  const isMechanicRole = role === 'MECHANIC' || role === 'SENIOR_MECHANIC' || role === 'ELECTRICIAN' || role === 'SENIOR_ELECTRICIAN';

  // Only show machines (category === 'MACHINE') as assets for mechanic roles
  const visibleMachines = useMemo(() => {
    if (isMechanicRole) {
      return machines.filter((m) => m.category === 'MACHINE');
    }
    return machines;
  }, [machines, isMechanicRole]);

  useEffect(() => {
    const unsub = subscribeMachines((data) => {
      setMachines(data);
      const filtered = isMechanicRole ? data.filter((m) => m.category === 'MACHINE') : data;
      if (preselectedMachineId) {
        setSelectedMachineId(preselectedMachineId);
      } else if (filtered.length > 0 && !selectedMachineId) {
        setSelectedMachineId(filtered[0].id);
      }
    });
    return () => unsub();
  }, [preselectedMachineId, selectedMachineId, isMechanicRole]);

  useEffect(() => {
    if (preselectedMachineId) {
      setSelectedMachineId(preselectedMachineId);
    }
  }, [preselectedMachineId]);

  const currentMachine = visibleMachines.find((m) => m.id === selectedMachineId) || visibleMachines[0];

  // Show all registered technicians across all units (prioritizing machine's unit first)
  const availableMechanics = useMemo(() => {
    const machineUnit = currentMachine?.unit || '';
    return [...registeredTechs].sort((a, b) => {
      const aMatches = machineUnit && matchesUnit(a.unit, machineUnit) ? 1 : 0;
      const bMatches = machineUnit && matchesUnit(b.unit, machineUnit) ? 1 : 0;
      if (aMatches !== bMatches) return bMatches - aMatches;
      const uComp = (a.unit || '').localeCompare(b.unit || '');
      if (uComp !== 0) return uComp;
      return (a.name || '').localeCompare(b.name || '');
    });
  }, [registeredTechs, currentMachine?.unit]);

  // Group technicians by unit for organized display
  const groupedMechanics = useMemo(() => {
    const groups: Record<string, any[]> = {};
    availableMechanics.forEach((m: any) => {
      const u = m.unit || 'All Units';
      if (!groups[u]) groups[u] = [];
      groups[u].push(m);
    });
    return groups;
  }, [availableMechanics]);

  if (!isOpen) return null;

  const handleBreakdownSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentMachine) return;
    setIsSubmitting(true);

    try {
      const ticketId = await createBreakdownTicket({
        machineId: currentMachine.id,
        machineType: currentMachine.typeName || currentMachine.type,
        line: (currentMachine.area || currentMachine.currentLine) as FloorLine,
        reportedAt: new Date().toISOString(),
        reportedBy: `${user?.name || 'Operator'} (${user?.title || 'Floor'})`,
        faultCategory: faultType,
        faultDetails: faultNotes.trim() || 'Reported from floor terminal via QR tag scan.',
        urgency,
        attendedBy: selectedMechanic.trim() || null,
        assignedBy: user?.name || 'Floor Dispatch',
      });

      showToast(
        selectedMechanic
          ? `Breakdown #${ticketId} dispatched and assigned to ${selectedMechanic} (${currentMachine.unit || 'Floor'})!`
          : `Breakdown #${ticketId} dispatched for ${currentMachine.id} on ${currentMachine.area || currentMachine.currentLine}!`,
        'success'
      );
      setFaultNotes('');
      setSelectedMechanic('');
      onClose();
    } catch (err) {
      showToast('Failed to dispatch breakdown ticket', 'error');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRelocateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentMachine) return;
    setIsSubmitting(true);

    try {
      await relocateMachine(
        currentMachine.id,
        targetLine,
        targetStation,
        relocateReason.trim() || 'Floor line rebalancing',
        user?.name || 'Mechanic'
      );

      showToast(
        `Machine ${currentMachine.id} relocated to ${targetLine} (${targetStation})`,
        'success'
      );
      setRelocateReason('');
      onClose();
    } catch (err) {
      showToast('Failed to relocate machine', 'error');
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="bg-slate-50 px-5 py-4 text-slate-800 flex items-center justify-between border-b border-slate-200">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold shadow-xs">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold tracking-tight text-slate-900">Floor QR Terminal</h4>
              <p className="text-[10px] text-slate-500 font-medium">Handheld Operator &amp; Mechanic Dispatcher</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onOpenLiveScanner && (
              <button
                type="button"
                onClick={onOpenLiveScanner}
                className="text-xs bg-white hover:bg-slate-100 text-amber-700 px-2.5 py-1 rounded-lg border border-slate-200 flex items-center gap-1.5 transition shadow-2xs cursor-pointer"
                title="Use Camera Scanner"
              >
                <Camera className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Camera</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 p-1 rounded-lg transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Machine Brief Card */}
          {currentMachine ? (
            <div className="bg-indigo-50/70 p-3.5 rounded-xl border border-indigo-100 text-xs flex justify-between items-center shadow-2xs">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-mono font-black uppercase tracking-wider bg-indigo-600 text-white px-2 py-0.5 rounded shadow-2xs">
                    {currentMachine.id}
                  </span>
                  <span className="font-extrabold text-indigo-950 text-xs">
                    {currentMachine.brand} {currentMachine.model}
                  </span>
                  <span className="text-[10px] text-slate-500 font-semibold">
                    ({currentMachine.typeName || currentMachine.type})
                  </span>
                </div>
                <div className="text-indigo-700 text-[11px] mt-0.5">
                  <span className="font-semibold text-slate-500">Location: </span>
                  <strong className="text-indigo-950 font-bold">{formatAssetLocation(currentMachine)}</strong>
                </div>
                {currentMachine.previousLine && (
                  <div className="text-amber-800 text-[10px] mt-1 flex items-center gap-1 font-medium bg-amber-50/90 px-2 py-0.5 rounded border border-amber-200">
                    <ArrowRightLeft className="w-2.5 h-2.5 text-amber-600 shrink-0" />
                    <span>Held before: <strong className="text-amber-950">{currentMachine.previousLine}</strong> ({currentMachine.previousStation || 'Station'})</span>
                  </div>
                )}
              </div>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  currentMachine.status === 'ACTIVE'
                    ? 'bg-emerald-100 text-emerald-800'
                    : currentMachine.status === 'BREAKDOWN'
                    ? 'bg-rose-100 text-rose-800 urgent-pulse'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {currentMachine.status}
              </span>
            </div>
          ) : (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-semibold">
              No machine asset selected. Please scan an asset QR tag.
            </div>
          )}

          {/* Action Tabs */}
          <div className="flex border-b border-slate-200 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('report')}
              className={`flex-1 py-2.5 text-center border-b-2 transition flex items-center justify-center gap-1.5 ${
                activeTab === 'report'
                  ? 'border-rose-600 text-rose-600'
                  : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
              <span>Report Fault / Breakdown</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('relocate')}
              className={`flex-1 py-2.5 text-center border-b-2 transition flex items-center justify-center gap-1.5 ${
                activeTab === 'relocate'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}
            >
              <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-500" />
              <span>Relocate Asset</span>
            </button>
          </div>

          {/* Tab 1: Breakdown Report Form */}
          {activeTab === 'report' && (
            <form onSubmit={handleBreakdownSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Specific Asset Fault or Defect *
                </label>
                <select
                  value={faultType}
                  onChange={(e) => setFaultType(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800"
                >
                  {currentMachine?.category === 'TABLE' ? (
                    <>
                      <option value="Table Top Surface Damaged / Splintered Laminate">
                        Table Top Surface Damaged / Splintered Laminate
                      </option>
                      <option value="K-Stand Iron Base Shaking / Leg Leveler Broken">
                        K-Stand Iron Base Shaking / Leg Leveler Broken
                      </option>
                      <option value="Waste Chute / Vacuum Fabric Cutout Blocked">
                        Waste Chute / Vacuum Fabric Cutout Blocked
                      </option>
                      <option value="Embedded Metric Rule Peeling or Worn Off">
                        Embedded Metric Rule Peeling or Worn Off
                      </option>
                    </>
                  ) : currentMachine?.category === 'CHAIR' ? (
                    <>
                      <option value="Hydraulic Gas-Lift Cylinder Sinking Under Weight">
                        Hydraulic Gas-Lift Cylinder Sinking Under Weight
                      </option>
                      <option value="Castor Wheel Broken / Stiff Swivel Movement">
                        Castor Wheel Broken / Stiff Swivel Movement
                      </option>
                      <option value="Lumbar Backrest Support Loose / Bolt Sheared">
                        Lumbar Backrest Support Loose / Bolt Sheared
                      </option>
                      <option value="Seat Foam Compressed / Fabric Torn">
                        Seat Foam Compressed / Fabric Torn
                      </option>
                    </>
                  ) : currentMachine?.category === 'LIGHT' || currentMachine?.type?.startsWith('LIGHT') || currentMachine?.id?.startsWith('LGT') ? (
                    <>
                      <option value="Overhead LED Driver Ballast Flickering">
                        Overhead LED Driver Ballast Flickering
                      </option>
                      <option value="Needle Task Lamp Gooseneck Loose / Drifting">
                        Needle Task Lamp Gooseneck Loose / Drifting
                      </option>
                      <option value="Complete Fixture Darkness / Phase Circuit Fault">
                        Complete Fixture Darkness / Phase Circuit Fault
                      </option>
                      <option value="Diffuser Shield Cracked / High Glare">
                        Diffuser Shield Cracked / High Glare
                      </option>
                    </>
                  ) : currentMachine?.category === 'FAN' || currentMachine?.type?.startsWith('FAN') || currentMachine?.id?.startsWith('FAN') ? (
                    <>
                      <option value="Ceiling Downrod Vibration / Blade Angle Imbalance">
                        Ceiling Downrod Vibration / Blade Angle Imbalance
                      </option>
                      <option value="Dry Bearing Grinding Noise / Screeching">
                        Dry Bearing Grinding Noise / Screeching
                      </option>
                      <option value="Motor Thermal Overload / Trips Breaker">
                        Motor Thermal Overload / Trips Breaker
                      </option>
                      <option value="Exhaust Blower Duct Blocked with Cotton Lint">
                        Exhaust Blower Duct Blocked with Cotton Lint
                      </option>
                    </>
                  ) : currentMachine?.category === 'UTILITY' ? (
                    <>
                      <option value="Steam Pressure Drop Below Operating 4 Bar">
                        Steam Pressure Drop Below Operating 4 Bar
                      </option>
                      <option value="Compressor Air Leak / Drain Solenoid Stuck">
                        Compressor Air Leak / Drain Solenoid Stuck
                      </option>
                      <option value="Pressure Relief Safety Valve Discharging">
                        Pressure Relief Safety Valve Discharging
                      </option>
                      <option value="Safety Unit Inspection Tag Expired / Low Pressure">
                        Safety Unit Inspection Tag Expired / Low Pressure
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
                        Motor / Direct-Drive Controller Error Code
                      </option>
                      <option value="Oil Reservoir Leakage">
                        Oil Reservoir Leakage / Siphon Failure
                      </option>
                      <option value="Bobbin Winder / Cutter Jam">
                        Under-bed Thread Trimmer (UTT) / Cutter Jam
                      </option>
                      <option value="Severe Noise & Vibration">
                        Severe Head Noise & Bearing Vibration
                      </option>
                    </>
                  )}
                </select>
              </div>

              {/* Assign to Mechanic Dropdown across All Units */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Assign To Technician (All Units) *</span>
                  </label>
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                    {availableMechanics.length} available
                  </span>
                </div>
                <select
                  value={selectedMechanic}
                  onChange={(e) => setSelectedMechanic(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-800 outline-none font-semibold focus:bg-white transition cursor-pointer"
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

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Severity / Production Impact *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label
                    className={`flex items-center p-2.5 rounded-lg border text-xs font-bold cursor-pointer transition ${
                      urgency === 'CRITICAL'
                        ? 'border-rose-400 bg-rose-50 text-rose-800 ring-2 ring-rose-400'
                        : 'border-slate-200 bg-slate-50 text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="scan-urgency"
                      checked={urgency === 'CRITICAL'}
                      onChange={() => setUrgency('CRITICAL')}
                      className="mr-2 text-rose-600"
                    />
                    <span>Critical (Line Stopped)</span>
                  </label>
                  <label
                    className={`flex items-center p-2.5 rounded-lg border text-xs font-bold cursor-pointer transition ${
                      urgency === 'WARNING'
                        ? 'border-amber-400 bg-amber-50 text-amber-800 ring-2 ring-amber-400'
                        : 'border-slate-200 bg-slate-50 text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="scan-urgency"
                      checked={urgency === 'WARNING'}
                      onChange={() => setUrgency('WARNING')}
                      className="mr-2 text-amber-600"
                    />
                    <span>Warning (Quality Defect)</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Floor Notes for Mechanic
                </label>
                <textarea
                  value={faultNotes}
                  onChange={(e) => setFaultNotes(e.target.value)}
                  rows={2}
                  placeholder="e.g. Breaking needle on heavy seam crossover on pocket attachment..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-600/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Radio className="w-3.5 h-3.5" />
                <span>Broadcast Breakdown to Mechanic Queue</span>
              </button>
            </form>
          )}

          {/* Tab 2: Relocate Machine Form */}
          {activeTab === 'relocate' && (
            <form onSubmit={handleRelocateSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Move To Target Line / Area *
                </label>
                <select
                  value={targetLine}
                  onChange={(e) => setTargetLine(e.target.value as FloorLine)}
                  required
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800"
                >
                  <optgroup label="🧵 Sewing Floor Lines">
                    <option value="Line 01">Sewing Floor - Line 01 (Polos / Knits)</option>
                    <option value="Line 02">Sewing Floor - Line 02 (T-Shirts Basic)</option>
                    <option value="Line 03">Sewing Floor - Line 03 (Woven Shirts)</option>
                    <option value="Line 04">Sewing Floor - Line 04 (Denim Heavy)</option>
                  </optgroup>
                  <optgroup label="🏢 Plant Departments">
                    <option value="Cutting Department">Fabric Cutting Department</option>
                    <option value="Finishing & Pressing">Finishing & Steam Pressing</option>
                    <option value="Embroidery & Printing">Embroidery & Printing Unit</option>
                    <option value="Quality & Packing">Quality Assurance & Packing</option>
                    <option value="Warehouse & Storage">Warehouse & Raw Materials</option>
                    <option value="Central Utilities & Plant">Central Utilities & Power Plant</option>
                    <option value="Maintenance Workshop">Maintenance Workshop & Tool Bay</option>
                    <option value="Scrap Bay">Decommission / Scrap Salvage Bay</option>
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Target Station Position
                </label>
                <input
                  type="text"
                  value={targetStation}
                  onChange={(e) => setTargetStation(e.target.value)}
                  placeholder="Station 06"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  Reason for Relocation
                </label>
                <input
                  type="text"
                  value={relocateReason}
                  onChange={(e) => setRelocateReason(e.target.value)}
                  placeholder="Style changeover: polo to woven shirt line balancing"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-800"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/20 transition flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>Confirm Machine Movement</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
