import { NextResponse } from 'next/server';
import { getDatabase, TenantError } from '@/lib/mongodb';
import { readBody, identifier, record, nonnegative } from '@/lib/apiValidation';
import { mongoTransaction } from '@/lib/mongoTransaction';

export const dynamic = 'force-dynamic';
function failure(error: unknown) {
  return NextResponse.json({ error: error instanceof TenantError ? error.message : 'Asset request failed.' }, { status: error instanceof TenantError ? error.statusCode : 500 });
}
function validate(value: unknown) {
  const input = record(value);
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (['_id', 'id', 'company', 'companySlug', 'totalDowntimeMinutes', 'repairRevision', 'assetRevision'].includes(key)) continue;
    if (key.startsWith('$') || key.includes('.')) throw new TenantError('Invalid asset field.', 400);
    result[key] = value;
  }
  if (result.cost !== undefined) nonnegative(result.cost, 'Asset cost');
  if (result.status !== undefined && !['ACTIVE', 'BREAKDOWN', 'UNDER_MAINTENANCE', 'BUFFER', 'SCRAP', 'IDLE'].includes(String(result.status))) throw new TenantError('Invalid asset status.', 400);
  return result;
}
export async function GET(req: Request) {
  try {
    const db = await getDatabase(req);
    const id = new URL(req.url).searchParams.get('id');
    if (id !== null) {
      const asset = await db.collection('machines').findOne({ id: identifier(id) }, { collation: { locale: 'en', strength: 2 } });
      if (!asset) throw new TenantError('Machine not found.', 404);
      const { _id, ...data } = asset;
      return NextResponse.json({ success: true, data });
    }
    const assets = await db.collection('machines').find({}).toArray();
    return NextResponse.json({ success: true, data: assets.map(({ _id, ...asset }) => ({ ...asset, company: db.companyName, companySlug: db.tenant })), count: assets.length });
  } catch (error) { return failure(error); }
}
export async function POST(req: Request) {
  try {
    const db = await getDatabase(req);
    const body = (await readBody(req));
    const id = identifier(body.id);
    const asset = validate(body);
    await mongoTransaction(async session => {
      const values = { ...asset };
      if (values.status === 'ACTIVE' && await db.collection('repair_tickets').findOne({ machineId: id, status: { $nin: ['COMPLETED', 'REJECTED'] } }, { session })) values.status = 'BREAKDOWN';
      await db.collection('machines').updateOne({ id }, { $set: { ...values, id, company: db.companyName, companySlug: db.tenant }, $inc: { assetRevision: 1 } }, { upsert: true, session });
    });
    return NextResponse.json({ success: true });
  } catch (error) { return failure(error); }
}
export async function PATCH(req: Request) {
  try {
    const db = await getDatabase(req);
    const body = record(await req.json());
    const id = identifier(body.id);
    const updates = validate(body.updates);
    const result = await mongoTransaction(async session => {
      const values = { ...updates };
      if (values.status === 'ACTIVE') {
        const open = await db.collection('repair_tickets').findOne({ machineId: id, status: { $nin: ['COMPLETED', 'REJECTED'] } }, { session });
        if (open) values.status = 'BREAKDOWN';
      }
      return db.collection('machines').updateOne({ id }, { $set: { ...values, company: db.companyName, companySlug: db.tenant }, $inc: { assetRevision: 1 } }, { session });
    });
    if (!result.matchedCount) throw new TenantError('Asset not found.', 404);
    return NextResponse.json({ success: true, matchedCount: result.matchedCount });
  } catch (error) { return failure(error); }
}
export async function DELETE(req: Request) {
  try {
    const db = await getDatabase(req);
    const id = identifier(record(await req.json()).id);
    if (await db.collection('repair_tickets').findOne({ machineId: id })) throw new TenantError('Assets with repair history must be retired instead of deleted.', 409);
    const result = await db.collection('machines').deleteOne({ id });
    if (!result.deletedCount) throw new TenantError('Asset not found.', 404);
    return NextResponse.json({ success: true, deletedCount: result.deletedCount });
  } catch (error) { return failure(error); }
}
