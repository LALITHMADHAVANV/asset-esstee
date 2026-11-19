import { NextResponse } from 'next/server';
import { getDatabase, TenantError } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

function failure(error: unknown) {
  if (error instanceof TenantError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
  return NextResponse.json({ error: 'Unable to load or save locations.' }, { status: 500 });
}

export async function GET(req: Request) {
  try {
    const db = await getDatabase(req);
    if (!db.sessionUser) throw new TenantError('Please sign in.', 401);
    const rows = await db.collection('asset_locations').find({}).sort({ name: 1 }).toArray();
    return NextResponse.json({ locations: rows.map(row => row.name) });
  } catch (error) { return failure(error); }
}

export async function POST(req: Request) {
  try {
    const db = await getDatabase(req);
    if (!db.sessionUser) throw new TenantError('Please sign in.', 401);
    if (!['ADMIN', 'ASSET_MANAGER'].includes(String(db.sessionUser.role).toUpperCase())) throw new TenantError('Administrator access required.', 403);
    const body = await req.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name || name.length > 100) return NextResponse.json({ error: 'Enter a location up to 100 characters.' }, { status: 400 });
    const locations = db.collection('asset_locations');
    await locations.createIndex({ key: 1 }, { unique: true });
    const key = name.toLowerCase();
    // A stable unique key also makes concurrent additions of the same name safe.
    try {
      await locations.updateOne({ key }, { $setOnInsert: { key, name } }, { upsert: true });
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
    }
    const saved = await locations.findOne({ key });
    return NextResponse.json({ name: saved?.name || name });
  } catch (error) { return failure(error); }
}
