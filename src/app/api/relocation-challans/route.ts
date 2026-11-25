import { NextResponse } from 'next/server';
import { getDatabase, TenantError } from '@/lib/mongodb';
import { normalizeRole } from '@/lib/constants/roles';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function getIndiaDate(now: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return {
    year: values.year,
    month: values.month,
    day: values.day,
  };
}

export async function GET(req: Request) {
  try {
    const db = await getDatabase(req);
    if (!db.sessionUser) throw new TenantError('Please sign in to view delivery challans.', 401, 'AUTH_REQUIRED');
    const records = await db.rawCollection('relocation_challans').find({})
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();
    return NextResponse.json({ success: true, data: records.map((entry) => {
      const record: Record<string, unknown> = { ...entry };
      delete record._id;
      return record;
    }) });
  } catch (error: unknown) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    console.error('Error loading relocation delivery challans:', error);
    return NextResponse.json({ error: 'Failed to load delivery challans.' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Submit a valid delivery challan request.' }, { status: 400 });
    }

    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: 'Submit a valid delivery challan request.' }, { status: 400 });
    }
    const payload = body as Record<string, unknown>;
    const requestId = typeof payload.requestId === 'string' ? payload.requestId.trim() : '';
    const rawAssetIds = Array.isArray(payload.assetIds) ? payload.assetIds : [payload.assetId];
    if (!requestId || requestId.length > 100 || rawAssetIds.length === 0 || rawAssetIds.length > 50 ||
      rawAssetIds.some((id) => typeof id !== 'string' || !id.trim())) {
      return NextResponse.json({ error: 'Request ID and between 1 and 50 valid assets are required.' }, { status: 400 });
    }
    const assetIds = [...new Set(rawAssetIds.filter((id): id is string => typeof id === 'string').map((id) => id.trim()))];
    const destination = typeof payload.destination === 'string' ? payload.destination.trim() : '';
    const dcType = payload.dcType === undefined ? 'DELIVERY_CHALLAN' : payload.dcType;
    if (dcType !== 'RETURNABLE_DELIVERY_CHALLAN' && dcType !== 'DELIVERY_CHALLAN') {
      return NextResponse.json({ error: 'Choose a valid delivery challan type.' }, { status: 400 });
    }
    if (!destination || destination.length > 120 || assetIds.some((id) => id.length > 100)) {
      return NextResponse.json({ error: 'A valid destination and asset selection are required.' }, { status: 400 });
    }
    const db = await getDatabase(req);
    if (!db.sessionUser) throw new TenantError('Please sign in to generate a delivery challan.', 401, 'AUTH_REQUIRED');
    const challans = db.rawCollection('relocation_challans');
    await challans.createIndex({ requestId: 1 }, { unique: true });

    const existing = await challans.findOne({ requestId });
    if (existing?.dcNumber) {
      return NextResponse.json({
        success: true,
        dcNumber: existing.dcNumber,
        dcDate: existing.dcDate,
      });
    }

    const machines = await db.rawCollection('machines').find({ id: { $in: assetIds } }).toArray();
    const machinesById = new Map(machines.map((machine) => [machine.id, machine]));
    if (machinesById.size !== assetIds.length) {
      return NextResponse.json({ error: 'One or more selected assets were not found in this workspace.' }, { status: 404 });
    }
    const assets = assetIds.map((id) => {
      const machine = machinesById.get(id);
      if (!machine) throw new Error(`Selected asset ${id} was not loaded.`);
      return {
        machineId: machine.id,
        category: machine.category || machine.type?.split('_')[0] || 'MACHINE',
        machineType: machine.typeName || machine.type || 'Equipment',
        brand: machine.brand || '',
        model: machine.model || '',
        unit: machine.unit || '',
      };
    });

    const now = new Date();
    const { year, month, day } = getIndiaDate(now);
    const counterId = `esstee-ams-${year}-${month}`;
    const counter = await db.rawCollection<{ _id: string; sequence: number }>('relocation_challan_counters').findOneAndUpdate(
      { _id: counterId },
      { $inc: { sequence: 1 } },
      { upsert: true, returnDocument: 'after', includeResultMetadata: false }
    );
    if (!counter) throw new Error('Failed to allocate a delivery challan number.');

    const dcNumber = `esstee/AMS/${String(counter.sequence).padStart(3, '0')}/${month}/${year.slice(-2)}`;
    const dcDate = `${day}.${month}.${year.slice(-2)}`;
    const record = {
      requestId,
      dcNumber,
      dcDate,
      assetId: assetIds[0],
      category: assets[0]?.category || 'MACHINE',
      destination,
      assetIds,
      assets,
      dcType,
      createdAt: now.toISOString(),
      createdById: db.sessionUser.uid,
      createdBy: db.sessionUser.name,
      company: db.companyName,
      companySlug: db.tenant,
    };

    try {
      await challans.insertOne(record);
    } catch (error) {
      const duplicate = error && typeof error === 'object' && 'code' in error && error.code === 11000;
      if (!duplicate) throw error;
      const alreadyCreated = await challans.findOne({ requestId });
      if (alreadyCreated?.dcNumber) {
        return NextResponse.json({
          success: true,
          dcNumber: alreadyCreated.dcNumber,
          dcDate: alreadyCreated.dcDate,
        });
      }
      throw error;
    }

    return NextResponse.json({ success: true, dcNumber, dcDate });
  } catch (error: unknown) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    console.error('Error generating relocation delivery challan:', error);
    return NextResponse.json(
      { error: 'Failed to generate the relocation delivery challan number.' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const db = await getDatabase(req);
    const sessionUser = db.sessionUser;
    if (!sessionUser) throw new TenantError('Please sign in to delete a delivery challan.', 401, 'AUTH_REQUIRED');

    const role = normalizeRole(sessionUser.role);
    if (!['SENIOR_MECHANIC', 'SENIOR_ELECTRICIAN', 'CEO', 'ADMIN', 'ASSET_MANAGER'].includes(role)) {
      throw new TenantError('You do not have permission to delete delivery challan records.', 403, 'FORBIDDEN');
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'A challan request ID is required.' }, { status: 400 });
    }
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: 'A challan request ID is required.' }, { status: 400 });
    }
    const requestIdValue = (body as Record<string, unknown>).requestId;
    const requestId = typeof requestIdValue === 'string' ? requestIdValue.trim() : '';
    if (!requestId || requestId.length > 100) {
      return NextResponse.json({ error: 'A valid challan request ID is required.' }, { status: 400 });
    }

    const result = await db.rawCollection('relocation_challans').deleteOne({ requestId });
    if (result.deletedCount === 0) {
      return NextResponse.json({ error: 'Delivery challan record not found.' }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: 'Delivery challan record deleted.' });
  } catch (error: unknown) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.statusCode });
    }
    console.error('Error deleting relocation delivery challan:', error);
    return NextResponse.json({ error: 'Failed to delete the delivery challan record.' }, { status: 500 });
  }
}