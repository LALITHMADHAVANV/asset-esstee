import { canonicalCompanySlug } from './companyIdentity';

export function tenantPreferenceKey(key: string): string {
  if (typeof window === 'undefined') return `unavailable:${key}`;
  const slug = canonicalCompanySlug(localStorage.getItem('cmms_active_company'));
  return `${slug || 'unavailable'}:${key}`;
}

export const tenantPreferences = {
  getItem(key: string) { return localStorage.getItem(tenantPreferenceKey(key)); },
  setItem(key: string, value: string) { localStorage.setItem(tenantPreferenceKey(key), value); },
  removeItem(key: string) { localStorage.removeItem(tenantPreferenceKey(key)); },
};
