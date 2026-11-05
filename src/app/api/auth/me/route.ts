import { NextResponse } from 'next/server';
import { extractSessionToken, verifySessionToken, sanitizeUserProfile } from '@/lib/auth';
import { ObjectId } from 'mongodb';
import { getDatabase, TenantError } from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const token = extractSessionToken(req);
    if (!token) {
      return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
    }

    const session = verifySessionToken(token);
    if (!session || !session.companySlug) {
      return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
    }

    const db = await getDatabase(req);
    const company = db.company;
    const user = await db.collection('users').findOne(ObjectId.isValid(session.uid)
      ? { $or: [{ uid: session.uid }, { _id: new ObjectId(session.uid) }] }
      : { uid: session.uid });
    if (!user) return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
    const profile = sanitizeUserProfile(user, company.slug, company.name);

    return NextResponse.json({
      authenticated: true,
      user: profile,
      company: {
        slug: company.slug,
        name: company.name,
      },
    });
  } catch (err: unknown) {
    if (err instanceof TenantError) return NextResponse.json({ authenticated: false, user: null }, { status: err.statusCode });
    return NextResponse.json(
      { authenticated: false, error: (err as any)?.message || 'Session validation error' },
      { status: 500 }
    );
  }
}
