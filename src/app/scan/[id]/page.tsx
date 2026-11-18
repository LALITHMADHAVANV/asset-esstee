'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useParams, usePathname, useSearchParams } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Loader2, QrCode, Wrench } from 'lucide-react';
import { finishQrBooking, qrBookingCompany, QR_FAULT_CATEGORIES } from '@/lib/qrTicket';

type ScannedAsset = { id: string; name: string; company: string; unit: string; zone: string; line: string };
function Loading() {
  return <div className="min-h-screen flex items-center justify-center gap-2 text-sm text-slate-500"><Loader2 className="w-5 h-5 animate-spin" />Opening ticket booking...</div>;
}
function TicketForm({ company, machineId }: { company: string; machineId: string }) {
  const [asset, setAsset] = useState<ScannedAsset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [category, setCategory] = useState<string>(QR_FAULT_CATEGORIES[0]);
  const [urgency, setUrgency] = useState('CRITICAL');
  const [notes, setNotes] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [booked, setBooked] = useState('');
  const requestId = useRef('');
  const inFlight = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/public/qr-tickets?company=' + encodeURIComponent(company) + '&id=' + encodeURIComponent(machineId), {
      credentials: 'omit', cache: 'no-store', signal: controller.signal,
    }).then(async response => {
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Asset could not be loaded.');
      if (!controller.signal.aborted) setAsset(result.asset);
    }).catch(failure => {
      if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Asset could not be loaded.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [company, machineId]);

  async function book(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!asset || inFlight.current || booked) return;
    inFlight.current = true; setSubmitting(true); setError('');
    if (!requestId.current) requestId.current = globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2);
    try {
      const response = await fetch('/api/public/qr-tickets', {
        method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company, machineId: asset.id, requestId: requestId.current,
          faultCategory: category, urgency, faultDetails: notes.trim(), reporterName: name.trim() }),
      });
      const result = await response.json();
      if (!response.ok || !result.success || !result.ticketId) throw new Error(result.error || 'Ticket could not be booked. Please try again.');
      setBooked(result.ticketId);
      finishQrBooking(result.ticketId);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Ticket could not be booked. Please try again.'); }
    finally { inFlight.current = false; setSubmitting(false); }
  }

  if (loading) return <Loading />;
  if (booked) return <main className="min-h-screen flex items-center justify-center p-6"><div className="text-center space-y-3"><CheckCircle2 className="w-14 h-14 text-emerald-600 mx-auto" /><h1 className="text-2xl font-bold">Ticket booked</h1><p className="text-sm text-slate-600">{booked}</p><p className="text-sm text-slate-500">You can close this tab.</p></div></main>;
  return <main className="min-h-screen bg-slate-100 px-4 py-6 sm:py-10">
    <div className="max-w-lg mx-auto bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
      <header className="bg-indigo-600 text-white p-5 space-y-2"><div className="flex items-center gap-2"><QrCode className="w-5 h-5" /><span className="text-xs font-semibold uppercase tracking-wider">Floor QR booking</span></div><h1 className="text-xl font-bold">Book a maintenance ticket</h1><p className="text-xs text-indigo-100">No login required. Report the issue and submit.</p></header>
      <div className="p-5 space-y-5">
        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />{error}</p>}
        {asset ? <>
          <section className="bg-slate-50 rounded-xl border border-slate-200 p-3"><p className="text-xs font-bold text-indigo-700">{asset.id}</p><h2 className="font-semibold text-slate-900 mt-1">{asset.name}</h2><p className="text-xs text-slate-500 mt-1">{[asset.company, asset.unit, asset.zone, asset.line].filter(Boolean).join(' · ')}</p></section>
          <form onSubmit={book} className="space-y-4">
            <fieldset disabled={submitting} className="space-y-4 disabled:opacity-70">
              <div><label htmlFor="qr-fault" className="block text-sm font-semibold text-slate-700 mb-1.5">Fault category</label><select id="qr-fault" value={category} onChange={event => setCategory(event.target.value)} className="w-full rounded-xl border border-slate-300 p-3 text-sm">{QR_FAULT_CATEGORIES.map(value => <option key={value}>{value}</option>)}</select></div>
              <div><label htmlFor="qr-priority" className="block text-sm font-semibold text-slate-700 mb-1.5">Priority</label><select id="qr-priority" value={urgency} onChange={event => setUrgency(event.target.value)} className="w-full rounded-xl border border-slate-300 p-3 text-sm"><option value="CRITICAL">Machine stopped / Urgent</option><option value="WARNING">Needs attention</option></select></div>
              <div><label htmlFor="qr-notes" className="block text-sm font-semibold text-slate-700 mb-1.5">Issue details <span className="font-normal text-slate-400">(optional)</span></label><textarea id="qr-notes" value={notes} maxLength={2000} rows={3} onChange={event => setNotes(event.target.value)} placeholder="Describe the problem..." className="w-full rounded-xl border border-slate-300 p-3 text-sm" /></div>
              <div><label htmlFor="qr-name" className="block text-sm font-semibold text-slate-700 mb-1.5">Your name <span className="font-normal text-slate-400">(optional)</span></label><input id="qr-name" value={name} maxLength={100} onChange={event => setName(event.target.value)} autoComplete="name" className="w-full rounded-xl border border-slate-300 p-3 text-sm" /></div>
              <button type="submit" disabled={submitting} className="w-full min-h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold text-sm flex items-center justify-center gap-2">{submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wrench className="w-4 h-4" />}{submitting ? 'Booking ticket...' : 'Book ticket'}</button>
            </fieldset>
          </form>
        </> : <p className="text-sm text-slate-500">Please scan a valid asset QR sticker or contact maintenance.</p>}
      </div>
    </div>
  </main>;
}
function ScanContent() {
  const params = useParams();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const company = qrBookingCompany(typeof window !== 'undefined' ? window.location.pathname : pathname, searchParams.get('company'));
  const machineId = typeof params.id === 'string' ? params.id : '';
  return <TicketForm key={company + ':' + machineId} company={company} machineId={machineId} />;
}
export default function ScanPage() {
  return <Suspense fallback={<Loading />}><ScanContent /></Suspense>;
}
