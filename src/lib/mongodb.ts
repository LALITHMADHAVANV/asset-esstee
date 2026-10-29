import { canonicalCompanySlug } from './companyIdentity';
import { MongoClient, Db, Collection, Document, ObjectId } from 'mongodb';
import { validateActiveCompany, getCompanyBySlug, CompanyRecord, ensureRegistryInitialized } from './registry';
import { verifySessionToken, extractSessionToken, SessionPayload } from './auth';


declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

export class TenantError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public code: string = 'TENANT_ERROR'
  ) {
    super(message);
    this.name = 'TenantError';
  }
}

export class TenantNotFoundError extends TenantError {
  constructor(slug: string) {
    super(`Workspace "${slug}" not found in company registry`, 404, 'WORKSPACE_NOT_FOUND');
    this.name = 'TenantNotFoundError';
  }
}

export class TenantInactiveError extends TenantError {
  constructor(slug: string) {
    super(`Workspace "${slug}" is inactive or suspended`, 403, 'WORKSPACE_INACTIVE');
    this.name = 'TenantInactiveError';
  }
}

export class CrossTenantAccessError extends TenantError {
  constructor(authenticatedSlug: string, requestedSlug: string) {
    super(
      `Access denied: Authenticated workspace "${authenticatedSlug}" cannot access data belonging to "${requestedSlug}"`,
      403,
      'CROSS_TENANT_ACCESS_FORBIDDEN'
    );
    this.name = 'CrossTenantAccessError';
  }
}

function isValidMongoUri(uri?: string | null): boolean {
  if (!uri) return false;
  const trimmed = uri.trim();
  if (
    trimmed.includes('...') ||
    trimmed.includes('<username>') ||
    trimmed.includes('<password>') ||
    trimmed.includes('<') ||
    trimmed.includes('>') ||
    trimmed.includes('your_')
  ) {
    return false;
  }
  if (!trimmed.startsWith('mongodb://') && !trimmed.startsWith('mongodb+srv://')) {
    return false;
  }
  if (trimmed.startsWith('mongodb+srv://') && !trimmed.includes('@')) {
    return false;
  }
  return true;
}

async function connectClient(): Promise<MongoClient> {
  const uri = (process.env.MONGODB_URI || (process.env.NODE_ENV !== 'production' ? 'mongodb://localhost:27017/' : '')).trim();
  if (!isValidMongoUri(uri)) throw new Error('MONGODB_URI must be configured.');
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 9000,
    connectTimeoutMS: 9000,
    maxPoolSize: 10,
    minPoolSize: 0,
    maxIdleTimeMS: 60000,
  });
  try {
    await client.connect();
    await ensureRegistryInitialized(client);
    return client;
  } catch (error) {
    await client.close().catch(() => {});
    throw error;
  }
}

/**
 * Returns the singleton MongoClient instance
 */
export async function getMongoClient(): Promise<MongoClient> {
  if (!global._mongoClientPromise) global._mongoClientPromise = connectClient();
  try {
    return await global._mongoClientPromise;
  } catch (error) {
    global._mongoClientPromise = undefined;
    throw error;
  }
}

/**
 * Normalizes input slug to standard clean format
 */
export function normalizeCompanySlug(raw?: string | null): string {
  return canonicalCompanySlug(raw);
}

/**
 * Validates company and returns its dedicated database.
 * Reuses the MongoDB connection efficiently.
 */
export async function getCompanyDatabase(companySlug: string): Promise<{ db: Db; company: CompanyRecord }> {
  const client = await getMongoClient();
  const cleanSlug = normalizeCompanySlug(companySlug);

  if (!cleanSlug) {
    throw new TenantError('Company slug is required', 400);
  }

  const { valid, company, error } = await validateActiveCompany(client, cleanSlug);
  if (!valid || !company) {
    if (error && error.includes('inactive')) {
      throw new TenantInactiveError(cleanSlug);
    }
    throw new TenantNotFoundError(cleanSlug);
  }

  // Reuses the MongoClient connection to access the tenant's isolated database
  const db = client.db(company.databaseName);
  return { db, company };
}

/**
 * Helper to get clean collection name
 */
export function cleanColName(name: string): string {
  return name.includes('.') ? name.split('.').pop()! : name;
}

/**
 * TenantDb encapsulates a dedicated company database instance
 */
export class TenantDb {
  constructor(
    public readonly _db: Db,
    public readonly company: CompanyRecord,
    public readonly sessionUser?: SessionPayload | null
  ) { }

  get databaseName(): string {
    return this.company.databaseName;
  }

  get rawDb(): Db {
    return this._db;
  }

  get tenant(): string {
    return this.company.slug;
  }

  get companyName(): string {
    return this.company.name;
  }

  collection<T extends Document = Document>(name: string): Collection<T> {
    const clean = cleanColName(name);
    const rawCol = this._db.collection<T>(clean);
    const companyName = this.company.name;
    const companySlug = this.company.slug;

    // Attach company metadata on new documents automatically
    return new Proxy(rawCol, {
      get(target, prop, receiver) {
        if (prop === 'insertOne') {
          return (doc: any, options?: any) => {
            if (doc && typeof doc === 'object') {
              if (!doc.company) doc.company = companyName;
              if (!doc.companySlug) doc.companySlug = companySlug;
            }
            return target.insertOne(doc, options);
          };
        }
        if (prop === 'insertMany') {
          return (docs: any[], options?: any) => {
            if (Array.isArray(docs)) {
              docs.forEach((d) => {
                if (d && typeof d === 'object') {
                  if (!d.company) d.company = companyName;
                  if (!d.companySlug) d.companySlug = companySlug;
                }
              });
            }
            return target.insertMany(docs, options);
          };
        }
        if (prop === 'updateOne') {
          return (filter: any, update: any, options?: any) => {
            if (options?.upsert) {
              if (update && update.$set) {
                if (!update.$set.company) update.$set.company = companyName;
                if (!update.$set.companySlug) update.$set.companySlug = companySlug;
              } else if (update && !update.$set) {
                update.$setOnInsert = {
                  ...(update.$setOnInsert || {}),
                  company: companyName,
                  companySlug: companySlug,
                };
              }
            }
            return target.updateOne(filter, update, options);
          };
        }
        const val = Reflect.get(target, prop, receiver);
        return typeof val === 'function' ? val.bind(target) : val;
      },
    });
  }

  rawCollection<T extends Document = Document>(name: string): Collection<T> {
    return this._db.collection<T>(cleanColName(name));
  }
}

/**
 * Authoritatively resolves tenant company and dedicated database from an API request.
 * Enforces strict multi-tenant isolation:
 * - Checks cryptographic session token first.
 * - Compares with any client-supplied company slug. Rejects cross-tenant attempts with 403 Forbidden.
 * - If unauthenticated (e.g. login), validates slug against central registry.
 */
export async function resolveTenantFromRequest(req: Request): Promise<{
  db: Db;
  company: CompanyRecord;
  sessionUser: SessionPayload | null;
}> {

  // 1. Check for cryptographically signed session token
  const token = extractSessionToken(req);
  const sessionUser = token ? verifySessionToken(token) : null;
  if (!sessionUser?.uid || !sessionUser.companySlug) {
    throw new TenantError('Please sign in to continue.', 401, 'AUTH_REQUIRED');
  }

  // 2. Extract any client-supplied company slug from header, cookie, or URL query
  let clientSuppliedSlug = '';

  // Headers
  const headerSlug = req.headers.get('x-company-slug') || req.headers.get('x-company') || req.headers.get('x-tenant-id');
  if (headerSlug) clientSuppliedSlug = normalizeCompanySlug(headerSlug);

  // Cookie
  if (!clientSuppliedSlug) {
    const cookieHeader = req.headers.get('cookie') || '';
    const cookieMatch = cookieHeader.match(/cmms_active_company=([^;]+)/i) || cookieHeader.match(/cmms_tenant=([^;]+)/i);
    if (cookieMatch && cookieMatch[1]) {
      clientSuppliedSlug = normalizeCompanySlug(decodeURIComponent(cookieMatch[1]));
    }
  }

  // URL query
  if (!clientSuppliedSlug) {
    try {
      const url = new URL(req.url);
      const q = url.searchParams.get('company') || url.searchParams.get('tenant') || url.searchParams.get('companySlug');
      if (q) clientSuppliedSlug = normalizeCompanySlug(q);
    } catch { }
  }

  // 3. If user is authenticated, their session token is authoritative
  if (sessionUser && sessionUser.companySlug) {
    const authSlug = normalizeCompanySlug(sessionUser.companySlug);

    // Cross-tenant tampering defense:
    // If the frontend explicitly supplied a different company slug than the session token, REJECT!
    if (clientSuppliedSlug && clientSuppliedSlug !== authSlug) {
      throw new CrossTenantAccessError(authSlug, clientSuppliedSlug);
    }

    const { db, company } = await getCompanyDatabase(authSlug);
    const account = await db.collection('users').findOne(ObjectId.isValid(sessionUser.uid)
      ? { $or: [{ uid: sessionUser.uid }, { _id: new ObjectId(sessionUser.uid) }] }
      : { uid: sessionUser.uid });
    if (!account || String(account.status || 'ACTIVE').toUpperCase() === 'INACTIVE') {
      throw new TenantError('Your session is no longer valid.', 401, 'AUTH_REQUIRED');
    }
    sessionUser.role = account.role;
    sessionUser.email = account.email;
    const path = new URL(req.url).pathname;
    if (req.method !== 'GET' && /\/api\/users$/.test(path) && !['ADMIN', 'ASSET_MANAGER'].includes(String(account.role).toUpperCase())) {
      throw new TenantError('Administrator access required.', 403, 'FORBIDDEN');
    }
    return { db, company, sessionUser };
  }

  throw new TenantError('Please sign in to continue.', 401, 'AUTH_REQUIRED');
}

/**
 * Universal getDatabase helper compatible with legacy routes and modern requests.
 * Automatically selects the appropriate dedicated database.
 */
export async function getDatabase(target?: string | Request): Promise<TenantDb> {
  if (target && typeof target === 'object' && 'headers' in target) {
    const { db, company, sessionUser } = await resolveTenantFromRequest(target as Request);
    return new TenantDb(db, company, sessionUser);
  }

  let slug = '';
  if (typeof target === 'string' && target.trim()) {
    slug = normalizeCompanySlug(target.trim());
  }

  if (!slug) {
    slug = 'esstee';
  }

  const { db, company } = await getCompanyDatabase(slug);
  return new TenantDb(db, company, null);
}

// Keep legacy alias for backward compatibility
export const extractTenant = (target?: string | Request | null): string => {
  if (!target) return 'esstee';
  if (typeof target === 'object' && 'headers' in target) {
    const h = (target as Request).headers.get('x-company-slug') || (target as Request).headers.get('x-tenant-id');
    if (h) return normalizeCompanySlug(h);
    return 'esstee';
  }
  const s = String(target).toLowerCase();
  return normalizeCompanySlug(s) || 'esstee';
};
export const extractTenantDb = extractTenant;
export const colName = (c: string) => cleanColName(c);
