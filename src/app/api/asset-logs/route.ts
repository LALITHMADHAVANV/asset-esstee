import { NextResponse } from 'next/server';
import { getDatabase, TenantError } from '@/lib/mongodb';
import { mongoTransaction } from '@/lib/mongoTransaction';
import { readBody, identifier, pickFields } from '@/lib/apiValidation';
import { AssetLogEntry } from '@/types/cmms';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const db = await getDatabase(req);
    const logs = await db.collection<AssetLogEntry>('asset_logs').find({}).sort({ changedAt: -1 }).limit(200).toArray();
    const cleanLogs = logs.map(({ _id, ...l }: any) => ({
      ...l,
      company: l.company || db.companyName,
      companySlug: db.tenant,
    }));
    return NextResponse.json({ success: true, data: cleanLogs });
  } catch (err: unknown) {
    if (err instanceof TenantError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    console.error('Error fetching asset logs from MongoDB:', err);
    return NextResponse.json({ success: false, error: (err as any)?.message || 'Database error', data: [] }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const db = await getDatabase(req);
    const body = await readBody(req);
    const id = identifier(body.id);
    const machineId = identifier(body.machineId, 'Asset ID');
    const entry = pickFields(body, ['machineName', 'machineType', 'brand', 'model', 'zone', 'line', 'stationNo', 'unit', 'machineUnit', 'newStatus', 'action', 'notes', 'shift']);
    for (const value of Object.values(entry)) if (typeof value !== 'string') throw new TenantError('Invalid asset log details.', 400);
    if (entry.newStatus !== undefined && !['ACTIVE', 'IDLE', 'BUFFER', 'BREAKDOWN', 'UNDER_MAINTENANCE', 'SCRAP'].includes(String(entry.newStatus))) throw new TenantError('Invalid asset status.', 400);
    await mongoTransaction(async session => {
      const options = { session };
      if (await db.collection('asset_logs').findOne({ id }, options)) return;
      const machine = await db.collection('machines').findOne({ id: machineId }, options);
      if (!machine) throw new TenantError('Asset not found.', 404);
      const updates: Record<string, unknown> = {};
      if (entry.newStatus) updates.status = entry.newStatus;
      if (entry.zone) updates.zone = entry.zone;
      if (entry.line) updates.currentLine = entry.line;
      if (entry.stationNo) updates.stationNo = entry.stationNo;
      if (updates.status === 'ACTIVE' && await db.collection('repair_tickets').findOne({ machineId, status: { $nin: ['COMPLETED', 'REJECTED'] } }, options)) updates.status = 'BREAKDOWN';
      await db.collection('machines').updateOne({ _id: machine._id }, { $set: updates, $inc: { assetRevision: 1 } }, options);
      await db.collection('asset_logs').insertOne({ ...entry, id, machineId, previousStatus: machine.status,
        newStatus: updates.status || machine.status, changedBy: db.sessionUser!.name, changedAt: new Date().toISOString(),
        company: db.companyName, companySlug: db.tenant }, options);
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof TenantError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    console.error('Asset log save failed:', error);
    return NextResponse.json({ error: 'Asset log could not be saved.' }, { status: 500 });
  }
}
