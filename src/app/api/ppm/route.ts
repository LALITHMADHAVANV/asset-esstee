import { NextResponse } from 'next/server';
import { getDatabase, TenantError } from '@/lib/mongodb';
import { readBody, identifier, nonnegative, pickFields, record } from '@/lib/apiValidation';
export const dynamic = 'force-dynamic';
const fields = ['machineId', 'unit', 'task', 'intervalDays', 'frequency', 'lastServiced', 'nextDue', 'status', 'assignedTo', 'assignedBy', 'startedAt', 'completedAt', 'completionProofImage', 'actualDurationMinutes', 'technicianNotes'];
function validate(value: unknown) {
  const values = pickFields(value, fields);
  if (values.machineId !== undefined) identifier(values.machineId, 'Asset ID');
  for (const key of ['intervalDays', 'actualDurationMinutes']) if (values[key] !== undefined) nonnegative(values[key], key);
  if (values.status !== undefined && !['PENDING', 'SCHEDULED', 'DUE_SOON', 'OVERDUE', 'IN_PROGRESS', 'COMPLETED'].includes(String(values.status))) throw new TenantError('Invalid PPM status.', 400);
  for (const key of fields.filter(key => !['intervalDays', 'actualDurationMinutes'].includes(key))) if (values[key] !== undefined && typeof values[key] !== 'string') throw new TenantError('Invalid PPM details.', 400);
  return values;
}
function failure(error: unknown) { return NextResponse.json({ error: error instanceof TenantError ? error.message : 'PPM request failed.' }, { status: error instanceof TenantError ? error.statusCode : 500 }); }
export async function GET(req: Request) {
  try {
    const db = await getDatabase(req);
    const schedules = await db.collection('ppm_schedules').find({}).toArray();
    return NextResponse.json({ success: true, data: schedules.map(({ _id, ...p }) => ({ ...p, company: db.companyName, companySlug: db.tenant })) });
  } catch (error) { return failure(error); }
}
async function save(req: Request, create: boolean) {
  try {
    const db = await getDatabase(req);
    const body = (await readBody(req));
    const id = identifier(body.id);
    const values = validate(create ? body : body.updates);
    if (create && !values.machineId) throw new TenantError('Asset ID is required.', 400);
    if (values.machineId && !await db.collection('machines').findOne({ id: values.machineId })) throw new TenantError('Asset not found.', 404);
    if (create) {
      if (await db.collection('ppm_schedules').findOne({ id })) throw new TenantError('PPM ID already exists.', 409);
      await db.collection('ppm_schedules').insertOne({ ...values, id, company: db.companyName, companySlug: db.tenant });
    } else {
      const result = await db.collection('ppm_schedules').updateOne({ id }, { $set: { ...values, company: db.companyName, companySlug: db.tenant } });
      if (!result.matchedCount) throw new TenantError('PPM schedule not found.', 404);
    }
    return NextResponse.json({ success: true });
  } catch (error) { return failure(error); }
}
export async function POST(req: Request) { return save(req, true); }
export async function PATCH(req: Request) { return save(req, false); }
