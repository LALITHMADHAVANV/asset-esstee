const admins = ['ADMIN', 'ASSET_MANAGER'];
const technicians = [...admins, 'MECHANIC', 'ELECTRICIAN', 'SENIOR_MECHANIC', 'SENIOR_ELECTRICIAN'];
const supervisors = [...admins, 'SENIOR_MECHANIC', 'SENIOR_ELECTRICIAN'];

export function apiRoleAllowed(role: string, path: string, method: string): boolean {
  const actual = String(role).trim().toUpperCase();
  if (method === 'GET' || method === 'HEAD') return true;
  if (path === '/api/auth/set-password') return true; // Handler checks account ownership.
  if (method === 'DELETE' || path === '/api/users' || path === '/api/departments') return admins.includes(actual);
  if (path === '/api/telegram') return technicians.includes(actual) || [...admins, 'STORE_PERSON', 'CEO'].includes(actual);
  if (path === '/api/parts') return [...admins, 'STORE_PERSON'].includes(actual);
  if (path === '/api/imports') return [...admins, 'STORE_PERSON'].includes(actual);
  if (path === '/api/requisitions') return method === 'POST' || [...supervisors, 'STORE_PERSON', 'CEO'].includes(actual);
  if (path === '/api/machines') return (method === 'POST' ? supervisors : technicians).includes(actual);
  if (['/api/repairs', '/api/ppm', '/api/asset-logs'].includes(path)) return technicians.includes(actual);
  return admins.includes(actual);
}
