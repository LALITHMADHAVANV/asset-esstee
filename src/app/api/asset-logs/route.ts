import { NextResponse } from 'next/server';
import { getDatabase, TenantError } from '@/lib/mongodb';
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
    const entry: AssetLogEntry = await req.json();
    if (!entry.id || !entry.machineId) {
      return NextResponse.json({ error: 'Entry ID and Machine ID are required' }, { status: 400 });
    }

    const db = await getDatabase(req);
    (entry as any).company = db.companyName;
    (entry as any).companySlug = db.tenant;
    await db.collection('asset_logs').insertOne(entry);

    // Also update machine status in MongoDB
    if (entry.newStatus) {
      const updates: any = { status: entry.newStatus, company: db.companyName, companySlug: db.tenant };
      if (entry.zone) updates.zone = entry.zone;
      if (entry.line) updates.currentLine = entry.line;
      if (entry.stationNo) updates.stationNo = entry.stationNo;

      await db.collection('machines').updateOne(
        { id: entry.machineId },
        { $set: updates }
      );
    }

    return NextResponse.json({ success: true, message: `Asset log ${entry.id} saved in ${db.companyName}` });
  } catch (err: unknown) {
    if (err instanceof TenantError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    console.error('Error saving asset log in MongoDB:', err);
    return NextResponse.json({ error: (err as any)?.message || 'Failed to save asset log' }, { status: 500 });
  }
}
