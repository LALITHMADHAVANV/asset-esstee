import { NextResponse } from 'next/server';
import { getDatabase, TenantError } from '@/lib/mongodb';
import { PPMSchedule } from '@/types/cmms';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const db = await getDatabase(req);
    const ppm = await db.collection<PPMSchedule>('ppm_schedules').find({}).toArray();
    const cleanPpm = ppm.map(({ _id, ...p }: any) => ({
      ...p,
      company: p.company || db.companyName,
      companySlug: db.tenant,
    }));
    return NextResponse.json({ success: true, data: cleanPpm });
  } catch (err: unknown) {
    if (err instanceof TenantError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    console.error('Error fetching PPM schedules from MongoDB:', err);
    return NextResponse.json({ success: false, error: (err as any)?.message || 'Database error', data: [] }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const item: PPMSchedule = await req.json();
    if (!item.id) {
      return NextResponse.json({ error: 'PPM Schedule ID is required' }, { status: 400 });
    }

    const db = await getDatabase(req);
    (item as any).company = db.companyName;
    (item as any).companySlug = db.tenant;
    await db.collection('ppm_schedules').updateOne(
      { id: item.id },
      { $set: item },
      { upsert: true }
    );

    return NextResponse.json({ success: true, message: `PPM schedule ${item.id} saved in ${db.companyName}` });
  } catch (err: unknown) {
    if (err instanceof TenantError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    console.error('Error saving PPM schedule in MongoDB:', err);
    return NextResponse.json({ error: (err as any)?.message || 'Failed to save PPM schedule' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { id, updates } = await req.json();
    if (!id || !updates) {
      return NextResponse.json({ error: 'PPM Schedule ID and updates are required' }, { status: 400 });
    }

    const db = await getDatabase(req);
    await db.collection('ppm_schedules').updateOne(
      { id },
      { $set: { ...updates, company: db.companyName, companySlug: db.tenant } },
      { upsert: true }
    );

    return NextResponse.json({ success: true, message: `PPM schedule ${id} updated in ${db.companyName}` });
  } catch (err: unknown) {
    if (err instanceof TenantError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    console.error('Error updating PPM schedule in MongoDB:', err);
    return NextResponse.json({ error: (err as any)?.message || 'Failed to update PPM schedule' }, { status: 500 });
  }
}
