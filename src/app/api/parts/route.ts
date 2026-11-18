import { NextResponse } from 'next/server';
import { getDatabase, TenantError } from '@/lib/mongodb';
import { SparePart } from '@/types/cmms';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const db = await getDatabase(req);
    const col = db.collection<SparePart>('spare_parts');
    const parts = await col.find({}).toArray();

    const cleanParts = (parts || []).map(({ _id, ...p }: any) => ({
      ...p,
      company: p.company || db.companyName,
      companySlug: db.tenant,
    }));
    return NextResponse.json({ success: true, data: cleanParts, count: cleanParts.length });
  } catch (err: unknown) {
    if (err instanceof TenantError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    console.error('Error fetching parts from MongoDB:', err);
    return NextResponse.json({ success: false, error: (err as any)?.message || 'Failed to fetch parts', data: [] }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const part = (await req.json()) as Partial<SparePart> & { id?: string; company?: string; companySlug?: string };
    const key = part.partId || part.id;
    if (!key) {
      return NextResponse.json({ error: 'Part ID is required' }, { status: 400 });
    }

    const db = await getDatabase(req);
    part.company = db.companyName;
    part.companySlug = db.tenant;

    await db.collection('spare_parts').updateOne(
      { $or: [{ id: key }, { partId: key }] },
      { $set: part },
      { upsert: true }
    );

    return NextResponse.json({ success: true, message: `Part ${key} saved in ${db.companyName}` });
  } catch (err: unknown) {
    if (err instanceof TenantError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    console.error('Error saving part in MongoDB:', err);
    return NextResponse.json({ error: (err as any)?.message || 'Failed to save part' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { id, partId, stock, updates } = await req.json();
    const key = partId || id;
    if (!key) {
      return NextResponse.json({ error: 'Part ID is required' }, { status: 400 });
    }

    const db = await getDatabase(req);
    const updatePayload = updates || {};
    if (typeof stock === 'number') {
      updatePayload.stock = stock;
      updatePayload.currentStock = stock;
    }
    updatePayload.company = db.companyName;
    updatePayload.companySlug = db.tenant;

    await db.collection('spare_parts').updateOne(
      { $or: [{ id: key }, { partId: key }] },
      { $set: updatePayload }
    );

    return NextResponse.json({ success: true, message: `Part ${key} updated in ${db.companyName}` });
  } catch (err: unknown) {
    if (err instanceof TenantError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    console.error('Error updating part stock in MongoDB:', err);
    return NextResponse.json({ error: (err as any)?.message || 'Failed to update part' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { id, partId } = await req.json();
    const key = partId || id;
    if (!key) {
      return NextResponse.json({ error: 'Part ID is required' }, { status: 400 });
    }

    const db = await getDatabase(req);
    await db.collection('spare_parts').deleteOne({
      $or: [{ id: key }, { partId: key }],
    });

    return NextResponse.json({ success: true, message: `Part ${key} deleted from ${db.companyName}` });
  } catch (err: unknown) {
    if (err instanceof TenantError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    console.error('Error deleting part from MongoDB:', err);
    return NextResponse.json({ error: (err as any)?.message || 'Failed to delete part' }, { status: 500 });
  }
}
