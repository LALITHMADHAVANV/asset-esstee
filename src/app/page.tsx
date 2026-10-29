import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { SESSION_COOKIE_NAME, ACTIVE_COMPANY_COOKIE, verifySessionToken } from '@/lib/auth';

export default async function RootPage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (sessionToken) {
    const session = verifySessionToken(sessionToken);
    if (session && session.companySlug) {
      redirect(`/${session.companySlug}/dashboard`);
    }
  }

  // Redirect unauthenticated root visitors to pre-login page
  redirect('/login');
}
