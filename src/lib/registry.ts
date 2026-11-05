import { canonicalCompanySlug } from './companyIdentity';
import { MongoClient, Collection, Db } from 'mongodb';

export interface CompanyRecord {
  _id?: any;
  slug: string;
  name: string;
  active: boolean;
  databaseName: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

const rawRegistryDb = (process.env.REGISTRY_DB_NAME || 'compliance_master').trim();
const REGISTRY_DB = rawRegistryDb.includes(' ') || !rawRegistryDb ? 'compliance_master' : rawRegistryDb;
const COMPANIES_COLLECTION = 'companies';

// Default company registry seed
const INITIAL_COMPANIES: Array<Omit<CompanyRecord, '_id' | 'createdAt' | 'updatedAt'>> = [
  {
    slug: 'esstee',
    name: 'Esstee',
    active: true,
    databaseName: 'compliance_esstee',
    description: 'Esstee Plant Maintenance Operations',
  },
];

// Short in-memory cache to avoid repeated registry roundtrips on high-frequency requests
let memoryCache: { data: Map<string, CompanyRecord>; expiresAt: number } | null = null;
const CACHE_TTL_MS = 60 * 1000; // 60 seconds

function normalizeSlug(raw?: string | null): string {
  return canonicalCompanySlug(raw);
}

/**
 * Returns the collection for central company registration
 */
export function getCompaniesCollection(client: MongoClient): Collection<CompanyRecord> {
  return client.db(REGISTRY_DB).collection<CompanyRecord>(COMPANIES_COLLECTION);
}

/**
 * Ensures the registry database and indexes exist.
 */
export async function ensureRegistryInitialized(client: MongoClient): Promise<void> {
  try {
    const col = getCompaniesCollection(client);

    // Ensure unique index on slug
    await col.createIndex({ slug: 1 }, { unique: true }).catch(() => { });

    // Seed initial companies if any defined
    const now = new Date().toISOString();
    for (const comp of INITIAL_COMPANIES) {
      await col.updateOne(
        { slug: comp.slug },
        {
          $setOnInsert: {
            ...comp,
            createdAt: now,
          },
          $set: {
            updatedAt: now,
          },
        },
        { upsert: true }
      );
    }
  } catch (err) {
    console.warn('ensureRegistryInitialized warning:', (err as any)?.message || err);
  }
}

/**
 * Fetches all registered companies from MongoDB (with TTL cache)
 */
export async function getAllCompanies(client: MongoClient): Promise<CompanyRecord[]> {
  const now = Date.now();
  if (memoryCache && memoryCache.expiresAt > now) {
    return Array.from(memoryCache.data.values());
  }

  await ensureRegistryInitialized(client);
  const col = getCompaniesCollection(client);
  const records = await col.find({}).toArray();

  const cacheMap = new Map<string, CompanyRecord>();
  for (const c of records) {
    cacheMap.set(c.slug.toLowerCase(), c);
  }
  memoryCache = { data: cacheMap, expiresAt: now + CACHE_TTL_MS };

  return Array.from(cacheMap.values());
}

/**
 * Fetches an active company record by its slug.
 * Returns null if not found or if the company is marked inactive.
 */
export async function getCompanyBySlug(
  client: MongoClient,
  rawSlug?: string | null
): Promise<CompanyRecord | null> {
  const slug = normalizeSlug(rawSlug);
  if (!slug) return null;

  const all = await getAllCompanies(client);
  const found = all.find((c) => c.slug.toLowerCase() === slug);
  return found || null;
}

/**
 * Validates that a company slug is registered and active.
 */
export async function validateActiveCompany(
  client: MongoClient,
  rawSlug?: string | null
): Promise<{ valid: boolean; company: CompanyRecord | null; error?: string }> {
  const slug = normalizeSlug(rawSlug);
  if (!slug) {
    return { valid: false, company: null, error: 'Company identifier is required' };
  }

  const company = await getCompanyBySlug(client, slug);
  if (!company) {
    return { valid: false, company: null, error: `Workspace "${slug}" not found` };
  }

  if (!company.active) {
    return { valid: false, company: null, error: `Workspace "${company.name}" is inactive` };
  }

  return { valid: true, company };
}

/**
 * Helper to compute the company's dedicated database name:
 */
export function getDatabaseNameForSlug(slug: string): string {
  const clean = normalizeSlug(slug);
  return `compliance_${clean}`;
}

/**
 * Invalidate in-memory cache when companies are added/modified
 */
export function invalidateRegistryCache(): void {
  memoryCache = null;
}
