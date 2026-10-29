import { canonicalCompanySlug } from './companyIdentity';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserProfile, UserRole } from '@/types/cmms';

function sessionSecret(): string {
  const secret = process.env.JWT_SECRET || process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('Configure a session secret of at least 32 characters.');
  return secret;
}
const TOKEN_EXPIRY = '30d';

export const SESSION_COOKIE_NAME = 'cmms_session_token';
export const ACTIVE_COMPANY_COOKIE = 'cmms_active_company';

export interface SessionPayload {
  uid: string;
  email: string;
  role: UserRole;
  name: string;
  companySlug: string;
  companyName: string;
  iat?: number;
  exp?: number;
}

/**
 * Hash plaintext password using bcrypt
 */
export async function hashPassword(plainText: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plainText, salt);
}

/**
 * Verify a plaintext password against a stored bcrypt hash or legacy string
 */
export async function verifyPassword(plainText: string, storedHashOrPlain: string): Promise<boolean> {
  if (!plainText || !storedHashOrPlain) return false;

  // If already a bcrypt hash (starts with $2a$, $2b$, or $2y$)
  if (/^\$2[aby]\$\d{2}\$/.test(storedHashOrPlain)) {
    return bcrypt.compare(plainText, storedHashOrPlain);
  }

  // Legacy plaintext fallback
  return plainText === storedHashOrPlain;
}

/**
 * Signs a cryptographic session token
 */
export function createSessionToken(payload: Omit<SessionPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, sessionSecret(), { expiresIn: TOKEN_EXPIRY });
}

/**
 * Verifies and decodes a cryptographic session token
 */
export function verifySessionToken(token?: string | null): SessionPayload | null {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, sessionSecret()) as SessionPayload;
    const companySlug = canonicalCompanySlug(decoded.companySlug);
    return { ...decoded, companySlug, companyName: decoded.companyName };
  } catch {
    return null;
  }
}

/**
 * Extracts session token from Request cookie or Authorization header
 */
export function extractSessionToken(req: Request): string | null {
  // 1. Authorization header: Bearer <token>
  const authHeader = req.headers.get('authorization') || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }

  // 2. Cookie header: cmms_session_token=<token>
  const cookieHeader = req.headers.get('cookie') || '';
  const match = cookieHeader.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
  if (match && match[1]) {
    return decodeURIComponent(match[1].trim());
  }

  return null;
}

/**
 * Sanitize a user object from MongoDB so password or hashes are NEVER returned to client
 */
export function sanitizeUserProfile(dbUser: any, companySlug: string, companyName: string): UserProfile {
  const rawRole = (dbUser.role || 'MECHANIC').toString().trim().toUpperCase() as UserRole;
  
  return {
    uid: dbUser.uid || String(dbUser._id || 'USR-01'),
    name: dbUser.name || 'Factory Staff',
    email: (dbUser.email || '').toLowerCase().trim(),
    role: rawRole,
    title: dbUser.title || `${companyName} Specialist`,
    phone: dbUser.phone || '',
    department: dbUser.department || 'Maintenance Workshop',
    employeeId: dbUser.employeeId || '',
    unit: dbUser.unit || 'All Units',
    zones: Array.isArray(dbUser.zones) ? dbUser.zones : (dbUser.zone ? [dbUser.zone] : []),
    company: companyName,
    companySlug: companySlug,
    status: dbUser.status || 'ACTIVE',
  };
}
