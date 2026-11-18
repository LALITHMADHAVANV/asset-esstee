import { createHash } from 'node:crypto';
import type { Document } from 'mongodb';
import { getCompanyDatabase, TenantError } from '@/lib/mongodb';
import { mongoTransaction } from '@/lib/mongoTransaction';
import { identifier, record } from '@/lib/apiValidation';
import { QR_FAULT_CATEGORIES } from '@/lib/qrTicket';

export async function qrAsset(company: unknown, assetId: unknown) {
  const slug = identifier(company, 'Company');
  const id = identifier(assetId, 'Asset ID');
  const { db, company: registered } = await getCompanyDatabase(slug);
  const machine = await db.collection('machines').findOne({ id }, { projection: { id: 1, name: 1, brand: 1, model: 1, unit: 1, zone: 1, currentLine: 1 } });
  if (!machine) throw new TenantError('This asset was not found. Check the QR sticker and try again.', 404);
  return { id: machine.id as string, name: String(machine.name || [machine.brand, machine.model].filter(Boolean).join(' ') || machine.id),
    company: registered.name, unit: String(machine.unit || ''), zone: String(machine.zone || ''), line: String(machine.currentLine || '') };
}

/** Public QR access can create pending tickets only; no staff, history or stock access. */
export async function bookQrTicket(input: unknown) {
  const body = record(input);
  const companySlug = identifier(body.company, 'Company');
  const machineId = identifier(body.machineId, 'Asset ID');
  const requestId = identifier(body.requestId, 'Booking request');
  if (!/^[a-zA-Z0-9-]{16,100}$/.test(requestId)) throw new TenantError('Invalid booking request. Refresh and try again.', 400);
  if (!QR_FAULT_CATEGORIES.includes(body.faultCategory as typeof QR_FAULT_CATEGORIES[number])) throw new TenantError('Choose a fault category.', 400);
  if (!['CRITICAL', 'WARNING'].includes(String(body.urgency))) throw new TenantError('Choose a valid priority.', 400);
  if (body.faultDetails !== undefined && (typeof body.faultDetails !== 'string' || body.faultDetails.length > 2000)) throw new TenantError('Fault notes must be under 2000 characters.', 400);
  if (body.reporterName !== undefined && (typeof body.reporterName !== 'string' || body.reporterName.length > 100)) throw new TenantError('Reporter name must be under 100 characters.', 400);
  const faultCategory = String(body.faultCategory);
  const faultDetails = String(body.faultDetails || '').trim() || 'Reported by scanning the asset QR code.';
  const reporterName = String(body.reporterName || '').trim() || 'Floor operator';
  const urgency = String(body.urgency);
  const { db, company } = await getCompanyDatabase(companySlug);
  const ticketId = 'WO-QR-' + createHash('sha256').update(company.slug + ':' + machineId + ':' + requestId).digest('hex').slice(0, 24);
  const digest = createHash('sha256').update(JSON.stringify({ machineId, faultCategory, faultDetails, reporterName, urgency })).digest('hex');
  return mongoTransaction(async session => {
    const options = { session };
    const tickets = db.collection<Document & { _id: string }>('repair_tickets');
    const existing = await tickets.findOne({ _id: ticketId }, options);
    if (existing) {
      if (existing.qrRequestDigest !== digest) throw new TenantError('This booking request was already used. Refresh to report another issue.', 409);
      return { ticketId, changed: false, companySlug: company.slug, ticket: existing };
    }
    const machine = await db.collection('machines').findOne({ id: machineId }, options);
    if (!machine) throw new TenantError('Asset not found in this company.', 404);
    if (machine.status === 'SCRAP') throw new TenantError('This asset has been retired. Please contact maintenance.', 409);
    const now = new Date();
    const recentCount = await tickets.countDocuments({ machineId, source: 'QR', reportedAt: { $gte: new Date(now.getTime() - 60_000).toISOString() } }, options);
    if (recentCount >= 3) throw new TenantError('Tickets were recently booked for this asset. Please wait a minute before reporting another issue.', 429);
    const ticket = { _id: ticketId, id: ticketId, machineId, machineType: machine.typeName || machine.type || '',
      line: machine.currentLine || '', unit: machine.unit || '', reportedAt: now.toISOString(),
      reportedBy: reporterName + ' (QR scan)', faultCategory, faultDetails, urgency,
      status: 'PENDING', attendedBy: null, resolvedAt: null, downtimeMinutes: 0,
      actionTaken: '', partsUsed: [], partsCost: 0, repairCost: 0, source: 'QR', qrRequestDigest: digest,
      company: company.name, companySlug: company.slug };
    await tickets.insertOne(ticket, options);
    await db.collection('machines').updateOne({ _id: machine._id }, {
      $set: { status: 'BREAKDOWN', updatedAt: now.toISOString() }, $inc: { repairRevision: 1 },
    }, options);
    return { ticketId, changed: true, companySlug: company.slug, ticket };
  });
}
