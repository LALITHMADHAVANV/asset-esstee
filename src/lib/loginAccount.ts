import type { Document, Filter } from 'mongodb';
import type { CompanyRecord } from './registry';

/** Resolve exact account identifiers only; never guess a company from an email. */
export async function findLoginAccount(
  identifier: string,
  companies: CompanyRecord[],
  lookup: (company: CompanyRecord, query: Filter<Document>) => Promise<Document[]>,
): Promise<{ company: CompanyRecord; user: Document } | null> {
  const escaped = identifier.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const exact = new RegExp(`^${escaped}$`, 'i');
  const fields = identifier.includes('@') ? ['email'] : ['username', 'employeeId', 'uid'];
  const query = { $or: fields.map(field => ({ [field]: { $regex: exact } })) };
  let result: { company: CompanyRecord; user: Document } | null = null;
  for (const company of companies) {
    if (!company.active) continue;
    const users = await lookup(company, query);
    // Ambiguous identifiers require a unique work email, never a first-match login.
    if (users.length > 1 || (result && users.length)) return null;
    if (users.length === 1) result = { company, user: users[0] };
  }
  return result;
}
