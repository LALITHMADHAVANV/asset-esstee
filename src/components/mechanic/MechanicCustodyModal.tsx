'use client';

import React, { useState } from 'react';
import {
  Wrench,
  Package,
  ShieldAlert,
  Clock,
  MapPin,
  X,
  Phone,
  Gauge,
  Check,
} from 'lucide-react';
import {
  MechanicDuty,
  MechanicToolCustodyItem,
  MechanicDrawnPart,
} from '@/lib/constants/mechanics';
import { useToast } from '@/context/ToastContext';

interface MechanicCustodyModalProps {
  mechanic: MechanicDuty | null;
  isOpen: boolean;
  onClose: () => void;
}

export function MechanicCustodyModal({
  mechanic,
  isOpen,
  onClose,
}: MechanicCustodyModalProps) {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'TOOLS' | 'DRAWN_PARTS' | 'TOOLBOX' | 'INCIDENTS'>('TOOLS');

  if (!isOpen || !mechanic) return null;

  const totalHandledTools = mechanic.checkedOutTools?.length || 0;
  const totalDrawnParts = mechanic.activePartsDrawn?.reduce((acc, p) => acc + p.quantity, 0) || 0;
  const totalStandardTools = mechanic.toolbox?.items?.length || 0;
  const totalTasks = mechanic.activeMachineTasks?.length || 0;

  const handleReturnTool = (tool: MechanicToolCustodyItem) => {
    showToast(`Tool "${tool.toolName}" checked back into Crib inventory successfully!`, 'success');
  };

  const handleConsumePart = (part: MechanicDrawnPart) => {
    showToast(`Fitted ${part.quantity} ${part.unit} of ${part.sku} to machine ${part.forMachineId}`, 'info');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header Profile Section */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-extrabold shadow-lg ${mechanic.avatarColor}`}
              >
                {mechanic.name.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/30">
                    {mechanic.id}
                  </span>
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    <span>{mechanic.status.replace('_', ' ')}</span>
                  </span>
                </div>
                <h3 className="text-xl font-bold tracking-tight text-white mt-1">
                  {mechanic.name}
                </h3>
                <p className="text-xs text-indigo-200 font-medium">
                  {mechanic.role} • {mechanic.experienceYears} Years Factory Experience
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:items-end gap-1 text-xs text-slate-300">
              <div className="flex items-center gap-1.5 text-slate-300 font-mono">
                <Phone className="w-3.5 h-3.5 text-indigo-400" />
                <span>{mechanic.phone}</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                <span>{mechanic.shift}</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-400 text-[11px] font-semibold">
                <MapPin className="w-3.5 h-3.5" />
                <span>{mechanic.assignedLines}</span>
              </div>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-white/10">
            <div className="bg-white/5 border border-white/10 p-2.5 rounded-xl">
              <span className="text-[10px] text-slate-300 uppercase tracking-wider block font-semibold">
                Special Tools Checked Out
              </span>
              <span className="text-lg font-mono font-bold text-amber-300">
                {totalHandledTools} Devices
              </span>
            </div>
            <div className="bg-white/5 border border-white/10 p-2.5 rounded-xl">
              <span className="text-[10px] text-slate-300 uppercase tracking-wider block font-semibold">
                Active Drawn Spares
              </span>
              <span className="text-lg font-mono font-bold text-emerald-300">
                {totalDrawnParts} Units
              </span>
            </div>
            <div className="bg-white/5 border border-white/10 p-2.5 rounded-xl">
              <span className="text-[10px] text-slate-300 uppercase tracking-wider block font-semibold">
                Standard Issue Hand Tools
              </span>
              <span className="text-lg font-mono font-bold text-indigo-300">
                {totalStandardTools} Items
              </span>
            </div>
            <div className="bg-white/5 border border-white/10 p-2.5 rounded-xl">
              <span className="text-[10px] text-slate-300 uppercase tracking-wider block font-semibold">
                Attending Incidents
              </span>
              <span className="text-lg font-mono font-bold text-rose-400">
                {totalTasks} Active Work Orders
              </span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 text-xs font-bold bg-slate-50 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('TOOLS')}
            className={`flex-1 min-w-[170px] py-3.5 text-center border-b-2 transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'TOOLS'
                ? 'border-indigo-600 text-indigo-700 bg-white font-extrabold shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Gauge className="w-4 h-4 text-indigo-600" />
            <span>1. Checked-Out Special Tools ({totalHandledTools})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('DRAWN_PARTS')}
            className={`flex-1 min-w-[170px] py-3.5 text-center border-b-2 transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'DRAWN_PARTS'
                ? 'border-emerald-600 text-emerald-700 bg-white font-extrabold shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Package className="w-4 h-4 text-emerald-600" />
            <span>2. Drawn Crib Spares ({mechanic.activePartsDrawn?.length || 0})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('TOOLBOX')}
            className={`flex-1 min-w-[170px] py-3.5 text-center border-b-2 transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'TOOLBOX'
                ? 'border-amber-600 text-amber-700 bg-white font-extrabold shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Wrench className="w-4 h-4 text-amber-600" />
            <span>3. Toolbox Inventory ({totalStandardTools})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('INCIDENTS')}
            className={`flex-1 min-w-[170px] py-3.5 text-center border-b-2 transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'INCIDENTS'
                ? 'border-rose-600 text-rose-700 bg-white font-extrabold shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <ShieldAlert className="w-4 h-4 text-rose-600" />
            <span>4. Floor Incidents &amp; Tasks ({totalTasks})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* TAB 1: CHECKED OUT SPECIAL TOOLS */}
          {activeTab === 'TOOLS' && (
            <div className="space-y-4 animate-in fade-in duration-100">
              <div className="flex items-center justify-between text-xs text-slate-500 pb-1">
                <span>
                  High-precision calibration instruments &amp; specialized power tools currently logged out by {mechanic.name}:
                </span>
                <span className="font-semibold text-slate-700">
                  Tool Crib Custody Register
                </span>
              </div>

              {(!mechanic.checkedOutTools || mechanic.checkedOutTools.length === 0) ? (
                <div className="p-8 bg-slate-50 rounded-2xl border border-slate-200 text-center text-slate-500 text-xs">
                  No specialized tools currently checked out from crib.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {mechanic.checkedOutTools.map((tool) => (
                    <div
                      key={tool.id}
                      className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-xs transition space-y-3 relative group"
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                              {tool.id}
                            </span>
                            <span className="font-mono text-[10px] text-slate-500">
                              S/N: {tool.serialNo}
                            </span>
                          </div>
                          <h4 className="text-xs font-bold text-slate-900 mt-1">
                            {tool.toolName}
                          </h4>
                          <span className="inline-block text-[10px] font-semibold text-slate-500">
                            Category: {tool.category.replace('_', ' ')}
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          {tool.condition.replace('_', ' ')}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100 leading-relaxed">
                        <b>Purpose:</b> {tool.purpose}
                      </p>

                      <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-500 flex items-center justify-between">
                        <span className="flex items-center gap-1 font-medium">
                          <MapPin className="w-3 h-3 text-slate-400" />
                          <span>{tool.location}</span>
                        </span>
                        <span className="flex items-center gap-1 font-mono text-slate-600 font-semibold">
                          <Clock className="w-3 h-3 text-amber-500" />
                          <span>Due: {tool.returnDue}</span>
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleReturnTool(tool)}
                        className="w-full py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 rounded-lg text-xs font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Confirm Return to Tool Crib</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: DRAWN CRIB SPARES */}
          {activeTab === 'DRAWN_PARTS' && (
            <div className="space-y-4 animate-in fade-in duration-100">
              <div className="flex items-center justify-between text-xs text-slate-500 pb-1">
                <span>
                  Spare parts and consumables requisitioned from store currently in technician&apos;s active custody for line servicing:
                </span>
                <span className="font-semibold text-slate-700">
                  Floor Allocation
                </span>
              </div>

              {(!mechanic.activePartsDrawn || mechanic.activePartsDrawn.length === 0) ? (
                <div className="p-8 bg-slate-50 rounded-2xl border border-slate-200 text-center text-slate-500 text-xs">
                  No spare parts currently drawn.
                </div>
              ) : (
                <div className="bg-white rounded-lg border border-slate-300 shadow-2xs overflow-hidden">
                  <table className="w-full text-left border-collapse border border-slate-300 text-xs">
                    <thead className="sticky top-0 bg-slate-100 text-slate-700 font-bold uppercase text-[10px] tracking-wider border-b border-slate-300 select-none">
                      <tr>
                        <th className="py-2 px-3 bg-slate-100 border-r border-b border-slate-300 text-center w-10 text-slate-500 font-mono">#</th>
                        <th className="py-2 px-3 bg-slate-100 border-r border-b border-slate-300">Part SKU &amp; Name</th>
                        <th className="py-2 px-3 bg-slate-100 border-r border-b border-slate-300">Qty in Custody</th>
                        <th className="py-2 px-3 bg-slate-100 border-r border-b border-slate-300">Drawn At</th>
                        <th className="py-2 px-3 bg-slate-100 border-r border-b border-slate-300">Target Machine</th>
                        <th className="py-2 px-3 bg-slate-100 border-r border-b border-slate-300">Floor Line</th>
                        <th className="py-2 px-3 bg-slate-100 border-b border-slate-300 text-right">Floor Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mechanic.activePartsDrawn.map((part, idx) => (
                        <tr key={idx} className="hover:bg-blue-50/60 even:bg-slate-50/40 transition">
                          <td className="py-1.5 px-3 border-r border-b border-slate-200 text-center text-[10px] font-mono text-slate-400 bg-slate-50/50">{idx + 1}</td>
                          <td className="py-1.5 px-3 border-r border-b border-slate-200">
                            <div className="font-bold text-slate-900">{part.partName}</div>
                            <div className="text-[10px] font-mono text-indigo-700">{part.sku}</div>
                          </td>
                          <td className="py-1.5 px-3 border-r border-b border-slate-200">
                            <span className="text-xs font-bold font-mono text-slate-900">
                              {part.quantity}
                            </span>
                            <span className="text-slate-500 text-[10px]"> {part.unit}</span>
                          </td>
                          <td className="py-1.5 px-3 border-r border-b border-slate-200 text-[11px] font-mono text-slate-600">
                            {part.drawnAt}
                          </td>
                          <td className="py-1.5 px-3 border-r border-b border-slate-200 font-mono font-bold text-indigo-700">
                            {part.forMachineId}
                          </td>
                          <td className="py-1.5 px-3 border-r border-b border-slate-200 text-emerald-700 font-semibold">
                            {part.line}
                          </td>
                          <td className="py-1.5 px-3 border-b border-slate-200 text-right">
                            <button
                              type="button"
                              onClick={() => handleConsumePart(part)}
                              className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded text-xs font-semibold transition cursor-pointer"
                            >
                              Fitted to M/C
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          {/* TAB 3: TOOLBOX INVENTORY */}
          {activeTab === 'TOOLBOX' && (
            <div className="space-y-4 animate-in fade-in duration-100">
              <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-indigo-50 border border-amber-200/80 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-800 block">
                    Permanent Custody Kit
                  </span>
                  <h4 className="text-sm font-bold text-slate-900">
                    {mechanic.toolbox?.kitName || 'Standard Toolkit'}
                  </h4>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Kit Code: <span className="font-mono font-bold text-indigo-700">{mechanic.toolbox?.kitCode}</span> • Last Tool Audit: <span className="font-mono font-medium text-slate-700">{mechanic.toolbox?.lastAudited}</span>
                  </p>
                </div>
                <span className="px-3 py-1 bg-amber-100 text-amber-900 rounded-full text-xs font-bold border border-amber-300">
                  {mechanic.toolbox?.items?.length || 0} Standard Tools
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {(mechanic.toolbox?.items || []).map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-white rounded-xl border border-slate-200 flex items-center gap-3 shadow-2xs hover:border-indigo-300 transition"
                  >
                    <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                      {idx + 1}
                    </div>
                    <span className="text-xs font-medium text-slate-800">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: INCIDENTS & MACHINE TASKS */}
          {activeTab === 'INCIDENTS' && (
            <div className="space-y-4 animate-in fade-in duration-100">
              <div className="flex items-center justify-between text-xs text-slate-500 pb-1">
                <span>
                  Active breakdown work orders and preventive maintenance currently assigned to {mechanic.name}:
                </span>
                <span className="font-semibold text-slate-700">Live Repair Queue</span>
              </div>

              {(!mechanic.activeMachineTasks || mechanic.activeMachineTasks.length === 0) ? (
                <div className="p-8 bg-slate-50 rounded-2xl border border-slate-200 text-center text-slate-500 text-xs">
                  No active incidents currently assigned. Mechanic is on floor standby.
                </div>
              ) : (
                <div className="space-y-3">
                  {mechanic.activeMachineTasks.map((task) => (
                    <div
                      key={task.ticketId}
                      className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs hover:shadow-xs transition space-y-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {task.ticketId}
                          </span>
                          <span className="font-mono text-xs font-bold text-indigo-700">
                            Machine: {task.machineId}
                          </span>
                          <span className="text-xs font-semibold text-emerald-700">
                            ({task.line})
                          </span>
                        </div>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            task.urgency === 'CRITICAL'
                              ? 'bg-rose-100 text-rose-700 border border-rose-200 urgent-pulse'
                              : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {task.urgency}
                        </span>
                      </div>

                      <p className="text-xs font-semibold text-slate-800">
                        {task.fault}
                      </p>

                      <div className="text-[10px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
                        <span className="flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>Started: {task.startedAt}</span>
                        </span>
                        <span className="text-indigo-600 font-semibold">
                          Attending on Floor
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Action */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Mechanic Specialty: <span className="font-bold text-slate-800">{mechanic.specialty}</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
}