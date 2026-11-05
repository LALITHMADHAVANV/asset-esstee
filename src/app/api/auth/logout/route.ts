import { NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, ACTIVE_COMPANY_COOKIE } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST() {
  const res = NextResponse.json({ success: true, message: 'Signed out successfully' });

  // Expire cookies
  res.cookies.set(SESSION_COOKIE_NAME, '', { path: '/', maxAge: 0 });
  res.cookies.set(ACTIVE_COMPANY_COOKIE, '', { path: '/', maxAge: 0 });
  res.cookies.set('cmms_tenant', '', { path: '/', maxAge: 0 });

  return res;
}
