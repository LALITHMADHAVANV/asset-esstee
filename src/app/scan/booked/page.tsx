import { CheckCircle2 } from 'lucide-react';

export default async function TicketBookedPage({ searchParams }: { searchParams: Promise<{ ticket?: string }> }) {
  const { ticket } = await searchParams;
  return <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
    <div className="max-w-sm text-center space-y-4">
      <CheckCircle2 className="w-16 h-16 text-emerald-600 mx-auto" />
      <h1 className="text-2xl font-bold text-slate-900">Ticket booked</h1>
      <p className="text-sm text-slate-600">Your maintenance request has been sent.</p>
      {typeof ticket === 'string' && ticket.startsWith('WO-QR-') && ticket.length <= 60 && <p className="text-xs font-mono text-slate-500 break-all">{ticket}</p>}
      <p className="text-sm text-slate-500">You can close this tab now.</p>
    </div>
  </main>;
}
