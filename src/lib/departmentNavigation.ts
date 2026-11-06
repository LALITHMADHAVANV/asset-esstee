import { canAccessRoute, normalizeRole } from './constants/roles';

export const DEPARTMENT_NAVIGATION = [
  { href: '/dashboard', label: 'Dashboard', group: 'Overview' },
  { href: '/dashboard/calendar', label: 'Team Overview', group: 'Overview' },
  { href: '/dashboard/pending-actions', label: 'Pending Actions', group: 'Overview' },
  { href: '/dashboard/mechanic-roster', label: 'Process In-Charges', group: 'Overview' },
  { href: '/dashboard/ppm-scheduler', label: 'PPM Scheduler', group: 'Work & equipment' },
  { href: '/dashboard/active-tna', label: 'Active TNAs', group: 'Work & equipment' },
  { href: '/dashboard/history', label: 'Completed TNAs / History', group: 'Work & equipment' },
  { href: '/dashboard/asset-types', label: 'Asset', group: 'Work & equipment' },
  { href: '/dashboard/machines', label: 'Asset Registration', group: 'Work & equipment' },
  { href: '/dashboard/floor-tracker', label: 'Factory Floor', group: 'Work & equipment' },
  { href: '/dashboard/assign-task', label: 'Assign a Task', group: 'Work & equipment' },
  { href: '/dashboard/store-inbox', label: 'Mechanic Indents', group: 'Stores & reporting' },
  { href: '/dashboard/inventory', label: 'Stock Maintenance', group: 'Stores & reporting' },
  { href: '/dashboard/kpi', label: 'Department KPI', group: 'Stores & reporting' },
  { href: '/dashboard/messages', label: 'Notifications', group: 'Stores & reporting' },
] as const;
export type NavigationHref = typeof DEPARTMENT_NAVIGATION[number]['href'];
export interface DepartmentConfiguration {
  id: string; name: string; description: string; userCount: number; badge?: string;
  navigation?: NavigationHref[];
  previousNames?: string[];
  kpi1Name: string; kpi1Type: string; kpi1Weight: number;
  kpi2Name: string; kpi2Type: string; kpi2Weight: number;
  kpi3Name: string; kpi3Type: string; kpi3Weight: number;
}
const key = (value: unknown) => typeof value === 'string' ? value.trim().toLowerCase().replace(/[\s_-]+/g, ' ') : '';
export function departmentSelection(departments: DepartmentConfiguration[], user: { department?: string; role?: string } | null): NavigationHref[] | null {
  if (!user) return null;
  const department = departments.find(item => key(item.name) === key(user.department))
    || departments.find(item => item.previousNames?.some(name => key(name) === key(user.department)))
    || departments.find(item => key(item.name) === key(user.role) || item.previousNames?.some(name => key(name) === key(user.role)));
  return department?.navigation ?? null;
}
export function departmentMenu<T extends { href: string; label: string }>(defaults: T[], selection: NavigationHref[] | null, role: string | null | undefined, fallback: (item: typeof DEPARTMENT_NAVIGATION[number]) => T): T[] {
  if (selection === null) return defaults;
  const result = DEPARTMENT_NAVIGATION.filter(item => selection.includes(item.href) && canAccessRoute(role, item.href))
    .map(item => defaults.find(existing => existing.href.split('?')[0] === item.href) || fallback(item));
  // Administrators must retain the controls used to manage department menus.
  if (normalizeRole(role) === 'ADMIN') {
    for (const href of ['/dashboard/settings', '/dashboard/users']) {
      const item = defaults.find(existing => existing.href === href);
      if (item) result.push(item);
    }
  }
  return result;
}
export function validateDepartments(input: unknown): DepartmentConfiguration[] {
  if (!Array.isArray(input) || input.length > 100) throw new Error('Provide up to 100 departments.');
  const ids = new Set<string>(), names = new Set<string>();
  return input.map(item => {
    if (!item || typeof item.id !== 'string' || !item.id.trim() || item.id.length > 100 || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 120) throw new Error('Each department needs a valid ID and name.');
    if (ids.has(item.id) || names.has(key(item.name))) throw new Error('Department names and IDs must be unique.');
    ids.add(item.id); names.add(key(item.name));
    const result = { id: item.id, name: item.name.trim() } as DepartmentConfiguration;
    for (const field of ['description', 'badge', 'kpi1Name', 'kpi1Type', 'kpi2Name', 'kpi2Type', 'kpi3Name', 'kpi3Type'] as const) {
      if (item[field] !== undefined && (typeof item[field] !== 'string' || item[field].length > 2000)) throw new Error('Invalid department details.');
      result[field] = item[field] || '';
    }
    for (const field of ['userCount', 'kpi1Weight', 'kpi2Weight', 'kpi3Weight'] as const) {
      if (typeof item[field] !== 'number' || !Number.isFinite(item[field]) || item[field] < 0) throw new Error('Department counts and weights must be valid numbers.');
      result[field] = item[field];
    }
    if (item.navigation !== undefined) {
      if (!Array.isArray(item.navigation) || item.navigation.length > DEPARTMENT_NAVIGATION.length || item.navigation.some((href: unknown) => !DEPARTMENT_NAVIGATION.some(option => option.href === href))) throw new Error('Choose valid navigation items.');
      result.navigation = [...new Set<NavigationHref>(item.navigation)];
    }
    return result;
  });
}
