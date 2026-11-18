import { NextResponse } from 'next/server';
import { getDatabase, TenantError } from '@/lib/mongodb';
import { PartRequisition } from '@/types/cmms';
import { sendTelegramAlert } from '@/lib/services/telegramService';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const db = await getDatabase(req);
    const reqs = await db.collection<PartRequisition>('part_requisitions').find({}).toArray();
    const cleanReqs = reqs.map(({ _id, ...r }: any) => ({
      ...r,
      company: r.company || db.companyName,
      companySlug: db.tenant,
    }));
    return NextResponse.json({ success: true, data: cleanReqs });
  } catch (err: unknown) {
    if (err instanceof TenantError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    console.error('Error fetching requisitions from MongoDB:', err);
    return NextResponse.json({ success: false, error: (err as any)?.message || 'Database error', data: [] }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const requisition: PartRequisition = await req.json();
    if (!requisition.id) {
      return NextResponse.json({ error: 'Requisition ID is required' }, { status: 400 });
    }

    const db = await getDatabase(req);
    (requisition as any).company = db.companyName;
    (requisition as any).companySlug = db.tenant;
    await db.collection('part_requisitions').updateOne(
      { id: requisition.id },
      { $set: requisition },
      { upsert: true }
    );

    return NextResponse.json({ success: true, message: `Requisition ${requisition.id} saved in ${db.companyName}` });
  } catch (err: unknown) {
    if (err instanceof TenantError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    console.error('Error saving requisition in MongoDB:', err);
    return NextResponse.json({ error: (err as any)?.message || 'Failed to save requisition' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { id, updates } = await req.json();
    if (!id || !updates) {
      return NextResponse.json({ error: 'Requisition ID and updates are required' }, { status: 400 });
    }

    const db = await getDatabase(req);
    await db.collection('part_requisitions').updateOne(
      { id },
      { $set: { ...updates, company: db.companyName, companySlug: db.tenant } }
    );

    if (updates.status === 'REJECTED') {
      try {
        const reqDoc = await db.collection('part_requisitions').findOne({ id });
        const targetUnit = (reqDoc as any)?.targetUnit || (reqDoc as any)?.unit || 'UNIT - 1';
        await sendTelegramAlert({
          companySlug: db.tenant,
          category: 'REJECTED',
          ticketId: id,
          title: 'Store Indent Requisition Declined',
          unit: targetUnit,
          machineName: (reqDoc as any)?.partName || (reqDoc as any)?.items?.[0]?.name || 'Spare Part Indent',
          issue: updates.reviewNotes || (reqDoc as any)?.reviewNotes || 'Declined by stores/management',
          actionTaken: updates.reviewNotes || 'Requisition rejected by reviewer',
          assignedTo: (reqDoc as any)?.reviewedBy || 'Stores Reviewer',
          severity: 'WARNING',
          timestamp: new Date(),
        });
      } catch (tgErr) {
        console.warn('Telegram rejection alert warning:', tgErr);
      }
    }

    return NextResponse.json({ success: true, message: `Requisition ${id} updated in ${db.companyName}` });
  } catch (err: unknown) {
    if (err instanceof TenantError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.statusCode });
    }
    console.error('Error updating requisition in MongoDB:', err);
    return NextResponse.json({ error: (err as any)?.message || 'Failed to update requisition' }, { status: 500 });
  }
}
