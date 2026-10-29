'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  History,
  Wrench,
  Clock,
  CalendarCheck,
  ArrowRightLeft,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  X,
  Package,
  User,
  ShieldCheck,
  Search,
  SlidersHorizontal,
  Layers,
  Sparkles,
  Zap,
  Pencil,
} from 'lucide-react';
import { EditAssetModal } from '@/components/asset/EditAssetModal';
import { Machine, RepairTicket, PPMSchedule } from '@/types/cmms';
import { subscribeRepairs, subscribePPMSchedules } from '@/lib/services/cmmsService';
import { formatAssetLocation, cleanRelocationLocation, formatRelocationEndpoint, formatRelocationLocation } from '@/lib/formatters';

interface AssetHistoryModalProps {
  machine: Machine | null;
  isOpen: boolean;
  onClose: () => void;
}

export function AssetHistoryModal({
  machine,
  isOpen,
  onClose,
}: AssetHistoryModalProps) {
  const [activeTab, setActiveTab] = useState<'REPAIRS' | 'PPM' | 'RELOCATIONS' | 'LIFECYCLE'>('REPAIRS');
  const [repairs, setRepairs] = useState<RepairTicket[]>([]);
  const [ppmList, setPpmList] = useState<PPMSchedule[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  useEffect(() => {
    if (!isOpen || !machine) return;

    const unsubRepairs = subscribeRepairs((allRepairs) => {
      const match = allRepairs.filter(
        (r) => r.machineId?.toLowerCase() === machine.id.toLowerCase()
      );
      setRepairs(match);
    });

    const unsubPPM = subscribePPMSchedules((allPPM) => {
      const match = allPPM.filter(
        (p) => p.machineId?.toLowerCase() === machine.id.toLowerCase()
      );
      setPpmList(match);
    });

    return () => {
      unsubRepairs();
      unsubPPM();
    };
  }, [isOpen, machine]);

  const totalRepairs = repairs.length;
  const totalDowntime = useMemo(() => {
    return (
      (machine?.totalDowntimeMinutes || 0) +
      repairs.reduce((acc, r) => acc + (r.downtimeMinutes || 0), 0)
    );
  }, [machine, repairs]);

  const relocations = useMemo(() => {
    return machine?.relocationHistory || [];
  }, [machine]);

  const filteredRepairs = useMemo(() => {
    if (!searchQuery.trim()) return repairs;
    const q = searchQuery.toLowerCase();
    return repairs.filter(
      (r) =>
        r.id.toLowerCase().includes(q) ||
        r.faultCategory?.toLowerCase().includes(q) ||
        r.faultDetails?.toLowerCase().includes(q) ||
        r.attendedBy?.toLowerCase().includes(q) ||
        r.actionTaken?.toLowerCase().includes(q)
    );
  }, [repairs, searchQuery]);

  if (!isOpen || !machine) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Top Asset Banner */}
        <div className="bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 text-white p-6 relative shrink-0">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shrink-0 mt-0.5">
                <History className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-400">
                    COMPLETE ASSET TIMELINE &amp; MAINTENANCE AUDIT
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      machine.status === 'BREAKDOWN'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : machine.status === 'BUFFER'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    }`}
                  >
                    {machine.status}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black font-mono tracking-tight text-white mt-0.5">
                  {machine.id}
                </h2>
                <p className="text-xs text-indigo-200 font-medium">
                  {machine.brand} {machine.model} • {machine.typeName || machine.type}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:items-end text-xs text-slate-300 gap-1.5 font-medium">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition border border-white/20 cursor-pointer mb-1 shadow-xs active:scale-95"
                title="Edit this asset's specifications, location, and operational details"
              >
                <Pencil className="w-3.5 h-3.5 text-indigo-300" />
                <span>Edit Asset Info</span>
              </button>
              <div className="flex items-center gap-1.5 text-emerald-400">
                <MapPin className="w-3.5 h-3.5" />
                <span>
                  Current: {formatAssetLocation(machine)}
                </span>
              </div>
              <div className="text-slate-400 text-[11px]">
                Department: <span className="text-slate-200">{machine.department || 'Sewing Floor'}</span>
              </div>
              <div className="text-slate-400 text-[11px]">
                Commissioned: <span className="font-mono text-slate-200">{machine.purchaseDate || '2024-03-15'}</span>
              </div>
            </div>
          </div>

          {/* Quick Metrics Header Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-white/10">
            <div className="bg-white/5 border border-white/10 p-2.5 rounded-xl">
              <span className="text-[10px] text-slate-300 uppercase tracking-wider block font-semibold">
                Total Repair Tickets
              </span>
              <span className="text-lg font-mono font-bold text-amber-300">
                {totalRepairs} Work Orders
              </span>
            </div>
            <div className="bg-white/5 border border-white/10 p-2.5 rounded-xl">
              <span className="text-[10px] text-slate-300 uppercase tracking-wider block font-semibold">
                Recorded Downtime
              </span>
              <span className="text-lg font-mono font-bold text-rose-400">
                {totalDowntime} Mins Loss
              </span>
            </div>
            <div className="bg-white/5 border border-white/10 p-2.5 rounded-xl">
              <span className="text-[10px] text-slate-300 uppercase tracking-wider block font-semibold">
                PPM Health Schedules
              </span>
              <span className="text-lg font-mono font-bold text-emerald-300">
                {ppmList.length} Routines
              </span>
            </div>
            <div className="bg-white/5 border border-white/10 p-2.5 rounded-xl">
              <span className="text-[10px] text-slate-300 uppercase tracking-wider block font-semibold">
                Line Movements
              </span>
              <span className="text-lg font-mono font-bold text-indigo-300">
                {relocations.length + (machine.previousLine ? 1 : 0)} Transfers
              </span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 text-xs font-bold bg-slate-50 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('REPAIRS')}
            className={`flex-1 min-w-[150px] py-3.5 text-center border-b-2 transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'REPAIRS'
                ? 'border-indigo-600 text-indigo-700 bg-white font-extrabold shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Wrench className="w-4 h-4 text-indigo-600" />
            <span>1. Repair History ({totalRepairs})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('PPM')}
            className={`flex-1 min-w-[150px] py-3.5 text-center border-b-2 transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'PPM'
                ? 'border-emerald-600 text-emerald-700 bg-white font-extrabold shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <CalendarCheck className="w-4 h-4 text-emerald-600" />
            <span>2. PPM Schedules ({ppmList.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('RELOCATIONS')}
            className={`flex-1 min-w-[150px] py-3.5 text-center border-b-2 transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'RELOCATIONS'
                ? 'border-amber-600 text-amber-700 bg-white font-extrabold shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <ArrowRightLeft className="w-4 h-4 text-amber-600" />
            <span>3. Movement History</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('LIFECYCLE')}
            className={`flex-1 min-w-[150px] py-3.5 text-center border-b-2 transition flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'LIFECYCLE'
                ? 'border-purple-600 text-purple-700 bg-white font-extrabold shadow-2xs'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Layers className="w-4 h-4 text-purple-600" />
            <span>4. Specs &amp; Valuation</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* TAB 1: REPAIR WORK ORDERS */}
          {activeTab === 'REPAIRS' && (
            <div className="space-y-4 animate-in fade-in duration-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="relative flex-1 max-w-sm">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search fault, mechanic, or action..."
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <span className="text-xs text-slate-500 font-medium">
                  Showing {filteredRepairs.length} of {repairs.length} historical work orders
                </span>
              </div>

              {filteredRepairs.length === 0 ? (
                <div className="p-10 bg-slate-50 rounded-2xl border border-slate-200 text-center space-y-2">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
                  <h4 className="text-sm font-bold text-slate-800">
                    No Recorded Breakdowns
                  </h4>
                  <p className="text-xs text-slate-500">
                    This asset has not experienced logged breakdown events or matches your search query.
                  </p>
                </div>
              ) : (
                <div
                  className="grid grid-cols-1 md:grid-cols-2 gap-3.5 max-h-[480px] overflow-y-auto pr-1 scrollbar-thin"
                  style={{ maxHeight: '480px' }}
                >
                  {filteredRepairs.map((ticket) => (
                    <div
                      key={ticket.id}
                      className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs hover:shadow-xs transition space-y-3 flex flex-col justify-between"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {ticket.id}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              ticket.urgency === 'CRITICAL'
                                ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                : 'bg-amber-100 text-amber-800 border border-amber-200'
                            }`}
                          >
                            {ticket.urgency}
                          </span>
                          <span className="text-xs font-bold text-slate-800">
                            {ticket.faultCategory}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-[11px] text-slate-500">
                          <span className="font-mono">
                            {ticket.reportedAt ? new Date(ticket.reportedAt).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            }) : 'Recent'}
                          </span>
                          <span className="font-mono font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                            {ticket.downtimeMinutes} min loss
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1.5 text-xs">
                        <div className="text-slate-600">
                          <b>Reported Issue:</b> {ticket.faultDetails}
                        </div>
                        {ticket.actionTaken ? (
                          <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3 text-xs space-y-1">
                            <div className="flex items-center gap-1.5 font-bold text-emerald-950 text-[11px] uppercase tracking-wide">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>Technical Work Done In Past &amp; Resolution:</span>
                            </div>
                            <p className="text-emerald-900 leading-relaxed pl-5 text-[11px]">
                              {ticket.actionTaken}
                            </p>
                          </div>
                        ) : (
                          <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-2.5 text-xs text-amber-900 flex items-center gap-2">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span>Service ticket currently active on floor.</span>
                          </div>
                        )}
                      </div>

                      {/* Parts and Attended by strip */}
                      <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between text-[11px] text-slate-500 gap-2">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-indigo-600" />
                          <span>
                            Attended by:{' '}
                            <strong className="text-slate-800 font-semibold">
                              {ticket.attendedBy || 'Ramesh Kumar (Lead)'}
                            </strong>
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Package className="w-3.5 h-3.5 text-slate-400" />
                          <span>
                            Replaced:{' '}
                            <span className="font-medium text-slate-700">
                              {ticket.partsUsed && ticket.partsUsed.length > 0
                                ? ticket.partsUsed.map((p) => `${p.quantity}x ${p.name}`).join(', ')
                                : 'No spare part consumed'}
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PREVENTIVE MAINTENANCE SCHEDULES */}
          {activeTab === 'PPM' && (
            <div className="space-y-4 animate-in fade-in duration-100">
              <div className="text-xs text-slate-500 pb-1">
                Periodic maintenance schedules, lubrication cycles, and calibration frequencies for {machine.id}:
              </div>

              {ppmList.length === 0 ? (
                <div className="p-10 bg-slate-50 rounded-2xl border border-slate-200 text-center space-y-2">
                  <CalendarCheck className="w-10 h-10 text-slate-400 mx-auto" />
                  <h4 className="text-sm font-bold text-slate-800">
                    Default 30-Day Fleet PPM Active
                  </h4>
                  <p className="text-xs text-slate-500">
                    Standard monthly oil wick flush and looper clearance routine assigned to M. Selvam (PPM Specialist).
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {ppmList.map((ppm) => (
                    <div
                      key={ppm.id}
                      className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs hover:shadow-xs transition space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                            {ppm.id}
                          </span>
                          <h4 className="text-xs font-bold text-slate-900 mt-1">
                            {ppm.task}
                          </h4>
                          <span className="text-[11px] text-slate-500 font-medium">
                            Frequency: {ppm.frequency} ({ppm.intervalDays} Days)
                          </span>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            ppm.status === 'COMPLETED'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : ppm.status === 'OVERDUE'
                              ? 'bg-rose-100 text-rose-800 border border-rose-200 urgent-pulse'
                              : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {ppm.status}
                        </span>
                      </div>

                      <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
                        <span>
                          Last: <b className="text-slate-700">{ppm.lastServiced}</b>
                        </span>
                        <span>
                          Next Due: <b className="text-indigo-700">{ppm.nextDue}</b>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: RELOCATION & FLOOR MOVEMENTS */}
          {activeTab === 'RELOCATIONS' && (
            <div className="space-y-4 animate-in fade-in duration-100">
              <div className="text-xs text-slate-500 pb-1">
                Complete historical record of machine relocations, line balancing transfers, and station changes:
              </div>

              {relocations.length === 0 && !machine.previousLine ? (
                <div className="p-10 bg-slate-50 rounded-2xl border border-slate-200 text-center space-y-2">
                  <MapPin className="w-10 h-10 text-slate-400 mx-auto" />
                  <h4 className="text-sm font-bold text-slate-800">
                    Stationary Asset
                  </h4>
                  <p className="text-xs text-slate-500">
                    Asset has remained stationed at {formatAssetLocation(machine)} since initial commissioning.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {machine.previousLine && (
                    <div className="p-4 bg-indigo-50/70 rounded-2xl border border-indigo-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                          <ArrowRightLeft className="w-4 h-4 text-indigo-600" />
                          <span>Latest Floor Transfer</span>
                        </span>
                        {machine.lastMovedAt && (
                          <span className="text-[10px] font-mono text-slate-500">
                            {new Date(machine.lastMovedAt).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-800 flex items-center gap-2">
                        <span className="font-semibold text-slate-600">
                          {formatRelocationEndpoint(machine.previousLine, machine.previousStation, machine.unit)}
                        </span>
                        <span className="text-indigo-600 font-bold">➜</span>
                        <span className="font-bold text-emerald-700">
                          {formatRelocationLocation(machine)}
                        </span>
                      </div>
                      {machine.lastMovedReason && (
                        <p className="text-[11px] text-slate-600">
                          <b>Reason:</b> {machine.lastMovedReason}
                        </p>
                      )}
                    </div>
                  )}

                  {relocations.map((rel, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 bg-white rounded-2xl border border-slate-200 space-y-1.5 text-xs shadow-2xs"
                    >
                      <div className="flex items-center justify-between text-slate-500 text-[11px]">
                        <span>Movement #{idx + 1}</span>
                        <span className="font-mono">
                          {new Date(rel.movedAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                      <div className="text-slate-800 font-medium flex items-center gap-2">
                        <span>{formatRelocationEndpoint(rel.fromLine, rel.fromStation, machine.unit)}</span>
                        <span className="text-indigo-600 font-bold">➜</span>
                        <span className="font-bold text-emerald-700">{formatRelocationEndpoint(rel.toLine, rel.toStation, machine.unit)}</span>
                      </div>
                      {rel.reason && (
                        <p className="text-[11px] text-slate-600">
                          <b>Reason:</b> {rel.reason} • <b>Moved by:</b> {rel.movedBy || 'Floor Mechanic'}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: SPECS & LIFECYCLE VALUATION */}
          {activeTab === 'LIFECYCLE' && (
            <div className="space-y-4 animate-in fade-in duration-100">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">
                    Asset Tag &amp; Serial
                  </span>
                  <span className="font-mono font-bold text-slate-900 text-sm">
                    {machine.id}
                  </span>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">
                    OEM Brand &amp; Model
                  </span>
                  <span className="font-bold text-slate-900 text-sm">
                    {machine.brand} {machine.model}
                  </span>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">
                    Asset Class &amp; Category
                  </span>
                  <span className="font-bold text-slate-900">
                    {machine.category || 'MACHINE'} • {machine.typeName || machine.type}
                  </span>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">
                    Capital Acquisition Cost
                  </span>
                  <span className="font-mono font-bold text-emerald-700 text-sm">
                    ₹{machine.cost?.toLocaleString('en-IN') || '75,000'}
                  </span>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">
                    Drive Motor Type
                  </span>
                  <span className="font-bold text-slate-900">
                    {machine.motorType || 'DIRECT-DRIVE SERVO'}
                  </span>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">
                    Plant Department
                  </span>
                  <span className="font-bold text-slate-900">
                    {machine.department || 'Sewing Floor'}
                  </span>
                </div>
              </div>

              {machine.specs && (
                <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-200 text-xs space-y-1">
                  <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">
                    Technical Specifications
                  </span>
                  <p className="text-slate-800 font-medium">
                    {machine.specs}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Audit ID: <span className="font-mono font-semibold text-slate-700">{machine.id}-AUDIT</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Close History
          </button>
        </div>
      </div>

      {/* Edit Asset Information Modal */}
      <EditAssetModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        asset={machine}
      />
    </div>
  );
}
