import { redirect } from 'next/navigation';

// Keep previously shared company links working through the single sign-in portal.
export default function CompanyLoginPage() {
  redirect('/login');
}
