import { NextResponse } from 'next/server';
import { getDatabase, TenantError } from '@/lib/mongodb';
import { readBody, identifier, nonnegative, pickFields, record } from '@/lib/apiValidation';

export const dynamic = 'force-dynamic';
const fields = ['sku', 'name', 'category', 'machineType', 'compat', 'stock', 'minStock', 'monthlyAllowance', 'unitCost', 'unit', 'compatibleTypes', 'shelfLocation', 'oldPartReturnRequired', 'vendor', 'sNo'];
function validate(value: unknown) {
  const result = pickFields(value, fields);
  for (const key of ['stock', 'minStock', 'monthlyAllowance', 'unitCost']) if (result[key] !== undefined) nonnegative(result[key], key);
  for (const key of ['sku', 'name', 'category', 'machineType', 'compat', 'unit', 'shelfLocation', 'vendor']) if (result[key] !== undefined && typeof result[key] !== 'string') throw new TenantError('Invalid spare details.', 400);
  if (result.compatibleTypes !== undefined && (!Array.isArray(result.compatibleTypes) || result.compatibleTypes.some(value => typeof value !== 'string'))) throw new TenantError('Invalid compatible asset types.', 400);
  return result;
}
function failure(error: unknown) {
  return NextResponse.json({ error: error instanceof TenantError ? error.message : 'Spare request failed.' }, { status: error instanceof TenantError ? error.statusCode : 500 });
}
export async function GET(req: Request) {
  try {
    const db = await getDatabase(req);
    const parts = await db.collection('spare_parts').find({}).toArray();
    return NextResponse.json({ success: true, data: parts.map(({ _id, ...part }) => ({ ...part, company: db.companyName, companySlug: db.tenant })), count: parts.length });
  } catch (error) { return failure(error); }
}
export async function POST(req: Request) {
  try {
    const db = await getDatabase(req);
    const body = (await readBody(req));
    const partId = identifier(body.partId || body.id, 'Spare ID');
    const values = validate(body);
    if (values.stock !== undefined) values.currentStock = values.stock;
    await db.collection('spare_parts').updateOne({ $or: [{ id: partId }, { partId }] }, { $set: { ...values, partId, company: db.companyName, companySlug: db.tenant } }, { upsert: true });
    return NextResponse.json({ success: true });
  } catch (error) { return failure(error); }
}
export async function PATCH(req: Request) {
  try {
    const db = await getDatabase(req);
    const body = record(await req.json());
    const partId = identifier(body.partId || body.id, 'Spare ID');
    const values = validate(body.updates || {});
    if (body.stock !== undefined) values.stock = nonnegative(body.stock, 'Stock');
    const filter: Record<string, unknown> = { $or: [{ id: partId }, { partId }] };
    let update: Record<string, unknown> | Record<string, unknown>[];
    if (body.delta !== undefined) {
      if (typeof body.delta !== 'number' || !Number.isFinite(body.delta) || body.delta === 0 || values.stock !== undefined) throw new TenantError('Invalid stock adjustment.', 400);
      if (body.delta < 0) filter.stock = { $gte: -body.delta };
      update = [{ $set: { stock: { $add: ['$stock', body.delta] } } }, { $set: { currentStock: '$stock' } }];
    } else {
      if (values.stock !== undefined) values.currentStock = values.stock;
      update = { $set: { ...values, company: db.companyName, companySlug: db.tenant } };
    }
    const part = await db.collection('spare_parts').findOneAndUpdate(filter, update, { returnDocument: 'after' });
    if (!part) throw new TenantError('Spare not found or insufficient stock.', 409);
    const { _id, ...data } = part;
    return NextResponse.json({ success: true, data });
  } catch (error) { return failure(error); }
}
export async function DELETE(req: Request) {
  try {
    const db = await getDatabase(req);
    const body = record(await req.json());
    const partId = identifier(body.partId || body.id, 'Spare ID');
    if (await db.collection('repair_tickets').findOne({ 'partsUsed.partId': partId })) throw new TenantError('Spares with usage history cannot be deleted.', 409);
    const result = await db.collection('spare_parts').deleteOne({ $or: [{ id: partId }, { partId }] });
    if (!result.deletedCount) throw new TenantError('Spare not found.', 404);
    return NextResponse.json({ success: true });
  } catch (error) { return failure(error); }
}
