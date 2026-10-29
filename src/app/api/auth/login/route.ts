import { NextResponse } from 'next/server';
import { getMongoClient, getCompanyDatabase, normalizeCompanySlug, TenantNotFoundError, TenantInactiveError } from '@/lib/mongodb';
import { getAllCompanies } from '@/lib/registry';
import { findLoginAccount } from '@/lib/loginAccount';
import { verifyPassword, hashPassword, createSessionToken, sanitizeUserProfile, SESSION_COOKIE_NAME, ACTIVE_COMPANY_COOKIE } from '@/lib/auth';
import { UserRole } from '@/types/cmms';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let identifier = '';
  let pass = '';
  let requestedCompany = '';

  try {
    try {
      const body = await req.json();
      identifier = body?.email || body?.identifier || '';
      pass = body?.password || '';
      requestedCompany = body?.companySlug || body?.company || '';
    } catch {
      try {
        const text = await req.text();
        const parsed = JSON.parse(text);
        identifier = parsed?.email || parsed?.identifier || '';
        pass = parsed?.password || '';
        requestedCompany = parsed?.companySlug || parsed?.company || '';
      } catch {}
    }

    // Also check headers and query params if not provided in body
    if (!requestedCompany) {
      requestedCompany = req.headers.get('x-company-slug') || req.headers.get('x-company') || '';
    }
    if (!requestedCompany) {
      try {
        const url = new URL(req.url);
        requestedCompany = url.searchParams.get('company') || url.searchParams.get('companySlug') || '';
      } catch {}
    }

    if (typeof identifier !== 'string' || typeof pass !== 'string' || typeof requestedCompany !== 'string') {
      return NextResponse.json({ error: 'Invalid sign-in request.' }, { status: 400 });
    }
    const cleanInput = identifier.trim();
    const cleanPass = pass;
    if (!cleanInput || !cleanPass || cleanInput.length > 254 || cleanPass.length > 1024) {
      return NextResponse.json({ error: 'Enter your username or email and password.' }, { status: 400 });
    }

    const client = await getMongoClient();
    const companies = (await getAllCompanies(client)).filter(c => c.active);
    const requestedSlug = requestedCompany ? normalizeCompanySlug(requestedCompany) : '';
    const candidates = requestedSlug ? companies.filter(c => c.slug === requestedSlug) : companies;
    const match = await findLoginAccount(cleanInput, candidates, async (company, query) => {
      const { db } = await getCompanyDatabase(company.slug);
      return db.collection('users').find(query).limit(2).toArray();
    });
    if (!match) {
      return NextResponse.json({ error: 'Unable to sign in. Use your unique work email or username and check your password. Contact your administrator if needed.' }, { status: 401 });
    }
    const { company, user: dbUser } = match;
    if (String(dbUser.status || 'ACTIVE').toUpperCase() === 'INACTIVE') {
      return NextResponse.json({ error: 'Unable to sign in. Contact your administrator.' }, { status: 401 });
    }
    const { db } = await getCompanyDatabase(company.slug);
    const usersCol = db.collection('users');

    // 3. Verify Password using Bcrypt
    const storedHashOrPlain = dbUser.passwordHash || dbUser.password || dbUser.defaultPassword || '';
    const isPasswordValid = await verifyPassword(cleanPass, storedHashOrPlain);

    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Unable to sign in. Check your username and password.' },
        { status: 401 }
      );
    }

    // If password was stored in plaintext, seamlessly upgrade it to a bcrypt hash
    if (!dbUser.passwordHash || !/^\$2[aby]\$\d{2}\$/.test(dbUser.passwordHash)) {
      try {
        const freshHash = await hashPassword(cleanPass);
        await usersCol.updateOne(
          { _id: dbUser._id },
          { $set: { passwordHash: freshHash, updatedAt: new Date().toISOString() }, $unset: { password: '', defaultPassword: '' } }
        );
      } catch (upgradeErr) {
        console.warn('Password hash upgrade warning:', upgradeErr);
      }
    }

    // 4. Create cryptographically signed session token
    const rawRole = (dbUser.role || 'MECHANIC').toString().trim().toUpperCase() as UserRole;
    const token = createSessionToken({
      uid: dbUser.uid || String(dbUser._id),
      email: (dbUser.email || '').toLowerCase().trim(),
      role: rawRole,
      name: dbUser.name || 'Factory Staff',
      companySlug: company.slug,
      companyName: company.name,
    });

    // 5. Sanitize user profile (no secrets returned)
    const profile = sanitizeUserProfile(dbUser, company.slug, company.name);

    // 6. Set secure cookies
    const res = NextResponse.json({
      success: true,
      user: profile,
      company: {
        slug: company.slug,
        name: company.name,
      },
    });

    const isProd = process.env.NODE_ENV === 'production';
    const cookieAge = 60 * 60 * 24 * 30; // 30 days

    // Secure HttpOnly session cookie
    res.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: cookieAge,
    });

    // Client-accessible active company cookie
    res.cookies.set(ACTIVE_COMPANY_COOKIE, company.slug, {
      httpOnly: false,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: cookieAge,
    });

    // Legacy compatibility cookie
    res.cookies.set('cmms_tenant', company.slug, {
      httpOnly: false,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      maxAge: cookieAge,
    });

    return res;
  } catch (err: unknown) {
    console.error('Login error:', err);
    if (err instanceof TenantNotFoundError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 404 });
    }
    if (err instanceof TenantInactiveError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 403 });
    }
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('MONGODB_URI') || msg.includes('ECONNREFUSED') || msg.includes('timed out') || msg.includes('server selection') || msg.includes('whitelist')) {
      return NextResponse.json(
        { error: 'Database connection failed. Please verify MONGODB_URI in Vercel Environment Variables and ensure MongoDB Atlas allows connections (0.0.0.0/0).' },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: 'Sign-in is temporarily unavailable. Please try again.' },
      { status: 500 }
    );
  }
}
