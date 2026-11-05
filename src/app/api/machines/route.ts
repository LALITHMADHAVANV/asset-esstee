import { NextResponse } from 'next/server';
import { getDatabase, TenantError } from '@/lib/mongodb';
import { Machine } from '@/types/cmms';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const db = await getDatabase(req);
    const url = new URL(req.url);
    const specificId = url.searchParams.get('id');

    if (specificId) {
      const single = await db.collection<Machine>('machines').findOne({
        id: { $regex: new RegExp(`^${specificId}$`, 'i') },
      });
      if (single) {
        const { _id, ...clean } = single as any;
        return NextResponse.json({ success: true, data: clean });
      }
      return NextResponse.json({ success: false, error: 'Machine not found' }, { status: 404 });
    }

    const machines = await db.collection<Machine>('machines').find({}).toArray();
    const cleanMachines = (machines || []).map(({ _id, ...m }: any) => ({
      ...m,
      company: m.company || db.companyName,
      companySlug: db.tenant,
    }));

    return NextResponse.json({ success: true, data: cleanMachines, count: cleanMachines.length });
  } catch (err: unknown) {
    if (err instanceof TenantError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    console.error('API /machines GET error:', err);
    return NextResponse.json({ error: (err as any)?.message || 'Failed to fetch machines' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const machine: Machine = await req.json();
    if (!machine.id) {
      return NextResponse.json({ error: 'Machine ID is required' }, { status: 400 });
    }

    const db = await getDatabase(req);
    machine.company = db.companyName;
    (machine as any).companySlug = db.tenant;

    await db.collection('machines').updateOne(
      { id: machine.id },
      { $set: machine },
      { upsert: true }
    );

    return NextResponse.json({
      success: true,
      message: `Machine ${machine.id} saved in ${db.companyName}`,
      company: db.companyName,
    });
  } catch (err: unknown) {
    if (err instanceof TenantError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    console.error('API /machines POST error:', err);
    return NextResponse.json({ error: (err as any)?.message || 'Failed to save machine' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { id, updates } = await req.json();
    if (!id || !updates) {
      return NextResponse.json({ error: 'Machine ID and updates are required' }, { status: 400 });
    }

    const { _id, ...safeUpdates } = updates;
    const db = await getDatabase(req);

    const result = await db.collection('machines').updateOne(
      { id },
      { $set: { ...safeUpdates, company: db.companyName, companySlug: db.tenant } }
    );

    return NextResponse.json({
      success: true,
      message: `Machine ${id} updated in ${db.companyName}`,
      matchedCount: result.matchedCount,
    });
  } catch (err: unknown) {
    if (err instanceof TenantError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    console.error('API /machines PATCH error:', err);
    return NextResponse.json({ error: (err as any)?.message || 'Failed to update machine' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'Machine ID is required' }, { status: 400 });
    }

    const db = await getDatabase(req);
    const result = await db.collection('machines').deleteOne({ id });

    return NextResponse.json({
      success: true,
      message: `Machine ${id} deleted from ${db.companyName}`,
      deletedCount: result.deletedCount,
    });
  } catch (err: unknown) {
    if (err instanceof TenantError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    console.error('API /machines DELETE error:', err);
    return NextResponse.json({ error: (err as any)?.message || 'Failed to delete machine' }, { status: 500 });
  }
}
