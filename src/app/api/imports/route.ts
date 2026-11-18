import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { getDatabase, TenantError } from '@/lib/mongodb';
import { importKind, importTemplate, readImportWorkbook } from '@/lib/importWorkbook';
import { authorizeImport, commitImport, previewImport } from '@/lib/services/bulkImport';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
function failure(error: unknown) {
  if (!(error instanceof TenantError)) console.error('Import failed:', error);
  return NextResponse.json({ error: error instanceof TenantError ? error.message : 'The import could not be processed. No rows were imported.' }, { status: error instanceof TenantError ? error.statusCode : 500 });
}
export async function GET(req: Request) {
  try {
    const db = await getDatabase(req);
    const params = new URL(req.url).searchParams;
    const kind = importKind(params.get('kind'));
    authorizeImport(db, kind);
    const template = await importTemplate(kind, params.get('format') || 'xlsx');
    return new NextResponse(template.content, { headers: {
      'Content-Type': template.type,
      'Content-Disposition': `attachment; filename="${kind}-import-template.${template.extension}"`,
      'Cache-Control': 'no-store',
    } });
  } catch (error) { return failure(error); }
}
export async function POST(req: Request) {
  try {
    const db = await getDatabase(req);
    let form;
    try { form = await req.formData(); } catch { throw new TenantError('Choose an Excel or CSV file.', 400); }
    const kind = importKind(form.get('kind'));
    authorizeImport(db, kind);
    const file = form.get('file');
    if (!(file instanceof File)) throw new TenantError('Choose an Excel or CSV file.', 400);
    const rows = await readImportWorkbook(file, kind);
    const action = form.get('action');
    if (action === 'preview') return NextResponse.json({ success: true, ...await previewImport(db, kind, rows) });
    if (action !== 'commit') throw new TenantError('Preview the file before importing.', 400);
    const digest = createHash('sha256').update(Buffer.from(await file.arrayBuffer())).digest('hex');
    const result = await commitImport(db, kind, rows, form.get('requestId'), digest);
    return NextResponse.json({ success: true, ...result });
  } catch (error) { return failure(error); }
}
