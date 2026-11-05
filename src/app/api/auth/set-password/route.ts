import { NextResponse } from 'next/server';
import { getDatabase, TenantError } from '@/lib/mongodb';
import { hashPassword } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export async function POST(req: Request) {
  try {
    const db = await getDatabase(req);
    const session = db.sessionUser!;
    const { email, password } = await req.json();
    if (typeof email !== 'string' || typeof password !== 'string' || password.length < 8 || password.length > 1024) {
      return NextResponse.json({ error: 'Enter an account and a password of at least 8 characters.' }, { status: 400 });
    }
    const target = await db.collection('users').findOne({ email: email.trim().toLowerCase() });
    const admin = ['ADMIN', 'ASSET_MANAGER'].includes(String(session.role).toUpperCase());
    if (!target || (!admin && (target.uid || String(target._id)) !== session.uid)) {
      return NextResponse.json({ error: 'You cannot change this account.' }, { status: 403 });
    }
    await db.collection('users').updateOne({ _id: target._id }, {
      $set: { passwordHash: await hashPassword(password), updatedAt: new Date().toISOString() },
      $unset: { password: '', defaultPassword: '' },
    });
    return NextResponse.json({ success: true, message: 'Password updated.' });
  } catch (err) {
    if (err instanceof TenantError) return NextResponse.json({ error: err.message }, { status: err.statusCode });
    return NextResponse.json({ error: 'Unable to update password.' }, { status: 500 });
  }
}
