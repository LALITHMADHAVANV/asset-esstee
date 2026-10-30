'use client';

import { textValue } from '@/lib/textValue';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import type { Machine, RepairTicket, PPMSchedule, SparePart, PartRequisition, UserRole } from '@/types/cmms';
import { PlantOperationsDashboard } from '@/components/dashboard/PlantOperationsDashboard';
import { SeniorMechanicDashboard } from '@/components/dashboard/SeniorMechanicDashboard';
import { MechanicDeskDashboard } from '@/components/dashboard/MechanicDeskDashboard';
import { StoreDashboard } from '@/components/dashboard/StoreDashboard';
import { ExecutiveDashboard } from '@/components/dashboard/ExecutiveDashboard';
import { FACTORY_UNITS, matchesUnit, getUnitBadgeInfo, isUserAdmin, getUserScopedUnit } from '@/lib/constants/units';
import { normalizeRole } from '@/lib/constants/roles';
import { Building, ShieldCheck, Layers } from 'lucide-react';

import {
  subscribeMachines,
  subscribeRepairs,
  subscribePPMSchedules,
  subscribeParts,
  subscribeRequisitions,
  apiFetch,
} from '@/lib/services/cmmsService';

export default function DashboardPage() {
  const router = useRouter();
  const { user, role, isLoading } = useAuth();
  const { showToast } = useToast();

  // ─── API data state ──────────────────────────────────────────────────
  const [machines, setMachines] = useState<Machine[]>([]);
  const [repairs, setRepairs] = useState<RepairTicket[]>([]);
  const [ppmSchedules, setPpmSchedules] = useState<PPMSchedule[]>([]);
  const [parts, setParts] = useState<SparePart[]>([]);
  const [requisitions, setRequisitions] = useState<PartRequisition[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // ─── Scoped Unit State ───────────────────────────────────────────────
  const [selectedUnit, setSelectedUnit] = useState<string>('All Units');

  useEffect(() => {
    if (user?.unit) {
      setSelectedUnit(user.unit);
    }
  }, [user?.unit]);

  // ─── Immediate local reactive subscriptions ─────────────────────────
  useEffect(() => {
    const unsubMachines = subscribeMachines((data) => {
      if (Array.isArray(data)) setMachines(data);
    });
    const unsubRepairs = subscribeRepairs((data) => {
      if (Array.isArray(data)) setRepairs(data);
    });
    const unsubPpm = subscribePPMSchedules((data) => {
      if (Array.isArray(data)) setPpmSchedules(data);
    });
    const unsubParts = subscribeParts((data) => {
      if (Array.isArray(data)) setParts(data);
    });
    const unsubReqs = subscribeRequisitions((data) => {
      if (Array.isArray(data)) setRequisitions(data);
    });

    return () => {
      unsubMachines();
      unsubRepairs();
      unsubPpm();
      unsubParts();
      unsubReqs();
    };
  }, []);

  // ─── Fetch all data from MongoDB ─────────────────────────────────────
  const fetchAllData = async () => {
    try {
      const [machRes, repRes, ppmRes, partRes, reqRes] = await Promise.allSettled([
        apiFetch('/api/machines').then((r) => r.json()),
        apiFetch('/api/repairs').then((r) => r.json()),
        apiFetch('/api/ppm').then((r) => r.json()),
        apiFetch('/api/parts').then((r) => r.json()),
        apiFetch('/api/requisitions').then((r) => r.json()),
      ]);

      if (machRes.status === 'fulfilled' && Array.isArray(machRes.value?.data)) {
        setMachines(machRes.value.data);
      }
      if (repRes.status === 'fulfilled' && Array.isArray(repRes.value?.data)) {
        setRepairs(repRes.value.data);
      }
      if (ppmRes.status === 'fulfilled' && Array.isArray(ppmRes.value?.data)) {
        setPpmSchedules(ppmRes.value.data);
      }
      if (partRes.status === 'fulfilled' && Array.isArray(partRes.value?.data)) {
        setParts(partRes.value.data);
      }
      if (reqRes.status === 'fulfilled' && Array.isArray(reqRes.value?.data)) {
        setRequisitions(reqRes.value.data);
      }

      setLastRefresh(new Date());
    } catch {
      showToast('Failed to load dashboard data', 'error');
    }
  };

  useEffect(() => {
    if (!isLoading && user) fetchAllData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, user]);

  // Determine active dashboard view based on user's normalized role
  const activeRole: UserRole = normalizeRole(user?.role || role);

  // Multi-unit authority: ONLY Admin & CEO can access/switch all units
  const isMultiUnitAuthority = isUserAdmin(activeRole);
  const effectiveUnit = getUserScopedUnit(user, activeRole, selectedUnit);

  // Unit machine count aggregates
  const unit1Count = useMemo(() => machines.filter((m) => matchesUnit(m.unit, 'UNIT - 1')).length, [machines]);
  const unit2Count = useMemo(() => machines.filter((m) => matchesUnit(m.unit, 'UNIT-2')).length, [machines]);
  const allUnitsCount = machines.length;

  // Scoped data by unit - strictly categorized based on what unit they handle for all mechanics & personnel except admin
  const scopedMachines = useMemo(() => {
    if (!effectiveUnit || effectiveUnit === 'All Units') return machines;
    return machines.filter((m) => matchesUnit(m.unit, effectiveUnit));
  }, [machines, effectiveUnit]);

  const scopedRepairs = useMemo(() => {
    if (!effectiveUnit || effectiveUnit === 'All Units') return repairs;
    const machineIdSet = new Set(scopedMachines.map((m) => textValue((m.id || '')).toUpperCase()));
    return repairs.filter((r) => !r.machineId || machineIdSet.has(textValue((r.machineId || '')).toUpperCase()));
  }, [repairs, scopedMachines, effectiveUnit]);

  const scopedPpmSchedules = useMemo(() => {
    if (!effectiveUnit || effectiveUnit === 'All Units') return ppmSchedules;
    const machineIdSet = new Set(scopedMachines.map((m) => textValue((m.id || '')).toUpperCase()));
    return ppmSchedules.filter((p) => !p.machineId || machineIdSet.has(textValue((p.machineId || '')).toUpperCase()));
  }, [ppmSchedules, scopedMachines, effectiveUnit]);

  const scopedParts = useMemo(() => {
    // Spare parts are factory-wide inventory, categorized and mapped by machine type
    return parts;
  }, [parts]);

  const scopedRequisitions = useMemo(() => {
    if (!effectiveUnit || effectiveUnit === 'All Units') return requisitions;
    const machineIdSet = new Set(scopedMachines.map((m) => textValue((m.id || '')).toUpperCase()));
    return requisitions.filter((r) => !r.machineId || machineIdSet.has(textValue((r.machineId || '')).toUpperCase()));
  }, [requisitions, scopedMachines, effectiveUnit]);

  return (
    <div className="space-y-4">
      {/* ─── UNIT DATA SCOPE BAR ────────────────────────────────────── */}
      {isMultiUnitAuthority ? (
        <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900">Plant Unit Filter:</span>
                <span className="text-xs font-black text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                  {selectedUnit === 'All Units' ? 'Entire Plant (All Units)' : selectedUnit}
                </span>
                <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">
                  • {scopedMachines.length} Assets Loaded
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Switch unit views to inspect line telemetry, active breakdowns, and scheduled servicing per plant.
              </p>
            </div>
          </div>

          {/* Unit Dropdown Switcher */}
          <div className="flex items-center gap-1.5 shrink-0 self-start md:self-auto">
            <span className="text-xs font-semibold text-slate-500 hidden sm:inline">Switch:</span>
            <select
              value={selectedUnit}
              onChange={(e) => setSelectedUnit(e.target.value)}
              className="text-xs font-bold bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer transition shadow-2xs"
              title="Switch Unit Filter"
            >
              <option value="All Units">All Units ({allUnitsCount})</option>
              <option value="UNIT - 1">UNIT - 1 ({unit1Count})</option>
              <option value="UNIT-2">UNIT-2 ({unit2Count})</option>
            </select>
          </div>
        </div>
      ) : (
        <div className="bg-gradient-to-r from-indigo-50/90 via-blue-50/60 to-white border border-indigo-200 rounded-2xl p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Building className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-black text-slate-900 flex items-center gap-2">
                <span>Logged In Unit: {user?.unit || selectedUnit}</span>
                <span className="text-[10px] bg-indigo-100 text-indigo-800 border border-indigo-200 px-2 py-0.2 rounded-full font-bold">
                  Unit Scoped Session
                </span>
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Dashboard telemetry, breakdown tickets, and PPM tasks are filtered exclusively for your assigned facility ({scopedMachines.length} machinery assets).
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─── DYNAMIC ROLE-BASED DASHBOARD RENDER ───────────────────────── */}
      {activeRole === 'SENIOR_MECHANIC' || activeRole === 'SENIOR_ELECTRICIAN' ? (
        <SeniorMechanicDashboard
          machines={scopedMachines}
          repairs={scopedRepairs}
          ppmSchedules={scopedPpmSchedules}
          parts={scopedParts}
          requisitions={scopedRequisitions}
          lastRefresh={lastRefresh}
          onRefresh={fetchAllData}
          isLoading={dataLoading}
        />
      ) : activeRole === 'MECHANIC' || activeRole === 'ELECTRICIAN' ? (
        <MechanicDeskDashboard
          machines={scopedMachines}
          repairs={scopedRepairs}
          ppmSchedules={scopedPpmSchedules}
          parts={scopedParts}
          requisitions={scopedRequisitions}
          lastRefresh={lastRefresh}
          onRefresh={fetchAllData}
          isLoading={dataLoading}
        />
      ) : activeRole === 'STORE_PERSON' ? (
        <StoreDashboard
          machines={scopedMachines}
          repairs={scopedRepairs}
          ppmSchedules={scopedPpmSchedules}
          parts={scopedParts}
          requisitions={scopedRequisitions}
          lastRefresh={lastRefresh}
          onRefresh={fetchAllData}
          isLoading={dataLoading}
        />
      ) : activeRole === 'CEO' ? (
        <ExecutiveDashboard
          machines={scopedMachines}
          repairs={scopedRepairs}
          ppmSchedules={scopedPpmSchedules}
          parts={scopedParts}
          requisitions={scopedRequisitions}
          lastRefresh={lastRefresh}
          onRefresh={fetchAllData}
          isLoading={dataLoading}
        />
      ) : (
        <PlantOperationsDashboard
          machines={scopedMachines}
          repairs={scopedRepairs}
          ppmSchedules={scopedPpmSchedules}
          parts={scopedParts}
          requisitions={scopedRequisitions}
          lastRefresh={lastRefresh}
          onRefresh={fetchAllData}
          isLoading={dataLoading}
        />
      )}
    </div>
  );
}
