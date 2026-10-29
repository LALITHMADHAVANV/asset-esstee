import { getAllCompanies } from './registry';
import { getMongoClient, TenantError } from './mongodb';

/** Reserve login identifiers centrally so concurrent creates cannot cross companies. */
export async function reserveLoginIdentifiers(companySlug: string, uid: string, identifiers: string[]) {
  const client = await getMongoClient();
  const companies = await getAllCompanies(client);
  const regDbName = (process.env.REGISTRY_DB_NAME || 'compliance_master').trim();
  const safeDbName = regDbName.includes(' ') || !regDbName ? 'compliance_master' : regDbName;
  const claims = client.db(safeDbName)
    .collection<{ _id: string; owner: string }>('login_identifiers');
  const owner = `${companySlug}:${uid}`;
  for (const raw of identifiers) {
    const key = raw.trim().toLowerCase();
    if (!key) continue;
    const exact = new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    for (const company of companies) {
      const matches = await client.db(company.databaseName).collection('users').find({
        $or: ['email', 'username', 'employeeId', 'uid'].map(field => ({ [field]: { $regex: exact } })),
      }).limit(2).toArray();
      if (matches.some(account => company.slug !== companySlug || (account.uid || String(account._id)) !== uid)) {
        throw new TenantError('This login identifier is already assigned. Use a unique work email or employee ID.', 409, 'IDENTIFIER_TAKEN');
      }
    }
    try {
      await claims.updateOne({ _id: key, owner }, { $setOnInsert: { owner } }, { upsert: true });
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw new TenantError('This login identifier is already assigned.', 409, 'IDENTIFIER_TAKEN');
      }
      throw error;
    }
  }
}
