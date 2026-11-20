import { extractSessionToken, verifySessionToken } from '@/lib/auth';
import { NextResponse } from 'next/server';
import { getDatabase, TenantError } from '@/lib/mongodb';
import { AssetImportError, assetImportTemplate, readAssetImport, reviewAssetImport, saveAssetImport } from '@/lib/assetImport';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
async function authorizedDatabase(req: Request) {
  if (!verifySessionToken(extractSessionToken(req))) throw new TenantError('Please sign in before importing assets.', 401);
  const db = await getDatabase(req);
  if (!db.sessionUser) throw new TenantError('Please sign in before importing assets.', 401);
  if (!['ADMIN', 'ASSET_MANAGER'].includes(String(db.sessionUser.role).toUpperCase())) throw new TenantError('Administrator access is required to import assets.', 403);
  return db;
}
function failure(error: unknown) {
  const status = error instanceof TenantError ? error.statusCode : error instanceof AssetImportError ? 400 : 500;
  if (status === 500) console.error('Asset import failed:', error);
  return NextResponse.json({ error: status === 500 ? 'Asset import is unavailable. Please try again.' : (error as Error).message }, { status });
}
export async function GET(req: Request) {
  try {
    await authorizedDatabase(req);
    const params = new URL(req.url).searchParams;
    const template = await assetImportTemplate(params.get('format') || 'xlsx', params.get('category') || 'MACHINE');
    return new NextResponse(template.content, { headers: { 'Content-Type': template.type, 'Content-Disposition': 'attachment; filename="asset-import-template.' + template.extension + '"', 'Cache-Control': 'no-store' } });
  } catch (error) { return failure(error); }
}
export async function POST(req: Request) {
  try {
    const db = await authorizedDatabase(req);
    let form;
    try { form = await req.formData(); } catch { throw new AssetImportError('Choose an Excel or CSV file.'); }
    const file = form.get('file'), action = form.get('action');
    if (!(file instanceof File)) throw new AssetImportError('Choose an Excel or CSV file.');
    if (!['preview', 'import'].includes(String(action))) throw new AssetImportError('Preview the file before importing.');
    const reviewed = await reviewAssetImport(db.rawCollection('machines'), await readAssetImport(file));
    if (action === 'preview') return NextResponse.json({ success: true, ...reviewed });
    if (reviewed.errors.length) return NextResponse.json({ error: 'Correct the invalid rows before importing. No assets were saved.', errors: reviewed.errors }, { status: 400 });
    const result = await saveAssetImport(db.rawCollection('machines'), reviewed.rows, db.companyName, db.tenant);
    return NextResponse.json({ success: true, ...result });
  } catch (error) { return failure(error); }
}
