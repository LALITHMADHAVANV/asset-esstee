import ExcelJS from 'exceljs';
import { Readable } from 'node:stream';
import type { Collection, Document } from 'mongodb';
import type { Machine } from '@/types/cmms';

export const ASSET_IMPORT_COLUMNS = ['id', 'name', 'category', 'brand', 'model', 'serialNo', 'type', 'purchaseDate', 'cost', 'unit', 'zone', 'currentLine', 'stationNo', 'status'];
const sample = ['MC-EXAMPLE-001', 'Single needle sewing machine', 'MACHINE', 'Juki', 'DDL-8700', 'SN-EXAMPLE-001', 'SNLS', '2026-11-18', '45000', 'UNIT - 1', 'Zone 1', 'Line 01', 'Station 01', 'ACTIVE'];
export type AssetImportRow = { row: number; asset: Machine };
export type AssetImportIssue = { row: number; message: string };
export class AssetImportError extends Error {}

const headerKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');
const aliases: Record<string, string> = { assetid: 'id', machineid: 'id', assetname: 'name', make: 'brand', serialnumber: 'serialNo', serial: 'serialNo', assettype: 'type', machinetype: 'type', installationdate: 'purchaseDate', price: 'cost', line: 'currentLine', station: 'stationNo' };
function text(value: ExcelJS.CellValue, row: number): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    if ('formula' in value || 'sharedFormula' in value) throw new AssetImportError('Row ' + row + ': replace formulas with values.');
    if ('richText' in value) return value.richText.map(part => part.text).join('').trim();
    if ('text' in value) return String(value.text).trim();
    throw new AssetImportError('Row ' + row + ': unsupported cell value.');
  }
  return String(value).trim();
}
function required(value: string | undefined, label: string) {
  if (!value || value.length > 200) throw new AssetImportError(label + ' is required (maximum 200 characters).');
  return value;
}
function purchaseDate(value: string) {
  const local = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const iso = local ? local[3] + '-' + local[2] + '-' + local[1] : value;
  const parsed = new Date(iso + 'T00:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== iso) throw new AssetImportError('Use a valid purchaseDate: YYYY-MM-DD or DD/MM/YYYY.');
  return iso;
}
export async function readAssetImport(file: File) {
  if (!file.size || file.size > 5 * 1024 * 1024) throw new AssetImportError('Choose a non-empty Excel or CSV file up to 5 MB.');
  const workbook = new ExcelJS.Workbook();
  try {
    if (/\.xlsx$/i.test(file.name)) await workbook.xlsx.load(await file.arrayBuffer());
    else if (/\.csv$/i.test(file.name)) await workbook.csv.read(Readable.from(Buffer.from(await file.arrayBuffer())), { map: (value: string) => value });
    else throw new AssetImportError('Supported files: Excel (.xlsx) and CSV (.csv).');
  } catch (error) {
    if (error instanceof AssetImportError) throw error;
    throw new AssetImportError('The file could not be read. Use the downloaded template.');
  }
  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.actualRowCount < 2) throw new AssetImportError('Include a header row and at least one asset.');
  if (sheet.rowCount > 501 || sheet.columnCount > 40) throw new AssetImportError('Import at most 500 rows and 40 columns.');
  const headers: Array<string | null> = [], seenHeaders = new Set<string>();
  for (let column = 1; column <= sheet.columnCount; column++) {
    const original = text(sheet.getRow(1).getCell(column).value, 1).replace(/^\uFEFF/, '');
    if (!original) { headers.push(null); continue; }
    const key = ASSET_IMPORT_COLUMNS.find(name => headerKey(name) === headerKey(original)) || aliases[headerKey(original)];
    if (!key) throw new AssetImportError('Unknown column "' + original + '". Use the template headers.');
    if (seenHeaders.has(key)) throw new AssetImportError('Duplicate column: ' + original);
    seenHeaders.add(key); headers.push(key);
  }
  for (const key of ['id', 'brand', 'serialNo', 'type', 'purchaseDate', 'unit']) if (!seenHeaders.has(key)) throw new AssetImportError('Required column missing: ' + key);
  const rows: AssetImportRow[] = [], errors: AssetImportIssue[] = [];
  const ids = new Set<string>(), serials = new Set<string>();
  let total = 0;
  for (let row = 2; row <= sheet.rowCount; row++) {
    if (!sheet.getRow(row).hasValues) continue;
    total++;
    try {
      const values: Record<string, string> = {};
      headers.forEach((header, index) => { if (header) values[header] = text(sheet.getRow(row).getCell(index + 1).value, row); });
      if (!Object.values(values).some(Boolean)) { total--; continue; }
      if (Object.values(values).some(value => value.length > 2000)) throw new AssetImportError('A cell exceeds 2000 characters.');
      const id = required(values.id, 'Asset ID'), brand = required(values.brand, 'Brand'), serialNo = values.serialNo === '-' ? '' : (values.serialNo || '');
      if (serialNo.length > 200) throw new AssetImportError('Serial number exceeds 200 characters.');
      if (ids.has(id.toLowerCase())) throw new AssetImportError('Duplicate asset ID in this file.');
      if (serialNo && serials.has(serialNo.toLowerCase())) throw new AssetImportError('Duplicate serial number in this file.');
      ids.add(id.toLowerCase()); if (serialNo) serials.add(serialNo.toLowerCase());
      const category = (values.category || 'MACHINE').toUpperCase();
      if (!['MACHINE', 'FURNITURE', 'TABLE', 'CHAIR', 'UTILITY', 'VEHICLE', 'LIGHT', 'FAN'].includes(category)) throw new AssetImportError('Invalid asset category.');
      const status = (values.status || 'ACTIVE').toUpperCase();
      if (!['ACTIVE', 'IDLE', 'BUFFER', 'SCRAP'].includes(status)) throw new AssetImportError('New assets must be ACTIVE, IDLE, BUFFER or SCRAP.');
      const cost = values.cost ? Number(values.cost.replace(/[,?\s]/g, '')) : 0;
      if (!Number.isFinite(cost) || cost < 0) throw new AssetImportError('Cost must be a non-negative number.');
      const type = required(values.type, 'Asset type');
      rows.push({ row, asset: { id, name: values.name || [brand, values.model || type].join(' '), category, brand, model: values.model === '-' ? '' : (values.model || ''),
        serialNo, serialNumber: serialNo, type, typeName: type, purchaseDate: purchaseDate(values.purchaseDate || ''), cost,
        unit: values.unit || '', zone: values.zone || '', area: values.zone || '', currentLine: values.currentLine || 'Line 01',
        stationNo: values.stationNo || serialNo, status, totalDowntimeMinutes: 0 } as Machine });
    } catch (error) {
      if (!(error instanceof AssetImportError)) throw error;
      errors.push({ row, message: error.message });
    }
  }
  if (!total && !errors.length) throw new AssetImportError('No asset rows found.');
  return { total, rows, errors };
}
export async function reviewAssetImport(collection: Collection<Document>, parsed: Awaited<ReturnType<typeof readAssetImport>>) {
  const existing = await collection.find({ $or: [
    { id: { $in: parsed.rows.map(item => item.asset.id) } },
    { serialNo: { $in: parsed.rows.map(item => item.asset.serialNo) } },
    { serialNumber: { $in: parsed.rows.map(item => item.asset.serialNo) } },
  ] }, { projection: { id: 1, serialNo: 1, serialNumber: 1 }, collation: { locale: 'en', strength: 2 } }).toArray();
  const ids = new Set(existing.map(asset => String(asset.id).toLowerCase()));
  const serials = new Set(existing.flatMap(asset => [asset.serialNo, asset.serialNumber]).filter(Boolean).map(value => String(value).toLowerCase()));
  const errors = [...parsed.errors];
  const rows: Array<AssetImportRow & { exists: boolean }> = [];
  for (const item of parsed.rows) {
    const exists = ids.has(item.asset.id.toLowerCase());
    if (!exists && item.asset.serialNo && serials.has(String(item.asset.serialNo).toLowerCase())) errors.push({ row: item.row, message: 'This serial number already belongs to an existing asset.' });
    else rows.push({ ...item, exists });
  }
  return { ...parsed, errors, rows };
}
export async function saveAssetImport(collection: Collection<Document>, rows: AssetImportRow[], company: string, companySlug: string) {
  // Per-asset create-only upserts support standalone MongoDB and safe retries.
  try {
    await collection.createIndex({ id: 1 }, { unique: true, name: 'asset_import_id_ci', collation: { locale: 'en', strength: 2 }, partialFilterExpression: { id: { $type: 'string' } } });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) throw new AssetImportError('Existing asset IDs contain duplicates. Correct the duplicate records before importing.');
    throw error;
  }
  let imported = 0, skipped = 0;
  const errors: AssetImportIssue[] = [];
  for (let index = 0; index < rows.length; index++) {
    const item = rows[index];
    try {
      const result = await collection.updateOne({ id: item.asset.id }, { $setOnInsert: { ...item.asset, company, companySlug, createdAt: new Date().toISOString() } }, { upsert: true, collation: { locale: 'en', strength: 2 } });
      if (result.upsertedCount) imported++; else skipped++;
    } catch (error) {
      if ((error as { code?: number }).code === 11000 && await collection.findOne({ id: item.asset.id }, { collation: { locale: 'en', strength: 2 } })) skipped++;
      else {
        errors.push(...rows.slice(index).map(pending => ({ row: pending.row, message: 'Save was not confirmed. Retry the file; existing asset IDs will be skipped.' })));
        break;
      }
    }
  }
  return { imported, skipped, errors };
}
export async function assetImportTemplate(format: string) {
  if (format === 'csv') return { content: '\uFEFF' + [ASSET_IMPORT_COLUMNS, sample].map(row => row.map(value => '"' + value.replaceAll('"', '""') + '"').join(',')).join('\r\n'), type: 'text/csv; charset=utf-8', extension: 'csv' };
  if (format !== 'xlsx') throw new AssetImportError('Choose an Excel or CSV template.');
  const workbook = new ExcelJS.Workbook(), sheet = workbook.addWorksheet('Asset Registration');
  sheet.addRow(ASSET_IMPORT_COLUMNS); sheet.addRow(sample);
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.columns.forEach(column => { column.width = 22; });
  sheet.getRow(1).eachCell(cell => { cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }; cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }; });
  return { content: new Uint8Array(await workbook.xlsx.writeBuffer()), type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', extension: 'xlsx' };
}
