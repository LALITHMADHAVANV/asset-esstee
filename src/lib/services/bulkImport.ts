import type { ClientSession, Document } from 'mongodb';
import { getMongoClient, TenantDb, TenantError } from '@/lib/mongodb';
import type { ImportKind, ImportRow } from '@/lib/importWorkbook';
import { identifier } from '@/lib/apiValidation';

type PreparedRow = { row: number; action: 'create' | 'receive'; values: Document; existing?: Document };
type ImportBatch = { _id: string; kind: ImportKind; digest: string; count: number; createdAt: string; actorId: string };
export type ImportError = { row: number; message: string };
function number(value: string | undefined, label: string, fallback?: number): number {
  if (!value?.trim()) {
    if (fallback !== undefined) return fallback;
    throw new TenantError(`${label} is required.`, 400);
  }
  const parsed = Number(value.replace(/[,₹\s]/g, ''));
  if (!Number.isFinite(parsed) || parsed < 0) throw new TenantError(`${label} must be a non-negative number.`, 400);
  return parsed;
}
function date(value: string): string {
  const indian = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const iso = indian ? `${indian[3]}-${indian[2]}-${indian[1]}` : value;
  const parsed = new Date(iso + 'T00:00:00Z');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== iso) throw new TenantError('purchaseDate must be a valid YYYY-MM-DD or DD/MM/YYYY date.', 400);
  return iso;
}
export function authorizeImport(db: TenantDb, kind: ImportKind) {
  const role = String(db.sessionUser?.role).toUpperCase();
  const allowed = kind === 'assets' ? ['ADMIN', 'ASSET_MANAGER'] : ['ADMIN', 'ASSET_MANAGER', 'STORE_PERSON'];
  if (!allowed.includes(role)) throw new TenantError('You do not have permission for this import.', 403);
}
async function prepare(db: TenantDb, kind: ImportKind, rows: ImportRow[], session?: ClientSession) {
  if (!rows.length || rows.length > 500) throw new TenantError('Import between 1 and 500 rows.', 400);
  const options = session ? { session } : {};
  const prepared: PreparedRow[] = [];
  const errors: ImportError[] = [];
  const ids = new Set<string>();
  const serials = new Set<string>();
  const skus = new Set<string>();
  for (const { row, values: input } of rows) {
    try {
      for (const value of Object.values(input)) if (typeof value !== 'string' || value.length > 2000) throw new TenantError('A cell exceeds the supported text length.', 400);
      const id = identifier(kind === 'assets' ? input.id : input.partId);
      if (ids.has(id)) throw new TenantError('Duplicate ID in this file.', 400);
      ids.add(id);
      if (kind === 'assets') {
        if (await db.collection('machines').findOne({ id }, options)) throw new TenantError('Asset ID already exists. Import adds new assets only.', 409);
        const brand = identifier(input.brand, 'Brand');
        const serialNo = identifier(input.serialNo, 'Serial number');
        if (serials.has(serialNo.toLowerCase())) throw new TenantError('Duplicate serial number in this file.', 400);
        serials.add(serialNo.toLowerCase());
        if (await db.collection('machines').findOne({ $or: [{ serialNo }, { serialNumber: serialNo }] }, { ...options, collation: { locale: 'en', strength: 2 } })) throw new TenantError('Serial number already belongs to another asset.', 409);
        const category = input.category || 'MACHINE';
        if (!['MACHINE', 'FURNITURE', 'CHAIR', 'TABLE', 'UTILITY', 'VEHICLE', 'LIGHT', 'FAN'].includes(category)) throw new TenantError('Invalid asset category.', 400);
        const status = input.status || 'ACTIVE';
        if (!['ACTIVE', 'IDLE', 'BUFFER', 'SCRAP'].includes(status)) throw new TenantError('New assets must be ACTIVE, IDLE, BUFFER or SCRAP.', 400);
        const type = identifier(input.type, 'Asset type');
        prepared.push({ row, action: 'create', values: { id, name: input.name || [brand, input.model || type].join(' '),
          category, brand, model: input.model || '', serialNo, serialNumber: serialNo, type, typeName: type,
          purchaseDate: date(input.purchaseDate || ''), cost: number(input.cost, 'Asset cost', 0),
          unit: identifier(input.unit, 'Unit'), zone: input.zone || '', area: input.zone || '',
          currentLine: input.currentLine || 'Line 01', stationNo: input.stationNo || '', status, totalDowntimeMinutes: 0 } });
      } else {
        const existing = await db.collection('spare_parts').findOne({ $or: [{ partId: id }, { id }] }, options);
        if (existing && (typeof existing.stock !== 'number' || !Number.isFinite(existing.stock) || existing.stock < 0)) throw new TenantError('Existing stock is invalid. Correct the spare record before receiving stock.', 409);
        const quantity = number(input.quantity, 'Received quantity');
        if (quantity <= 0) throw new TenantError('Received quantity must be greater than zero.', 400);
        const unitCost = number(input.unitCost, 'Unit cost', existing?.unitCost);
        const sku = input.sku || existing?.sku;
        const name = input.name || existing?.name;
        identifier(sku, 'SKU for a new spare');
        identifier(name, 'Name for a new spare');
        if (skus.has(sku.toLowerCase())) throw new TenantError('Duplicate SKU in this file.', 400);
        skus.add(sku.toLowerCase());
        if (existing && input.sku && input.sku !== existing.sku) throw new TenantError('SKU does not match the existing spare ID.', 409);
        const duplicateSku = await db.collection('spare_parts').findOne({ sku, ...(existing ? { _id: { $ne: existing._id } } : {}) }, options);
        if (duplicateSku) throw new TenantError('SKU already belongs to another spare ID.', 409);
        prepared.push({ row, action: existing ? 'receive' : 'create', existing: existing || undefined, values: {
          partId: id, sku, name, quantity, unitCost, unit: input.unit || existing?.unit || 'pcs',
          category: input.category || existing?.category || 'General', machineType: input.machineType || existing?.machineType || 'GENERAL',
          minStock: number(input.minStock, 'Minimum stock', existing?.minStock || 0),
          shelfLocation: input.shelfLocation || existing?.shelfLocation || '', vendor: input.vendor || existing?.vendor || '',
        } });
      }
    } catch (error) {
      if (!(error instanceof TenantError)) throw error;
      errors.push({ row, message: error.message });
    }
  }
  return { prepared, errors };
}
export async function previewImport(db: TenantDb, kind: ImportKind, rows: ImportRow[]) {
  authorizeImport(db, kind);
  const { prepared, errors } = await prepare(db, kind, rows);
  return { total: rows.length, errors, rows: prepared.map(item => ({ row: item.row, action: item.action, ...item.values,
    ...(kind === 'spares' ? { previousStock: item.existing?.stock || 0, resultingStock: (item.existing?.stock || 0) + item.values.quantity } : {}) })) };
}
export async function commitImport(db: TenantDb, kind: ImportKind, rows: ImportRow[], rawRequestId: unknown, digest: string) {
  authorizeImport(db, kind);
  const requestId = identifier(rawRequestId, 'Import request ID');
  const batches = db.rawCollection<ImportBatch>('import_batches');
  const prior = await batches.findOne({ _id: requestId });
  if (prior) {
    if (prior.digest !== digest || prior.kind !== kind) throw new TenantError('Import request ID has already been used for another file.', 409);
    return { count: prior.count as number, repeated: true };
  }
  const collection = kind === 'assets' ? db.rawCollection('machines') : db.rawCollection('spare_parts');
  await collection.createIndex(kind === 'assets' ? { id: 1 } : { partId: 1 }, { unique: true });
  const client = await getMongoClient();
  const session = client.startSession();
  try {
    return await session.withTransaction(async () => {
      const options = { session };
      const previous = await batches.findOne({ _id: requestId }, options);
      if (previous) {
        if (previous.digest !== digest || previous.kind !== kind) throw new TenantError('This request belongs to another file.', 409);
        return { count: previous.count as number, repeated: true };
      }
      const { prepared, errors } = await prepare(db, kind, rows, session);
      if (errors.length) throw new TenantError(`Row ${errors[0].row}: ${errors[0].message} No rows were imported.`, 400);
      const now = new Date().toISOString();
      for (const item of prepared) {
        const { quantity, ...values } = item.values;
        const metadata = { company: db.companyName, companySlug: db.tenant, updatedAt: now };
        if (kind === 'assets') await collection.insertOne({ ...values, ...metadata, createdAt: now, importRequestId: requestId }, options);
        else if (item.existing) {
          await collection.updateOne({ _id: item.existing._id }, [
            { $set: { ...Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { $literal: value }])),
              ...Object.fromEntries(Object.entries(metadata).map(([key, value]) => [key, { $literal: value }])), stock: { $add: ['$stock', quantity] } } },
            { $set: { currentStock: '$stock' } },
          ], options);
        } else await collection.insertOne({ ...values, ...metadata, stock: quantity, currentStock: quantity, monthlyAllowance: 0, compat: '', compatibleTypes: [], createdAt: now }, options);
      }
      await batches.insertOne({ _id: requestId, kind, digest, count: prepared.length, createdAt: now, actorId: db.sessionUser!.uid }, options);
      return { count: prepared.length, repeated: false };
    });
  } catch (error) {
    if ((error as { code?: number }).code === 20) throw new TenantError('Imports require MongoDB Atlas or a replica set to save all rows safely.', 503);
    if ((error as { code?: number }).code === 11000) {
      const committed = await batches.findOne({ _id: requestId });
      if (committed?.digest === digest && committed.kind === kind) return { count: committed.count as number, repeated: true };
      throw new TenantError('An ID was added elsewhere. Preview the file again. No rows were imported.', 409);
    }
    throw error;
  } finally { await session.endSession(); }
}
