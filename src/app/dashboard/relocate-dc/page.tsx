'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, Check, Eye, LoaderCircle, MapPin, Search, Trash2, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { apiFetch } from '@/lib/services/cmmsService';
import type { Machine, RelocationDcType } from '@/types/cmms';
import { RelocationDeliveryChallan } from '@/components/print/RelocationDeliveryChallan';
import type { DeliveryChallanAsset } from '@/components/print/RelocationDeliveryChallan';

interface DeliveryChallanRecord {
  requestId: string;
  dcNumber: string;
  dcDate: string;
  assetIds?: string[];
  assetId: string;
  destination: string;
  dcType?: RelocationDcType;
  createdAt: string;
  createdBy?: string;
  assets?: {
    machineId: string;
    category?: string;
    machineType?: string;
    brand?: string;
    model?: string;
    unit?: string;
  }[];
}

interface ChallanDraft {
  requestId: string;
  asset: DeliveryChallanAsset;
  assets: DeliveryChallanAsset[];
  destination: string;
  dcType: RelocationDcType;
  dcNumber?: string;
  dcDate?: string;
  movedBy?: string;
}

export default function RelocateDcPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [machines, setMachines] = useState<Machine[]>([]);
  const [challans, setChallans] = useState<DeliveryChallanRecord[]>([]);
  const [selectedMachineIds, setSelectedMachineIds] = useState<string[]>([]);
  const [machineSearch, setMachineSearch] = useState('');
  const [destination, setDestination] = useState('');
  const [dcType, setDcType] = useState<RelocationDcType>('DELIVERY_CHALLAN');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [pageError, setPageError] = useState('');
  const [challanDraft, setChallanDraft] = useState<ChallanDraft | null>(null);

  const filteredMachines = useMemo(() => {
    const query = machineSearch.trim().toLowerCase();
    if (!query) return machines;
    return machines.filter((machine) =>
      [machine.id, machine.name, machine.typeName, machine.type, machine.brand, machine.model, machine.unit, machine.area, machine.stationNo]
        .some((value) => String(value || '').toLowerCase().includes(query))
    );
  }, [machines, machineSearch]);

  const selectedMachines = useMemo(
    () => selectedMachineIds.map((id) => machines.find((machine) => machine.id === id))
      .filter((machine): machine is Machine => Boolean(machine)),
    [machines, selectedMachineIds]
  );

  const loadData = useCallback(async () => {
    try {
      const [machineResponse, challanResponse] = await Promise.all([
        apiFetch('/api/machines'),
        apiFetch('/api/relocation-challans'),
      ]);
      const [machineResult, challanResult] = await Promise.all([
        machineResponse.json(),
        challanResponse.json(),
      ]);
      if (!machineResponse.ok) throw new Error(machineResult.error || 'Could not load assets.');
      if (!challanResponse.ok) throw new Error(challanResult.error || 'Could not load delivery challans.');
      setMachines(Array.isArray(machineResult.data) ? machineResult.data : []);
      setChallans(Array.isArray(challanResult.data) ? challanResult.data : []);
      setPageError('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load DC data.';
      setPageError(message);
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    // Load server data after the authenticated workspace becomes available.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (user) void loadData();
  }, [loadData, user]);

  const toggleMachine = (id: string) => {
    setSelectedMachineIds((current) => current.includes(id)
      ? current.filter((selectedId) => selectedId !== id)
      : [...current, id]);
  };

  const createChallan = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (selectedMachines.length === 0 || !destination.trim()) {
      showToast('Select at least one asset and enter the destination or party.', 'error');
      return;
    }
    const primaryAsset = selectedMachines[0];
    if (!primaryAsset) return;
    setGenerating(true);
    setChallanDraft({
      requestId: crypto.randomUUID(),
      asset: primaryAsset,
      assets: selectedMachines,
      destination: destination.trim(),
      dcType,
    });
  };

  const closeChallan = () => {
    setChallanDraft(null);
    setGenerating(false);
    setSelectedMachineIds([]);
    setDestination('');
    void loadData();
  };

  const viewChallan = (record: DeliveryChallanRecord) => {
    const assets: DeliveryChallanAsset[] = record.assets?.length
      ? record.assets.map((snapshot) => ({
          id: snapshot.machineId,
          category: snapshot.category,
          typeName: snapshot.machineType,
          brand: snapshot.brand,
          model: snapshot.model,
          unit: snapshot.unit,
        }))
      : (record.assetIds || [record.assetId]).map((id) => {
          const machine = machines.find((item) => item.id === id);
          return machine
            ? {
                id: machine.id,
                company: machine.company,
                category: machine.category,
                type: machine.type,
                typeName: machine.typeName,
                brand: machine.brand,
                model: machine.model,
                unit: machine.unit,
              }
            : { id };
        });
    const primaryAsset = assets[0];
    if (!primaryAsset) {
      showToast('This challan record has no asset details to display.', 'error');
      return;
    }

    setChallanDraft({
      requestId: record.requestId,
      asset: primaryAsset,
      assets,
      destination: record.destination,
      dcType: record.dcType || 'DELIVERY_CHALLAN',
      dcNumber: record.dcNumber,
      dcDate: record.dcDate,
      movedBy: record.createdBy,
    });
  };

  const deleteChallan = async (challan: DeliveryChallanRecord) => {
    if (!window.confirm(`Delete delivery challan ${challan.dcNumber}? This cannot be undone.`)) return;
    setDeletingId(challan.requestId);
    try {
      const response = await apiFetch('/api/relocation-challans', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: challan.requestId }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not delete the DC record.');
      setChallans((current) => current.filter((record) => record.requestId !== challan.requestId));
      showToast('Delivery challan record deleted. Its number will not be reused.', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not delete the DC record.', 'error');
    } finally {
      setDeletingId('');
    }
  };

  return (
    <div className="space-y-6">
      <header className="rounded-2xl bg-slate-950 p-6 text-white shadow-lg">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-indigo-500/20 p-3 text-indigo-200"><ArrowRightLeft className="h-6 w-6" /></div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-200">Senior Mechanic Desk</p>
            <h1 className="mt-1 text-2xl font-black">Relocation DC Generation</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              Generate a returnable delivery challan or delivery challan. This standalone module is independent of quotation approvals.
            </p>
          </div>
        </div>
      </header>

      <form onSubmit={createChallan} className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)]">
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-base font-black text-slate-900">Select assets</h2>
            <p className="mt-1 text-xs text-slate-500">Search by asset ID, name, model, or location; select multiple assets for one challan.</p>
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-300">
            <div className="flex items-center gap-2 border-b border-slate-200 px-3">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <input value={machineSearch} onChange={(event) => setMachineSearch(event.target.value)} aria-label="Search assets" placeholder="Search ID, name, model, unit…" className="w-full py-3 text-sm outline-none" />
              {machineSearch && <button type="button" aria-label="Clear asset search" onClick={() => setMachineSearch('')} className="text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button>}
            </div>
            <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
              {filteredMachines.map((machine) => {
                const checked = selectedMachineIds.includes(machine.id);
                return (
                  <button key={machine.id} type="button" onClick={() => toggleMachine(machine.id)} aria-pressed={checked} className={`flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-indigo-50 ${checked ? 'bg-indigo-50/70' : 'bg-white'}`}>
                    <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${checked ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 bg-white'}`}>{checked && <Check className="h-3 w-3" />}</span>
                    <span className="min-w-0"><span className="block truncate text-xs font-bold text-slate-900">{machine.id} — {machine.name || machine.typeName || machine.type}</span><span className="mt-0.5 block truncate text-[10px] text-slate-500">{[machine.brand, machine.model, machine.unit, machine.area, machine.stationNo].filter(Boolean).join(' · ')}</span></span>
                  </button>
                );
              })}
              {filteredMachines.length === 0 && <p className="px-3 py-6 text-center text-xs text-slate-500">No matching assets.</p>}
            </div>
            <div className="border-t border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-semibold text-slate-500">{selectedMachineIds.length} selected</div>
          </div>
          {selectedMachines.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {selectedMachines.map((machine) => (
                <span key={machine.id} className="inline-flex max-w-full items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-bold text-indigo-800">
                  {machine.id}<button type="button" aria-label={`Remove ${machine.id}`} onClick={() => toggleMachine(machine.id)}><X className="h-3 w-3" /></button>
                </span>
              ))}
            </div>
          )}
        </section>

        <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-black text-slate-900">Delivery challan details</h2>
          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-slate-700">Destination / party</span>
            <input required value={destination} onChange={(event) => setDestination(event.target.value)} maxLength={120} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" placeholder="Destination, recipient, or party name" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-slate-700">Challan type</span>
            <select value={dcType} onChange={(event) => setDcType(event.target.value as RelocationDcType)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100">
              <option value="RETURNABLE_DELIVERY_CHALLAN">Returnable Delivery Challan</option>
              <option value="DELIVERY_CHALLAN">Delivery Challan</option>
            </select>
          </label>
          <div className="mt-auto rounded-xl border border-indigo-100 bg-indigo-50 p-3 text-xs leading-relaxed text-indigo-900">
            <div className="flex items-center gap-2 font-bold"><MapPin className="h-4 w-4" />Independent DC workflow</div>
            <p className="mt-1">Generate and print a challan directly. Quotation submission and approval are handled in their own module.</p>
          </div>
          <button type="submit" disabled={loading || generating || selectedMachineIds.length === 0} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60">
            {generating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRightLeft className="h-4 w-4" />}
            Generate delivery challan
          </button>
        </section>
      </form>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-base font-black text-slate-900">Recent delivery challans</h2>
        {pageError && <p role="alert" className="mb-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{pageError}</p>}
        {loading ? <div className="flex items-center gap-2 py-6 text-sm text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" />Loading challans…</div> :
          challans.length === 0 ? <p className="py-6 text-center text-sm text-slate-500">No challans have been generated yet.</p> :
            <div className="space-y-2">
              {challans.map((challan) => (
                <article key={challan.requestId} className="flex flex-col gap-1 rounded-xl border border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div><p className="text-sm font-bold text-slate-900">{challan.dcNumber} · {challan.dcType === 'RETURNABLE_DELIVERY_CHALLAN' ? 'Returnable Delivery Challan' : 'Delivery Challan'}</p><p className="mt-1 text-xs text-slate-500">{(challan.assetIds || [challan.assetId]).join(', ')} → {challan.destination}</p></div>
                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <span className="text-xs text-slate-500">{challan.dcDate}</span>
                    <button type="button" onClick={() => viewChallan(challan)} aria-label={`View challan ${challan.dcNumber}`} className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 px-2.5 py-1.5 text-xs font-bold text-indigo-700 hover:bg-indigo-50">
                      <Eye className="h-3.5 w-3.5" /> View
                    </button>
                    <button type="button" disabled={deletingId === challan.requestId} onClick={() => void deleteChallan(challan)} aria-label={`Delete challan ${challan.dcNumber}`} className="inline-flex items-center gap-1 rounded-lg border border-rose-200 px-2.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50">
                      {deletingId === challan.requestId ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Delete
                    </button>
                  </div>
                </article>
              ))}
            </div>}
      </section>

      {challanDraft && (
        <RelocationDeliveryChallan
          key={challanDraft.requestId}
          isOpen
          requestId={challanDraft.requestId}
          assets={challanDraft.assets}
          asset={challanDraft.asset}
          destination={challanDraft.destination}
          dcType={challanDraft.dcType}
          initialDcNumber={challanDraft.dcNumber}
          initialDcDate={challanDraft.dcDate}
          onClose={closeChallan}
          movedBy={challanDraft.movedBy || user?.name || 'Senior Mechanic'}
        />
      )}
    </div>
  );
}
