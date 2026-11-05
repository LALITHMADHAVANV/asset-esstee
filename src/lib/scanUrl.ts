import { canonicalCompanySlug } from './companyIdentity';

export function assetScanUrl(origin: string, id: string, company?: string): string {
  const slug = canonicalCompanySlug(company || (typeof window !== 'undefined' ? localStorage.getItem('cmms_active_company') : ''));
  if (!slug) throw new Error('Sign in before generating company asset QR codes.');
  return `${origin}/${slug}/scan/${encodeURIComponent(id)}`;
}
