'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { ExternalLink, FileText, LoaderCircle, Search, Send, Upload, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { apiFetch } from '@/lib/services/cmmsService';
import type { Machine, QuotationApprovalRequest } from '@/types/cmms';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

function statusStyle(status: QuotationApprovalRequest['status']) {
  if (status === 'APPROVED_BY_CEO') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'REJECTED') return 'border-rose-200 bg-rose-50 text-rose-700';
  return 'border-amber-200 bg-amber-50 text-amber-800';
}

export default function QuotationRequestPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [quotation, setQuotation] = useState<File | null>(null);
  const [quotationPreviewUrl, setQuotationPreviewUrl] = useState('');
  const quotationPreviewUrlRef = useRef<string | null>(null);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [assetIdRequired, setAssetIdRequired] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [assetSearch, setAssetSearch] = useState('');
  const [requests, setRequests] = useState<QuotationApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [pageError, setPageError] = useState('');
  const [assetError, setAssetError] = useState('');

  const filteredAssets = useMemo(() => {
    const query = assetSearch.trim().toLowerCase();
    if (!query) return machines;
    return machines.filter((machine) =>
      [machine.id, machine.name, machine.typeName, machine.type, machine.brand, machine.model]
        .some((value) => String(value || '').toLowerCase().includes(query))
    );
  }, [assetSearch, machines]);

  const selectedAsset = machines.find((machine) => machine.id === selectedAssetId);

  const loadRequests = useCallback(async () => {
    try {
      const response = await apiFetch('/api/quotation-requests');
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not load quotation requests.');
      setRequests(Array.isArray(result.data) ? result.data : []);
      setPageError('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load quotation requests.';
      setPageError(message);
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const loadMachines = useCallback(async () => {
    try {
      const response = await apiFetch('/api/machines');
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not load asset IDs.');
      setMachines(Array.isArray(result.data) ? result.data : []);
      setAssetError('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load asset IDs.';
      setAssetError(message);
      showToast(message, 'error');
    } finally {
      setAssetsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    // Load workspace data after the authenticated workspace becomes available.
    if (user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadRequests();
      void loadMachines();
    }
  }, [loadMachines, loadRequests, user]);

  useEffect(() => () => {
    if (quotationPreviewUrlRef.current) URL.revokeObjectURL(quotationPreviewUrlRef.current);
  }, []);

  const clearQuotation = () => {
    if (quotationPreviewUrlRef.current) {
      URL.revokeObjectURL(quotationPreviewUrlRef.current);
      quotationPreviewUrlRef.current = null;
    }
    setQuotationPreviewUrl('');
    setQuotation(null);
    const fileInput = document.getElementById('quotation-file') as HTMLInputElement | null;
    if (fileInput) fileInput.value = '';
  };

  const selectQuotation = (file: File | null) => {
    if (!file) {
      clearQuotation();
      return;
    }
    if (!ACCEPTED_TYPES.includes(file.type)) {
      clearQuotation();
      showToast('Choose a PDF, JPG, PNG, or WEBP quotation.', 'error');
      return;
    }
    if (file.size < 1 || file.size > MAX_FILE_SIZE) {
      clearQuotation();
      showToast('Quotation must be a non-empty file up to 5 MB.', 'error');
      return;
    }
    if (quotationPreviewUrlRef.current) URL.revokeObjectURL(quotationPreviewUrlRef.current);
    const previewUrl = URL.createObjectURL(file);
    quotationPreviewUrlRef.current = previewUrl;
    setQuotationPreviewUrl(previewUrl);
    setQuotation(file);
  };

  const submitRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!quotation) {
      showToast('Select the quotation file before submitting.', 'error');
      return;
    }
    if (assetIdRequired && !selectedAssetId) {
      showToast('Select an asset ID or choose that an asset ID is not needed.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const form = new FormData();
      form.set('quotation', quotation);
      if (assetIdRequired) form.set('assetId', selectedAssetId);
      const response = await apiFetch('/api/quotation-requests', { method: 'POST', body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not submit the quotation.');
      clearQuotation();
      setAssetIdRequired(false);
      setSelectedAssetId('');
      setAssetSearch('');
      showToast('Quotation sent to the CEO for approval.', 'success');
      await loadRequests();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not submit the quotation.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={submitRequest} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-base font-black text-slate-900">Upload quotation</h2>
        <p className="mt-1 text-xs text-slate-500">PDF, JPG, PNG, or WEBP; maximum 5 MB.</p>
        <label className="mt-4 block max-w-sm space-y-1.5">
          <span className="text-xs font-bold text-slate-700">Is this quotation for a specific asset ID?</span>
          <select
            value={assetIdRequired ? 'yes' : 'no'}
            onChange={(event) => {
              const required = event.target.value === 'yes';
              setAssetIdRequired(required);
              if (!required) {
                setSelectedAssetId('');
                setAssetSearch('');
              }
            }}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="no">No asset ID needed</option>
            <option value="yes">Yes, select an asset ID</option>
          </select>
        </label>
        {assetIdRequired && (
          <div className="mt-3 max-w-lg space-y-2">
            <label htmlFor="asset-search" className="block text-xs font-bold text-slate-700">Search assets</label>
            <div className="flex items-center gap-2 rounded-xl border border-slate-300 px-3">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                id="asset-search"
                value={assetSearch}
                onChange={(event) => setAssetSearch(event.target.value)}
                placeholder="Search by asset ID, name, or model"
                className="w-full py-2.5 text-sm outline-none"
              />
            </div>
            <label htmlFor="quotation-asset-id" className="sr-only">Select asset ID</label>
            <select
              id="quotation-asset-id"
              required
              disabled={assetsLoading || Boolean(assetError)}
              value={selectedAssetId}
              onChange={(event) => setSelectedAssetId(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 disabled:bg-slate-100"
            >
              <option value="">{assetsLoading ? 'Loading asset IDs…' : 'Select asset ID'}</option>
              {filteredAssets.map((machine) => (
                <option key={machine.id} value={machine.id}>
                  {machine.id} — {machine.brand} — {machine.typeName || machine.type}
                </option>
              ))}
            </select>
            {selectedAsset && (
              <div className="rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-900">
                <span className="font-semibold">Machine make:</span> {selectedAsset.brand || 'Not specified'}
                <span className="mx-2 text-indigo-300">|</span>
                <span className="font-semibold">Machine type:</span> {selectedAsset.typeName || selectedAsset.type || 'Not specified'}
              </div>
            )}
            {assetError && <p role="alert" className="text-xs text-rose-700">{assetError}</p>}
            {!assetsLoading && !assetError && filteredAssets.length === 0 && (
              <p className="text-xs text-slate-500">No matching assets found.</p>
            )}
          </div>
        )}
        <label htmlFor="quotation-file" className="mt-4 flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 text-center hover:border-indigo-400 hover:bg-indigo-50/40">
          {quotation ? <FileText className="mb-2 h-7 w-7 text-indigo-600" /> : <Upload className="mb-2 h-7 w-7 text-slate-400" />}
          <span className="text-sm font-bold text-slate-800">{quotation?.name || 'Choose quotation file'}</span>
          <span className="mt-1 text-xs text-slate-500">{quotation ? `${(quotation.size / 1024 / 1024).toFixed(2)} MB` : 'Select a PDF or image'}</span>
          <input id="quotation-file" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" className="sr-only" onChange={(event) => selectQuotation(event.target.files?.[0] || null)} />
        </label>
        {quotation && (
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={clearQuotation}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <X className="h-3.5 w-3.5" />
              Remove selected document
            </button>
          </div>
        )}
        {quotation && quotationPreviewUrl && (
          <section aria-label="Quotation file preview" className="mt-4 overflow-hidden rounded-xl border border-slate-200">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
              <h3 className="text-sm font-bold text-slate-800">Quotation preview</h3>
              <p className="mt-0.5 truncate text-xs text-slate-500">{quotation.name}</p>
            </div>
            {quotation.type === 'application/pdf' ? (
              <iframe
                title={`Preview of ${quotation.name}`}
                src={quotationPreviewUrl}
                className="h-[min(70vh,600px)] w-full bg-slate-100"
              />
            ) : (
              <div className="flex max-h-[600px] justify-center bg-slate-100 p-3">
                <Image
                  src={quotationPreviewUrl}
                  alt={`Preview of ${quotation.name}`}
                  width={1200}
                  height={800}
                  unoptimized
                  className="max-h-[570px] max-w-full object-contain"
                />
              </div>
            )}
          </section>
        )}
        <button type="submit" disabled={submitting || !quotation} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">
          {submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {submitting ? 'Sending quotation…' : 'Send quotation request'}
        </button>
      </form>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-black text-slate-900">My quotation requests</h2>
            <p className="mt-1 text-xs text-slate-500">Open the uploaded file and check the CEO decision.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{requests.length} records</span>
        </div>
        {pageError && <p role="alert" className="mb-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{pageError}</p>}
        {loading ? <div className="flex items-center gap-2 py-8 text-sm text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" />Loading quotation requests…</div> :
          requests.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">No quotation requests submitted yet.</p> :
            <div className="space-y-3">
              {requests.map((request) => {
                const asset = machines.find((machine) => machine.id === request.assetId);
                const machineMake = request.machineMake || asset?.brand;
                const machineType = request.machineType || asset?.typeName || asset?.type;

                return (
                  <article key={request.id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-sm font-bold text-slate-900">{request.quotationName}</h3>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${statusStyle(request.status)}`}>{request.status.replaceAll('_', ' ')}</span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500">Submitted {new Date(request.requestedAt).toLocaleString()}</p>
                      {request.assetId && <p className="mt-1 text-xs font-semibold text-slate-700">Asset ID: {request.assetId}</p>}
                      {machineMake && <p className="mt-1 text-xs text-slate-700">Machine make: {machineMake}</p>}
                      {machineType && <p className="mt-1 text-xs text-slate-700">Machine type: {machineType}</p>}
                      {request.reviewNote && <p className="mt-1 text-xs text-slate-600">CEO note: {request.reviewNote}</p>}
                    </div>
                    <a href={`/api/quotation-requests?attachment=${encodeURIComponent(request.id)}`} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100">
                      <ExternalLink className="h-3.5 w-3.5" /> View quotation
                    </a>
                  </article>
                );
              })}
            </div>}
      </section>
    </div>
  );
}
