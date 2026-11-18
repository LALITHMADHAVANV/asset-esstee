import ExcelJS from 'exceljs';
import { Readable } from 'node:stream';
import { TenantError } from './mongodb';

export type ImportKind = 'assets' | 'spares';
export type ImportRow = { row: number; values: Record<string, string> };
export const importColumns = {
  assets: ['id', 'name', 'category', 'brand', 'model', 'serialNo', 'type', 'purchaseDate', 'cost', 'unit', 'zone', 'currentLine', 'stationNo', 'status'],
  spares: ['partId', 'sku', 'name', 'quantity', 'unitCost', 'unit', 'category', 'machineType', 'minStock', 'shelfLocation', 'vendor'],
} as const;
const samples = {
  assets: ['ASSET-EXAMPLE-001', 'Single needle sewing machine', 'MACHINE', 'Juki', 'DDL-8700', 'SERIAL-EXAMPLE-001', 'SNLS', '2026-11-18', '45000', 'UNIT - 1', 'Zone 1', 'Line 01', 'Station 01', 'ACTIVE'],
  spares: ['SP-EXAMPLE-001', 'HOOK-EXAMPLE-001', 'Rotary hook', '5', '250', 'pcs', 'Hooks & Loopers', 'SNLS', '2', 'Rack A1', ''],
};
const aliases: Record<string, string> = {
  assetid: 'id', machineid: 'id', assetname: 'name', make: 'brand', serialnumber: 'serialNo', serial: 'serialNo',
  assettype: 'type', installationdate: 'purchaseDate', purchasedate: 'purchaseDate', acquisitioncost: 'cost',
  line: 'currentLine', station: 'stationNo', partid: 'partId', spareid: 'partId', partname: 'name', sparename: 'name',
  inwardquantity: 'quantity', receivedquantity: 'quantity', qty: 'quantity', unitprice: 'unitCost', price: 'unitCost',
  minimumstock: 'minStock', location: 'shelfLocation', supplier: 'vendor',
};
const key = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
export function importKind(value: unknown): ImportKind {
  if (value !== 'assets' && value !== 'spares') throw new TenantError('Choose asset entry or spare inward.', 400);
  return value;
}
function cellText(value: ExcelJS.CellValue, row: number): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object') {
    if ('formula' in value || 'sharedFormula' in value) throw new TenantError(`Row ${row}: replace formulas with their values before importing.`, 400);
    if ('richText' in value) return value.richText.map(part => part.text).join('').trim();
    if ('text' in value) return String(value.text).trim();
    throw new TenantError(`Row ${row}: unsupported cell value.`, 400);
  }
  return String(value).trim();
}
export async function readImportWorkbook(file: File, kind: ImportKind): Promise<ImportRow[]> {
  if (!file.size || file.size > 5 * 1024 * 1024) throw new TenantError('Choose a non-empty file up to 5 MB.', 400);
  const workbook = new ExcelJS.Workbook();
  const extension = file.name.split('.').pop()?.toLowerCase();
  try {
    if (extension === 'xlsx') await workbook.xlsx.load(await file.arrayBuffer());
    else if (extension === 'csv') await workbook.csv.read(Readable.from(Buffer.from(await file.arrayBuffer())), { map: (value: string) => value });
    else throw new TenantError('Supported files: Excel (.xlsx) and CSV (.csv).', 400);
  } catch (error) {
    if (error instanceof TenantError) throw error;
    throw new TenantError('The file could not be read. Use the downloaded Excel or CSV template.', 400);
  }
  const sheet = workbook.worksheets[0];
  if (!sheet || sheet.actualRowCount < 2) throw new TenantError('Add a header row and at least one data row.', 400);
  if (sheet.columnCount > 40 || sheet.rowCount > 501) throw new TenantError('Import at most 500 rows and 40 columns per file.', 400);
  const allowed = importColumns[kind] as readonly string[];
  const headers: Array<string | null> = [];
  const seen = new Set<string>();
  for (let column = 1; column <= sheet.columnCount; column++) {
    const raw = cellText(sheet.getRow(1).getCell(column).value, 1).replace(/^\uFEFF/, '');
    if (!raw) { headers.push(null); continue; }
    const normalized = allowed.find(name => key(name) === key(raw)) || aliases[key(raw)];
    if (!normalized || !allowed.includes(normalized)) throw new TenantError(`Unknown column "${raw}". Use the template headers.`, 400);
    if (seen.has(normalized)) throw new TenantError(`Duplicate column "${raw}".`, 400);
    seen.add(normalized);
    headers.push(normalized);
  }
  const required = kind === 'assets' ? ['id', 'brand', 'serialNo', 'type', 'purchaseDate', 'unit'] : ['partId', 'quantity'];
  for (const name of required) if (!seen.has(name)) throw new TenantError(`Required column missing: ${name}.`, 400);
  const rows: ImportRow[] = [];
  for (let row = 2; row <= sheet.rowCount; row++) {
    const values: Record<string, string> = {};
    headers.forEach((header, index) => { if (header) values[header] = cellText(sheet.getRow(row).getCell(index + 1).value, row); });
    if (Object.values(values).some(Boolean)) rows.push({ row, values });
  }
  if (!rows.length) throw new TenantError('No data rows found.', 400);
  return rows;
}
export async function importTemplate(kind: ImportKind, format: string) {
  if (format === 'csv') return { content: '\uFEFF' + [importColumns[kind], samples[kind]].map(row => row.map(value => '"' + value.replaceAll('"', '""') + '"').join(',')).join('\r\n'), type: 'text/csv; charset=utf-8', extension: 'csv' };
  if (format !== 'xlsx') throw new TenantError('Choose an Excel or CSV template.', 400);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(kind === 'assets' ? 'Asset Entry' : 'Spare Inward');
  sheet.addRow([...importColumns[kind]]);
  sheet.addRow(samples[kind]);
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.columns.forEach(column => { column.width = 22; });
  sheet.getRow(1).eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  });
  return { content: new Uint8Array(await workbook.xlsx.writeBuffer()), type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', extension: 'xlsx' };
}
