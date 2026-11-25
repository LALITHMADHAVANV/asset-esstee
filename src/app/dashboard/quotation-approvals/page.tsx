'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Check, ExternalLink, LoaderCircle, RotateCw, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { apiFetch } from '@/lib/services/cmmsService';
import type { QuotationApprovalRequest } from '@/types/cmms';

function statusStyle(status: QuotationApprovalRequest['status']) {
  if (status === 'APPROVED_BY_CEO') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'REJECTED') return 'bg-rose-50 text-rose-700 border-rose-200';
  return 'bg-amber-50 text-amber-800 border-amber-200';
}

export default function QuotationApprovalsPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const [requests, setRequests] = useState<QuotationApprovalRequest[]>([]);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState('');
  const [activeRequestId, setActiveRequestId] = useState('');

  const loadRequests = useCallback(async () => {
    try {
      const response = await apiFetch('/api/quotation-requests');
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not load approval requests.');
      setRequests(Array.isArray(result.data) ? result.data : []);
      setPageError('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not load approval requests.';
      setPageError(message);
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    // The loader updates state only after its API request settles.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (user) void loadRequests();
  }, [loadRequests, user]);

  const reviewRequest = async (request: QuotationApprovalRequest, status: 'APPROVED_BY_CEO' | 'REJECTED') => {
    const reviewNote = (reviewNotes[request.id] || '').trim();
    if (status === 'REJECTED' && !reviewNote) {
      showToast('Add a reason before rejecting this request.', 'error');
      return;
    }

    setActiveRequestId(request.id);
    try {
      const response = await apiFetch('/api/quotation-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: request.id, status, reviewNote }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not update this request.');
      showToast(status === 'APPROVED_BY_CEO' ? 'Quotation request approved.' : 'Quotation request rejected.', 'success');
      await loadRequests();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not update this request.', 'error');
    } finally {
      setActiveRequestId('');
    }
  };

  const pendingCount = requests.filter((request) => request.status === 'PENDING_CEO_APPROVAL').length;

  return (
    <div className="space-y-6">
      <header className="rounded-2xl bg-slate-950 p-6 text-white shadow-lg">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-200">CEO Review</p>
            <h1 className="mt-1 text-2xl font-black">Quotation Approvals</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">Review independently submitted quotation requests and attachments. This approval flow is separate from the DC system.</p>
          </div>
          <div className="flex items-center gap-2 self-start rounded-xl bg-white/10 px-4 py-3 sm:self-auto">
            <span className="text-2xl font-black">{pendingCount}</span>
            <span className="text-xs font-semibold text-slate-300">pending review</span>
          </div>
        </div>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div><h2 className="text-base font-black text-slate-900">Requests and quotations</h2><p className="mt-1 text-xs text-slate-500">A valid quotation is required for every request.</p></div>
          <button type="button" onClick={() => { setLoading(true); void loadRequests(); }} disabled={loading} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            <RotateCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        {pageError && <p role="alert" className="mb-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{pageError}</p>}
        {loading ? <div className="flex items-center gap-2 py-10 text-sm text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" />Loading approval requests…</div> :
          requests.length === 0 ? <p className="py-10 text-center text-sm text-slate-500">No quotation requests have been submitted.</p> :
            <div className="space-y-4">
              {requests.map((request) => {
                const isPending = request.status === 'PENDING_CEO_APPROVAL';
                const isBusy = activeRequestId === request.id;
                return (
                  <article key={request.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-black text-slate-900">{request.quotationName}</h3>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black uppercase ${statusStyle(request.status)}`}>{request.status.replaceAll('_', ' ')}</span>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">Request ID: {request.id}</p>
                        <p className="mt-2 text-[11px] text-slate-400">Requested by {request.requestedBy} · {new Date(request.requestedAt).toLocaleString()}</p>
                        {request.reviewNote && <p className="mt-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-700">Review note: {request.reviewNote}</p>}
                        <a
                          href={`/api/quotation-requests?attachment=${encodeURIComponent(request.id)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 inline-flex items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100"
                        >
                          <ExternalLink className="h-3.5 w-3.5" /> View quotation ({request.quotationName})
                        </a>
                      </div>

                      {isPending && (
                        <div className="w-full space-y-3 xl:max-w-sm">
                          <label className="block">
                            <span className="mb-1 block text-[11px] font-bold text-slate-600">Review note {request.reviewNote ? '(optional)' : '(required if rejecting)'}</span>
                            <textarea
                              value={reviewNotes[request.id] || ''}
                              onChange={(event) => setReviewNotes((current) => ({ ...current, [request.id]: event.target.value }))}
                              maxLength={500}
                              rows={2}
                              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                              placeholder="Add a note or rejection reason"
                            />
                          </label>
                          <div className="flex gap-2">
                            <button type="button" disabled={isBusy} onClick={() => void reviewRequest(request, 'APPROVED_BY_CEO')} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                              {isBusy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Approve
                            </button>
                            <button type="button" disabled={isBusy} onClick={() => void reviewRequest(request, 'REJECTED')} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2.5 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50">
                              <X className="h-3.5 w-3.5" /> Reject
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>}
      </section>
    </div>
  );
}
