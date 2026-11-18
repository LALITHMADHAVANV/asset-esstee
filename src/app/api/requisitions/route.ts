import { NextResponse } from 'next/server';
import { getDatabase, TenantError } from '@/lib/mongodb';
import { readBody, identifier, nonnegative, pickFields, record } from '@/lib/apiValidation';
import { sendTelegramAlert } from '@/lib/services/telegramService';
export const dynamic = 'force-dynamic';
const statuses = ['PENDING_CEO_APPROVAL', 'PENDING_MANAGER_APPROVAL', 'PENDING_REVIEW', 'APPROVED_BY_CEO', 'APPROVED_BY_MANAGER', 'REJECTED', 'ORDERED', 'FULFILLED'];
function failure(error: unknown) { return NextResponse.json({ error: error instanceof TenantError ? error.message : 'Requisition request failed.' }, { status: error instanceof TenantError ? error.statusCode : 500 }); }
export async function GET(req: Request) {
  try {
    const db = await getDatabase(req);
    const requests = await db.collection('part_requisitions').find({}).toArray();
    return NextResponse.json({ success: true, data: requests.map(({ _id, ...r }) => ({ ...r, company: db.companyName, companySlug: db.tenant })) });
  } catch (error) { return failure(error); }
}
export async function POST(req: Request) {
  try {
    const db = await getDatabase(req);
    const body = (await readBody(req));
    const id = identifier(body.id);
    const values = pickFields(body, ['type', 'partId', 'partName', 'quantity', 'unit', 'items', 'justification', 'estimatedCost', 'urgency', 'requestedBy', 'requestedById', 'requestedByRole', 'machineId']);
    if (!['MONTHLY_INDENT', 'URGENT_NEED', 'CRITICAL_CEO'].includes(String(values.type))) throw new TenantError('Invalid requisition type.', 400);
    if (values.quantity !== undefined && nonnegative(values.quantity, 'Quantity') <= 0) throw new TenantError('Quantity must be positive.', 400);
    if (values.estimatedCost !== undefined) nonnegative(values.estimatedCost, 'Estimated cost');
    if (values.items !== undefined) {
      if (!Array.isArray(values.items) || !values.items.length || values.items.length > 100) throw new TenantError('Invalid requisition items.', 400);
      for (const item of values.items) {
        const part = record(item);
        identifier(part.partId, 'Spare ID');
        if (nonnegative(part.quantity, 'Quantity') <= 0) throw new TenantError('Quantity must be positive.', 400);
        nonnegative(part.unitCost, 'Unit cost');
        nonnegative(part.totalCost, 'Total cost');
      }
    }
    if (await db.collection('part_requisitions').findOne({ id })) throw new TenantError('Requisition ID already exists.', 409);
    const status = values.type === 'CRITICAL_CEO' ? 'PENDING_CEO_APPROVAL' : values.type === 'URGENT_NEED' ? 'PENDING_MANAGER_APPROVAL' : 'PENDING_REVIEW';
    await db.collection('part_requisitions').insertOne({ ...values, id, status, requestedBy: db.sessionUser!.name, requestedById: db.sessionUser!.uid, createdAt: new Date().toISOString(), company: db.companyName, companySlug: db.tenant });
    return NextResponse.json({ success: true });
  } catch (error) { return failure(error); }
}
export async function PATCH(req: Request) {
  try {
    const db = await getDatabase(req);
    const body = record(await req.json());
    const id = identifier(body.id);
    const values = pickFields(body.updates, ['status', 'reviewNotes', 'assignedStorePerson', 'fulfilledAt', 'storeNotes']);
    if (!statuses.includes(String(values.status))) throw new TenantError('Invalid requisition status.', 400);
    for (const value of Object.values(values)) if (typeof value !== 'string') throw new TenantError('Invalid requisition details.', 400);
    const role = String(db.sessionUser!.role).toUpperCase();
    const admin = ['ADMIN', 'ASSET_MANAGER'].includes(role);
    const manager = admin || ['SENIOR_MECHANIC', 'SENIOR_ELECTRICIAN'].includes(role);
    const store = admin || role === 'STORE_PERSON';
    const ceo = admin || role === 'CEO';
    const existing = await db.collection('part_requisitions').findOne({ id });
    if (!existing) throw new TenantError('Requisition not found.', 404);
    if (values.status === existing.status) return NextResponse.json({ success: true });
    if (['FULFILLED', 'REJECTED'].includes(existing.status)) throw new TenantError('This requisition is already closed.', 409);
    const allowed = values.status === 'APPROVED_BY_CEO' ? ceo && existing.status === 'PENDING_CEO_APPROVAL'
      : values.status === 'APPROVED_BY_MANAGER' ? (manager && existing.status === 'PENDING_MANAGER_APPROVAL' || (manager || store) && existing.status === 'PENDING_REVIEW' && existing.type === 'MONTHLY_INDENT')
      : values.status === 'REJECTED' ? existing.type === 'CRITICAL_CEO' ? ceo : manager || store
      : values.status === 'ORDERED' ? store && ['PENDING_REVIEW', 'APPROVED_BY_CEO', 'APPROVED_BY_MANAGER'].includes(existing.status)
      : values.status === 'FULFILLED' ? store && ['ORDERED', 'APPROVED_BY_CEO', 'APPROVED_BY_MANAGER'].includes(existing.status) : false;
    if (!allowed) throw new TenantError('You cannot perform this approval or store transition.', 403);
    const result = await db.collection('part_requisitions').updateOne({ _id: existing._id, status: existing.status }, { $set: { ...values, reviewedBy: db.sessionUser!.name, reviewedAt: new Date().toISOString() } });
    if (!result.matchedCount) throw new TenantError('Requisition changed elsewhere. Refresh and try again.', 409);
    if (values.status === 'REJECTED') {
      try { await sendTelegramAlert({ companySlug: db.tenant, category: 'REJECTED', ticketId: id, title: 'Store requisition declined', unit: existing.unit || 'UNIT - 1', issue: String(values.reviewNotes || 'Declined by reviewer'), timestamp: new Date() }); }
      catch (error) { console.warn('Requisition notification failed:', error); }
    }
    return NextResponse.json({ success: true });
  } catch (error) { return failure(error); }
}
