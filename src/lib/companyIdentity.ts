/** Canonical public identity */
export function canonicalCompanySlug(raw?: string | null): string {
  return (raw || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
}
