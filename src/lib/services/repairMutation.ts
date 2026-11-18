import type { Document } from 'mongodb';
import { getMongoClient, TenantDb, TenantError } from '@/lib/mongodb';
import { identifier, nonnegative, pickFields, record } from '@/lib/apiValidation';
import { repairSpareCost } from '@/lib/repairCost';
import type { RepairPartUsage } from '@/types/cmms';

const fields = ['status', 'attendedBy', 'assignedBy', 'startedAt', 'resolvedAt', 'completedAt',
  'downtimeMinutes', 'timeSpentMinutes', 'actionTaken', 'partsUsed', 'issuesIdentified',
  'completionProofImage', 'rejectedBy', 'rejectionReason', 'faultDetails', 'faultCategory',
  'urgency', 'scheduledDate', 'shift', 'assignedTo'];
const statuses = ['PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED'];
const closed = (status: unknown) => status === 'COMPLETED' || status === 'REJECTED';

/** Ticket, stock and asset status commit together, including concurrent/retried requests. */
export async function mutateRepair(db: TenantDb, rawId: unknown, input: unknown, create = false) {
  const id = identifier(rawId, 'Repair ID');
  const raw = record(input);
  const updates = pickFields(raw, fields);
  if (updates.status !== undefined && !statuses.includes(String(updates.status))) throw new TenantError('Invalid repair status.', 400);
  for (const key of ['downtimeMinutes', 'timeSpentMinutes']) if (updates[key] !== undefined) nonnegative(updates[key], key);
  for (const key of ['startedAt', 'resolvedAt', 'completedAt']) {
    if (updates[key] !== undefined && updates[key] !== null && (typeof updates[key] !== 'string' || !Number.isFinite(Date.parse(updates[key] as string)))) throw new TenantError('Invalid repair date.', 400);
  }
  for (const key of fields.filter(key => !['partsUsed', 'downtimeMinutes', 'timeSpentMinutes'].includes(key))) {
    if (updates[key] !== undefined && updates[key] !== null && typeof updates[key] !== 'string') throw new TenantError(`Invalid ${key}.`, 400);
  }
  if (typeof updates.completionProofImage === 'string' && updates.completionProofImage.length > 4_000_000) throw new TenantError('Repair photo is too large.', 400);
  const client = await getMongoClient();
  const session = client.startSession();
  try {
    return await session.withTransaction(async () => {
      const options = { session };
      const tickets = db.rawCollection('repair_tickets');
      const machines = db.rawCollection('machines');
      const parts = db.rawCollection('spare_parts');
      const existing = await tickets.findOne({ $or: [{ id }, { ticketId: id }] }, options);
      if (!create && !existing) throw new TenantError('Repair not found.', 404);
      if (create && existing) throw new TenantError('Repair ID already exists. Refresh before creating another repair.', 409);
      if (existing && closed(existing.status)) {
        if (updates.status === existing.status) return { ticket: existing, previous: existing, changed: false };
        throw new TenantError('This repair is already closed.', 409);
      }
      if (existing?.status === 'IN_PROGRESS' && updates.status === 'IN_PROGRESS' && existing.startedAt) {
        return { ticket: existing, previous: existing, changed: false };
      }
      const machineId = identifier(existing?.machineId ?? raw.machineId, 'Asset ID');
      const machine = await machines.findOne({ id: machineId }, options);
      if (!machine) throw new TenantError('Asset not found in your company.', 404);
      const status = updates.status ?? existing?.status ?? 'PENDING';
      if (updates.urgency !== undefined && !['WARNING', 'CRITICAL'].includes(String(updates.urgency))) throw new TenantError('Invalid repair urgency.', 400);
      const supplied = updates.partsUsed ?? existing?.partsUsed ?? [];
      if (!Array.isArray(supplied) || supplied.length > 100) throw new TenantError('Invalid spare usage.', 400);
      const seen = new Set<string>();
      const usage: RepairPartUsage[] = [];
      for (const value of supplied) {
        const requested = record(value);
        const partId = identifier(requested.partId, 'Spare ID');
        if (seen.has(partId)) throw new TenantError('List each spare only once.', 400);
        seen.add(partId);
        const quantity = nonnegative(requested.quantity, 'Spare quantity');
        if (quantity <= 0) throw new TenantError('Spare quantity must be greater than zero.', 400);
        const part = await parts.findOne({ $or: [{ partId }, { id: partId }] }, options);
        if (!part) throw new TenantError('Spare not found in your company.', 404);
        const prior = existing?.partsUsed?.find((p: RepairPartUsage) => p.partId === partId);
        usage.push({ partId, sku: part.sku || partId, name: part.name || partId, quantity,
          unitCost: nonnegative(prior?.unitCost ?? part.unitCost ?? 0, 'Spare unit cost'),
          usedByName: prior?.usedByName || db.sessionUser!.name, usedById: prior?.usedById || db.sessionUser!.uid,
          usedAt: prior?.usedAt || new Date().toISOString() });
      }
      const now = new Date().toISOString();
      const saved: Document = { ...(existing || {}), ...updates, id, machineId,
        machineType: existing?.machineType || raw.machineType || machine.typeName || machine.type || '',
        line: existing?.line || raw.line || machine.currentLine || '', unit: machine.unit || existing?.unit || '',
        reportedAt: existing?.reportedAt || now, reportedBy: existing?.reportedBy || db.sessionUser!.name,
        status, partsUsed: usage, company: db.companyName, companySlug: db.tenant, updatedAt: now };
      saved.downtimeMinutes = nonnegative(saved.downtimeMinutes ?? 0, 'Downtime');
      // Parts selected at start are recorded, but stock is issued only at completion.
      if (status === 'COMPLETED') {
        for (const used of usage) {
          const part = await parts.findOne({ $or: [{ partId: used.partId }, { id: used.partId }] }, options);
          const stock = nonnegative(part?.stock ?? 0, 'Stock');
          if (stock < used.quantity) throw new TenantError(`Insufficient stock for ${used.name}.`, 409);
          const result = await parts.updateOne({ _id: part!._id, stock: { $gte: used.quantity } },
            { $inc: { stock: -used.quantity }, $set: { currentStock: stock - used.quantity } }, options);
          if (!result.matchedCount) throw new TenantError('Stock changed. Refresh and try again.', 409);
        }
        saved.partsCost = repairSpareCost({ partsUsed: usage });
        saved.repairCost = saved.partsCost;
        saved.completedAt = updates.completedAt || now;
        saved.resolvedAt = saved.completedAt;
      } else {
        saved.partsCost = repairSpareCost({ partsUsed: usage });
        saved.repairCost = saved.partsCost;
      }
      delete saved.laborCost;
      if (create) {
        delete saved._id;
        await tickets.insertOne(saved, options);
      } else {
        const { _id, ...values } = saved;
        await tickets.updateOne({ _id: existing!._id }, { $set: values, $unset: { laborCost: '' } }, options);
      }
      const open = await tickets.findOne({ machineId, status: { $nin: ['COMPLETED', 'REJECTED'] } }, options);
      const nextStatus = open ? 'BREAKDOWN' : ['BREAKDOWN', 'UNDER_MAINTENANCE'].includes(machine.status) ? 'ACTIVE' : machine.status;
      // Every transition writes the asset, serializing concurrent tickets for the same machine.
      await machines.updateOne({ _id: machine._id }, {
        $set: { status: nextStatus, updatedAt: now },
        $inc: { repairRevision: 1, ...(status === 'COMPLETED' ? { totalDowntimeMinutes: Number(saved.downtimeMinutes || 0) } : {}) },
      }, options);
      return { ticket: saved, previous: existing, changed: true };
    });
  } catch (error) {
    if ((error as { code?: number }).code === 20) throw new TenantError('Repairs require MongoDB Atlas or a replica set to save stock safely.', 503);
    throw error;
  } finally {
    await session.endSession();
  }
}
