import { after, NextResponse } from 'next/server';
import { TenantError } from '@/lib/mongodb';
import { readBody } from '@/lib/apiValidation';
import { bookQrTicket, qrAsset } from '@/lib/services/qrBooking';
import { sendTelegramAlert } from '@/lib/services/telegramService';

export const dynamic = 'force-dynamic';
function failure(error: unknown) {
  if (!(error instanceof TenantError)) console.error('QR booking failed:', error);
  return NextResponse.json({ error: error instanceof TenantError && error.statusCode !== 503 ? error.message : 'Ticket booking is temporarily unavailable. Please try again or contact maintenance.' },
    { status: error instanceof TenantError ? error.statusCode : 500, headers: { 'Cache-Control': 'no-store' } });
}
export async function GET(req: Request) {
  try {
    const params = new URL(req.url).searchParams;
    return NextResponse.json({ success: true, asset: await qrAsset(params.get('company'), params.get('id')) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return failure(error); }
}
export async function POST(req: Request) {
  try {
    const origin = req.headers.get('origin');
    if (origin && origin !== new URL(req.url).origin) throw new TenantError('Open the scanned QR link to book a ticket.', 403);
    const result = await bookQrTicket(await readBody(req));
    if (result.changed) {
      after(async () => {
      try {
        const ticket = result.ticket;
        await sendTelegramAlert({ companySlug: result.companySlug, category: 'BREAKDOWN', title: ticket.faultCategory,
          ticketId: result.ticketId, machineId: ticket.machineId, machineName: ticket.machineType,
          unit: ticket.unit, line: ticket.line, issue: ticket.faultDetails,
          severity: ticket.urgency === 'CRITICAL' ? 'CRITICAL' : 'HIGH', timestamp: ticket.reportedAt });
      } catch (error) { console.warn('QR booking notification failed:', error); }
      });
    }
    return NextResponse.json({ success: true, ticketId: result.ticketId }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return failure(error); }
}
