import { NextResponse } from 'next/server';
import { getDatabase, TenantError } from '@/lib/mongodb';
import { readBody, identifier } from '@/lib/apiValidation';
import { mongoTransaction } from '@/lib/mongoTransaction';
import { repairSpareCost } from '@/lib/repairCost';
import { mutateRepair } from '@/lib/services/repairMutation';
import { sendTelegramAlert } from '@/lib/services/telegramService';
import type { RepairTicket, SparePart } from '@/types/cmms';

export const dynamic = 'force-dynamic';
function failure(error: unknown) {
  if (error instanceof TenantError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
  console.error('Repair request failed:', error);
  return NextResponse.json({ error: 'Repair could not be saved or loaded.' }, { status: 500 });
}
export async function GET(req: Request) {
  try {
    const db = await getDatabase(req);
    const repairs = await db.collection<RepairTicket>('repair_tickets').find({}).sort({ reportedAt: -1, _id: -1 }).toArray();
    const catalog = await db.collection<SparePart>('spare_parts').find({}).toArray();
    const data = repairs.map(({ _id, laborCost, ...r }) => {
      const partsCost = repairSpareCost(r, catalog);
      return { ...r, partsCost, repairCost: partsCost, company: db.companyName, companySlug: db.tenant };
    });
    return NextResponse.json({ success: true, data });
  } catch (error) { return failure(error); }
}
async function save(req: Request, create: boolean) {
  try {
    const db = await getDatabase(req);
    const body = (await readBody(req));
    const result = await mutateRepair(db, body.id, create ? body : body.updates, create);
    if (!result) throw new TenantError('Repair could not be saved.', 500);
    const { ticket, changed } = result;
    if (changed) {
      const category = create && ticket.status !== 'COMPLETED' ? 'BREAKDOWN' : ticket.status === 'COMPLETED' ? 'RESOLVED' : ticket.status === 'REJECTED' ? 'REJECTED' : ticket.status === 'IN_PROGRESS' ? 'STARTED' : null;
      if (category) {
        try {
          const machine = await db.collection('machines').findOne({ id: ticket.machineId });
          await sendTelegramAlert({ companySlug: db.tenant, category, ticketId: ticket.id,
            title: ticket.faultCategory || 'Maintenance repair', unit: ticket.unit || machine?.unit || 'UNIT - 1',
            machineId: ticket.machineId, machineName: machine?.model || ticket.machineType || 'Machine',
            line: ticket.line || machine?.currentLine || '', issue: ticket.faultDetails || '',
            actionTaken: ticket.actionTaken, downtimeMinutes: ticket.downtimeMinutes,
            assignedTo: ticket.attendedBy || undefined, timestamp: ticket.completedAt || ticket.startedAt || ticket.reportedAt,
            severity: ticket.urgency === 'CRITICAL' ? 'CRITICAL' : 'HIGH' });
        } catch (error) { console.warn('Repair notification failed:', error); }
      }
    }
    const { _id, laborCost, ...data } = ticket;
    return NextResponse.json({ success: true, data, changed });
  } catch (error) { return failure(error); }
}
export async function POST(req: Request) { return save(req, true); }
export async function PATCH(req: Request) { return save(req, false); }
export async function DELETE(req: Request) {
  try {
    const db = await getDatabase(req);
    const url = new URL(req.url);
    // Retain stock and repair audit trails; deletion is limited to open, unused tickets.
    if (url.searchParams.get('all') === 'true') throw new TenantError('Bulk deletion is disabled to preserve repair and stock history.', 409);
    const id = identifier(url.searchParams.get('id'));
    await mongoTransaction(async session => {
      const options = { session };
      const ticket = await db.collection('repair_tickets').findOne({ id, status: { $in: ['PENDING', 'ASSIGNED'] }, 'partsUsed.0': { $exists: false } }, options);
      if (!ticket) throw new TenantError('Only unused pending tickets can be removed.', 409);
      await db.collection('repair_tickets').deleteOne({ _id: ticket._id }, options);
      const open = await db.collection('repair_tickets').findOne({ machineId: ticket.machineId, status: { $nin: ['COMPLETED', 'REJECTED'] } }, options);
      await db.collection('machines').updateOne({ id: ticket.machineId }, { $set: { status: open ? 'BREAKDOWN' : 'ACTIVE' }, $inc: { repairRevision: 1 } }, options);
    });
    return NextResponse.json({ success: true });
  } catch (error) { return failure(error); }
}
