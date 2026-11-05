'use client';

import React, { useState, useMemo } from 'react';
import {
  Factory,
  CheckCircle2,
  PauseCircle,
  AlertTriangle,
  Layers,
  ChevronRight,
  TrendingUp,
  BarChart3,
  Filter,
  ArrowUpRight,
  ShieldCheck,
  Zap,
  Plus,
} from 'lucide-react';
import { Machine } from '@/types/cmms';
import {
  CLIENT_ZONES,
  CLIENT_LINES,
  ClientZone,
  ClientLine,
  computeAvailabilityReport,
  PlantAvailabilityReport,
  ZoneAvailabilityReport,
  LineAvailabilityReport,
} from '@/lib/services/assetLogService';

interface LineAvailabilityWidgetProps {
  machines: Machine[];
  selectedZone?: ClientZone | 'ALL';
  selectedLine?: ClientLine | 'ALL';
  onSelectZoneLine?: (zone: ClientZone | 'ALL', line: ClientLine | 'ALL') => void;
  onQuickToggleMachine?: (machineId: string) => void;
  onAddExtraMachine?: (zone: ClientZone) => void;
}

export function LineAvailabilityWidget({
  machines,
  selectedZone: propZone = 'Zone 1',
  selectedLine: propLine = 'ALL',
  onSelectZoneLine,
  onAddExtraMachine,
}: LineAvailabilityWidgetProps) {
  const [activeZone, setActiveZone] = useState<ClientZone | 'ALL'>(
    propZone === 'ALL' ? 'Zone 1' : propZone
  );
  const [viewMode, setViewMode] = useState<'CARDS' | 'MATRIX'>('CARDS');

  // Compute 8-zone x 8-line report
  const report: PlantAvailabilityReport = useMemo(() => {
    return computeAvailabilityReport(machines);
  }, [machines]);

  const currentZoneReport: ZoneAvailabilityReport | undefined = useMemo(() => {
    if (activeZone === 'ALL') return undefined;
    return report.zones.find((z) => z.zone === activeZone);
  }, [report, activeZone]);

  const handleZoneSelect = (zone: ClientZone | 'ALL') => {
    setActiveZone(zone);
    if (onSelectZoneLine) {
      onSelectZoneLine(zone, 'ALL');
    }
  };

  const handleLineClick = (line: ClientLine) => {
    if (onSelectZoneLine) {
      onSelectZoneLine(activeZone === 'ALL' ? 'Zone 1' : activeZone, line);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden transition-all">
      {/* ─── WIDGET HEADER ─── */}
      <div className="p-4 sm:p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50/80 via-white to-indigo-50/30">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                  Line-Wise Machine Availability Report
                </h2>
                <span className="px-2 py-0.5 text-[11px] font-extrabold bg-indigo-100 text-indigo-800 rounded-md">
                  8 Zones • 8 Lines (64 Total)
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Client operational readiness matrix: active production vs idle standby tracking
              </p>
            </div>
          </div>

          {/* Plant summary chips & view switcher */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl bg-slate-100 p-0.5 border border-slate-200 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setViewMode('CARDS')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'CARDS'
                    ? 'bg-white text-indigo-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Zone Details</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('MATRIX')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                  viewMode === 'MATRIX'
                    ? 'bg-white text-indigo-700 shadow-xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>8×8 Plant Heatmap</span>
              </button>
            </div>
          </div>
        </div>

        {/* ─── PLANT-WIDE METRICS SUMMARY BAR ─── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4">
          <div className="bg-white/90 border border-slate-200 rounded-xl p-3 shadow-2xs">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Total Client Fleet
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5">
              {report.totalMachines}
              <span className="text-xs font-normal text-slate-400 ml-1">Machines</span>
            </div>
            <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
              <Factory className="w-3 h-3 text-indigo-500" />
              64 Production Lines
            </div>
          </div>

          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3 shadow-2xs">
            <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider flex items-center justify-between">
              <span>Active Machines</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-900 mt-0.5">
              {report.totalActive}
              <span className="text-xs font-bold text-emerald-700 ml-1.5">
                ({report.plantAvailabilityRate}%)
              </span>
            </div>
            <div className="text-[11px] text-emerald-700/90 mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              Running in production
            </div>
          </div>

          <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 shadow-2xs">
            <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider flex items-center justify-between">
              <span>Idle / Standby</span>
              <span className="w-2 h-2 rounded-full bg-amber-500" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-amber-900 mt-0.5">
              {report.totalIdle}
              <span className="text-xs font-bold text-amber-700 ml-1.5">
                ({report.totalMachines > 0 ? Math.round((report.totalIdle / report.totalMachines) * 100) : 0}%)
              </span>
            </div>
            <div className="text-[11px] text-amber-700/90 mt-1 flex items-center gap-1">
              <PauseCircle className="w-3 h-3 text-amber-600" />
              Ready for activation
            </div>
          </div>

          <div className="bg-rose-50/70 border border-rose-200/80 rounded-xl p-3 shadow-2xs">
            <div className="text-[11px] font-bold text-rose-700 uppercase tracking-wider flex items-center justify-between">
              <span>In Repair / Breakdown</span>
              {report.totalBreakdown > 0 && (
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              )}
            </div>
            <div className="text-xl sm:text-2xl font-black text-rose-900 mt-0.5">
              {report.totalBreakdown}
              <span className="text-xs font-bold text-rose-700 ml-1.5">
                ({report.totalMachines > 0 ? Math.round((report.totalBreakdown / report.totalMachines) * 100) : 0}%)
              </span>
            </div>
            <div className="text-[11px] text-rose-700/90 mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-rose-600" />
              Requires mechanic
            </div>
          </div>
        </div>

        {/* ─── 8 ZONES SELECTION TABS ─── */}
        <div className="flex items-center gap-1.5 overflow-x-auto pt-3 pb-1 no-scrollbar">
          <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1 shrink-0">
            <Filter className="w-3.5 h-3.5 text-indigo-600" /> Select Zone:
          </span>
          {CLIENT_ZONES.map((zone) => {
            const zData = report.zones.find((z) => z.zone === zone);
            const isSelected = activeZone === zone;
            const rate = zData?.availabilityRate || 0;

            return (
              <button
                key={zone}
                type="button"
                onClick={() => handleZoneSelect(zone)}
                className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer border ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-600/30'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                }`}
              >
                <span>{zone}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                    isSelected
                      ? 'bg-white/20 text-white'
                      : rate >= 85
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {rate}%
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── TAB CONTENT ─── */}
      <div className="p-4 sm:p-5">
        {viewMode === 'CARDS' ? (
          <div>
            {currentZoneReport ? (
              <div className="space-y-4">
                {/* Zone Summary Banner */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-3.5 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center font-black text-indigo-300 text-sm">
                      {currentZoneReport.zone.replace('Zone ', 'Z0')}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm tracking-tight">
                          {currentZoneReport.zone} Availability Overview
                        </h3>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                          8 Sewing Lines
                        </span>
                      </div>
                      <p className="text-xs text-slate-300">
                        Total {currentZoneReport.total} machines: {currentZoneReport.active} Active, {currentZoneReport.idle} Idle, {currentZoneReport.breakdown} Breakdown
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 shrink-0">
                    {onAddExtraMachine && (
                      <button
                        type="button"
                        onClick={() => onAddExtraMachine(currentZoneReport.zone)}
                        className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs border border-indigo-400/40"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Extra Machine</span>
                      </button>
                    )}
                    <div className="text-right">
                      <div className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider">
                        Zone Operational Rate
                      </div>
                      <div className="text-xl font-black text-white">
                        {currentZoneReport.availabilityRate}%
                      </div>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center font-black text-emerald-400 border border-white/10">
                      <TrendingUp className="w-6 h-6" />
                    </div>
                  </div>
                </div>

                {/* 8 Lines Grid Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {currentZoneReport.lines.map((lineData) => {
                    const isSelected = propLine === lineData.line;
                    return (
                      <div
                        key={lineData.line}
                        onClick={() => handleLineClick(lineData.line)}
                        className={`group relative rounded-xl border p-3.5 transition-all cursor-pointer hover:shadow-md ${
                          isSelected
                            ? 'bg-indigo-50/60 border-indigo-500 ring-2 ring-indigo-500/20'
                            : 'bg-white border-slate-200/90 hover:border-indigo-300'
                        }`}
                      >
                        {/* Line Header */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="w-7 h-7 rounded-lg bg-slate-900 text-white font-mono font-bold text-xs flex items-center justify-center">
                              {lineData.line.replace('Line ', 'L')}
                            </span>
                            <span className="font-bold text-slate-800 text-sm">
                              {lineData.line}
                            </span>
                          </div>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                              lineData.healthStatus === 'OPTIMAL'
                                ? 'bg-emerald-100 text-emerald-800'
                                : lineData.healthStatus === 'GOOD'
                                ? 'bg-indigo-100 text-indigo-800'
                                : lineData.healthStatus === 'NEEDS_ATTENTION'
                                ? 'bg-rose-100 text-rose-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {lineData.availabilityRate}% Ready
                          </span>
                        </div>

                        {/* Machine Breakdown Counts */}
                        <div className="grid grid-cols-3 gap-1.5 text-center my-2.5">
                          <div className="bg-slate-50 rounded-lg p-1.5 border border-slate-100">
                            <span className="block text-[10px] font-bold text-slate-500">Total</span>
                            <span className="text-sm font-black text-slate-800">{lineData.total}</span>
                          </div>
                          <div className="bg-emerald-50 rounded-lg p-1.5 border border-emerald-100">
                            <span className="block text-[10px] font-bold text-emerald-700">Active</span>
                            <span className="text-sm font-black text-emerald-700">{lineData.active}</span>
                          </div>
                          <div className="bg-amber-50 rounded-lg p-1.5 border border-amber-100">
                            <span className="block text-[10px] font-bold text-amber-700">Idle</span>
                            <span className="text-sm font-black text-amber-700">{lineData.idle}</span>
                          </div>
                        </div>

                        {/* Multi-segment Progress Bar */}
                        <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden flex mb-2">
                          <div
                            style={{
                              width: `${lineData.total > 0 ? (lineData.active / lineData.total) * 100 : 0}%`,
                            }}
                            className="bg-emerald-500 h-full transition-all duration-300"
                            title={`Active: ${lineData.active}`}
                          />
                          <div
                            style={{
                              width: `${lineData.total > 0 ? (lineData.idle / lineData.total) * 100 : 0}%`,
                            }}
                            className="bg-amber-400 h-full transition-all duration-300"
                            title={`Idle: ${lineData.idle}`}
                          />
                          <div
                            style={{
                              width: `${lineData.total > 0 ? (lineData.breakdown / lineData.total) * 100 : 0}%`,
                            }}
                            className="bg-rose-500 h-full transition-all duration-300"
                            title={`Breakdown: ${lineData.breakdown}`}
                          />
                        </div>

                        {/* Card Footer */}
                        <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px] text-slate-500">
                          <span>
                            {lineData.breakdown > 0 ? (
                              <span className="text-rose-600 font-bold flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" /> {lineData.breakdown} in breakdown
                              </span>
                            ) : (
                              <span className="text-emerald-600 font-semibold flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3" /> No breakdowns
                              </span>
                            )}
                          </span>
                          <span className="text-indigo-600 font-bold group-hover:translate-x-0.5 transition flex items-center">
                            Filter <ChevronRight className="w-3 h-3 ml-0.5" />
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          /* ─── 8×8 PLANT AVAILABILITY HEATMAP MATRIX ─── */
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  Full Plant Fleet Matrix (8 Zones × 8 Lines = 64 Production Units)
                </h3>
                <p className="text-xs text-slate-500">
                  Click any cell in the matrix to immediately focus on that specific Zone & Line
                </p>
              </div>

              {/* Legend */}
              <div className="flex items-center gap-3 text-xs font-medium text-slate-600">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  &gt;= 85% Active
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  70-84% Active
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  &lt; 70% Active
                </span>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 whitespace-nowrap">Zone \ Line</th>
                    {CLIENT_LINES.map((line) => (
                      <th key={line} className="py-2.5 px-2 text-center whitespace-nowrap font-mono">
                        {line.replace('Line ', 'L')}
                      </th>
                    ))}
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">Total</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">Avail.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {report.zones.map((zoneData) => {
                    return (
                      <tr key={zoneData.zone} className="hover:bg-slate-50/80 transition">
                        <td className="py-2 px-3 font-bold text-slate-800 whitespace-nowrap">
                          {zoneData.zone}
                        </td>
                        {zoneData.lines.map((lineData) => {
                          const rate = lineData.availabilityRate;
                          const hasBreakdown = lineData.breakdown > 0;
                          return (
                            <td key={lineData.line} className="py-2 px-1 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveZone(zoneData.zone);
                                  if (onSelectZoneLine) onSelectZoneLine(zoneData.zone, lineData.line);
                                }}
                                title={`${zoneData.zone} - ${lineData.line}: ${lineData.active}/${lineData.total} Active (${rate}%), ${lineData.idle} Idle, ${lineData.breakdown} Breakdown`}
                                className={`w-9 h-8 rounded-lg font-bold font-mono text-[11px] transition inline-flex flex-col items-center justify-center cursor-pointer ${
                                  hasBreakdown
                                    ? 'bg-rose-100 text-rose-800 border border-rose-300 hover:bg-rose-200'
                                    : rate >= 85
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 hover:bg-emerald-200'
                                    : rate >= 70
                                    ? 'bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200'
                                    : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200'
                                }`}
                              >
                                <span>{lineData.active}/{lineData.total}</span>
                              </button>
                            </td>
                          );
                        })}
                        <td className="py-2 px-3 text-right font-black text-slate-800">
                          {zoneData.total}
                        </td>
                        <td className="py-2 px-3 text-right font-black">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[11px] ${
                              zoneData.availabilityRate >= 85
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {zoneData.availabilityRate}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
