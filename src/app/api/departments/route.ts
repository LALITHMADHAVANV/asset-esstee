import { NextResponse } from 'next/server';
import { getDatabase, TenantError } from '@/lib/mongodb';
import { normalizeRole } from '@/lib/constants/roles';
import { DepartmentConfiguration, validateDepartments } from '@/lib/departmentNavigation';

export const dynamic = 'force-dynamic';
type DepartmentDocument = { _id: string; departments: DepartmentConfiguration[]; version: number };
function failure(error: unknown) {
  if (error instanceof TenantError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
  console.error('Department settings error:', error instanceof Error ? error.name : 'Unknown');
  return NextResponse.json({ error: 'Department settings could not be saved or loaded.' }, { status: 500 });
}
export async function GET(req: Request) {
  try {
    const db = await getDatabase(req);
    if (!db.sessionUser) throw new TenantError('Please sign in.', 401);
    const saved = await db.rawCollection<DepartmentDocument>('department_settings').findOne({ _id: 'departments' });
    return NextResponse.json({ departments: saved?.departments ?? null, version: saved?.version ?? 0 });
  } catch (error) { return failure(error); }
}
export async function PUT(req: Request) {
  try {
    const db = await getDatabase(req);
    if (!db.sessionUser) throw new TenantError('Please sign in.', 401);
    if (normalizeRole(db.sessionUser.role) !== 'ADMIN') throw new TenantError('Administrator access required.', 403);
    let payload;
    try { payload = await req.json(); } catch { throw new TenantError('Invalid department settings.', 400); }
    if (!payload || typeof payload !== 'object') throw new TenantError('Invalid department settings.', 400);
    let departments;
    try { departments = validateDepartments(payload.departments); } catch (error) { throw new TenantError((error as Error).message, 400); }
    if (!Number.isSafeInteger(payload.version) || payload.version < 0) throw new TenantError('Invalid settings version.', 400);
    const collection = db.rawCollection<DepartmentDocument>('department_settings');
    const previous = await collection.findOne({ _id: 'departments' });
    departments = departments.map(department => {
      const old = previous?.departments.find(item => item.id === department.id);
      const previousNames = old ? [...new Set([...(old.previousNames || []), old.name])].filter(name => name !== department.name).slice(-100) : [];
      return previousNames.length ? { ...department, previousNames } : department;
    });
    const conflict = () => NextResponse.json({ error: 'Departments changed elsewhere. Reload settings before saving again.' }, { status: 409 });
    if (payload.version === 0) {
      try { await collection.insertOne({ _id: 'departments', departments, version: 1 }); }
      catch (error) { if ((error as { code?: number }).code === 11000) return conflict(); throw error; }
    } else {
      const saved = await collection.updateOne({ _id: 'departments', version: payload.version }, { $set: { departments }, $inc: { version: 1 } });
      if (!saved.matchedCount) return conflict();
    }
    return NextResponse.json({ departments, version: payload.version + 1 });
  } catch (error) { return failure(error); }
}
