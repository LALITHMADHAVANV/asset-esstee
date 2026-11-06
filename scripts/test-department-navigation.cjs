const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const assert = require('node:assert/strict');
const cache = new Map();
const stores = new Map();
let uiSelection = ['/dashboard', '/dashboard/history'];
let uiReady = true, uiCollapsed = false, uiMobile = false;
class TenantError extends Error { constructor(message, statusCode) { super(message); this.statusCode = statusCode; } }
function collection(company) {
  if (!stores.has(company)) stores.set(company, null);
  return {
    async findOne() { return structuredClone(stores.get(company)); },
    async insertOne(document) { if (stores.get(company)) throw Object.assign(new Error('duplicate'), { code: 11000 }); stores.set(company, structuredClone(document)); },
    async updateOne(filter, update) {
      const doc = stores.get(company);
      if (!doc || doc.version !== filter.version) return { matchedCount: 0 };
      stores.set(company, { ...doc, ...structuredClone(update.$set), version: doc.version + update.$inc.version });
      return { matchedCount: 1 };
    },
  };
}
function load(file) {
  const full = path.resolve(file);
  if (cache.has(full)) return cache.get(full);
  const exports = {}; cache.set(full, exports);
  const code = ts.transpileModule(fs.readFileSync(full, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const requireLocal = name => {
    if (name === 'next/server') return { NextResponse: { json: (body, options) => ({ status: options?.status || 200, body }) } };
    if (name === '@/lib/mongodb') return { TenantError, getDatabase: async request => ({ sessionUser: request.sessionUser, rawCollection: () => collection(request.company) }) };
    if (name === '@/context/AuthContext') return { useAuth: () => ({ user: { uid: 'admin', role: 'ADMIN', name: 'Admin', companySlug: 'esstee', company: 'Esstee' }, role: 'ADMIN', logout: async () => {} }) };
    if (name === '@/context/NavContext') return { useNav: () => ({ isNavHidden: uiCollapsed, isMobileOpen: uiMobile, closeMobileNav: () => {}, setIsMobileOpen: () => {}, showNav: () => {}, hideNav: () => {} }) };
    if (name === '@/context/DepartmentNavigationContext') return { useDepartmentNavigation: () => ({ selection: uiSelection, ready: uiReady, isVisible: href => load('src/lib/departmentNavigation.ts').navigationItemVisible(href, uiSelection, 'ADMIN', uiReady) }) };
    if (name === '@/lib/services/cmmsService') return new Proxy({}, { get: () => () => () => {} });
    if (name === 'next/navigation') return { usePathname: () => '/esstee/dashboard', useRouter: () => ({ push: () => {} }) };
    if (name === 'next/link') return { default: ({ children, ...props }) => require('react').createElement('a', props, children), __esModule: true };
    if (name.endsWith('/ScanModal')) return { ScanModal: () => null };
    if (name.endsWith('/CameraScannerModal')) return { CameraScannerModal: () => null };
    if (name === './LiveClock') return { LiveClock: () => null };
    if (name.startsWith('@/')) return load(`src/${name.slice(2)}.ts`);
    if (name.startsWith('.')) return load(path.resolve(path.dirname(full), `${name}.ts`));
    return require(name);
  };
  new Function('exports', 'require', code)(exports, requireLocal);
  return exports;
}
const utility = load('src/lib/departmentNavigation.ts');
const route = load('src/app/api/departments/route.ts');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { Sidebar } = load('src/components/layout/Sidebar.tsx');
const { Navbar } = load('src/components/layout/Navbar.tsx');
const { WorkspaceHeader } = load('src/components/layout/WorkspaceHeader.tsx');
for (const [collapsed, mobile] of [[false, false], [true, false], [false, true]]) {
  uiCollapsed = collapsed; uiMobile = mobile;
  for (const Component of [Sidebar, Navbar, WorkspaceHeader]) {
    uiSelection = ['/dashboard', '/dashboard/history'];
    const hidden = renderToStaticMarkup(React.createElement(Component));
    assert.ok(!hidden.includes('/dashboard/ppm-scheduler'), `${Component.name}: unselected PPM link leaked`);
    assert.ok(!hidden.includes('/dashboard/messages'), `${Component.name}: unselected notification shortcut leaked`);
    assert.ok(!hidden.includes('/dashboard/settings'), `${Component.name}: unselected settings shortcut leaked`);
    uiSelection = ['/dashboard/ppm-scheduler'];
    const visible = renderToStaticMarkup(React.createElement(Component));
    if (Component !== WorkspaceHeader) assert.ok(visible.includes('/dashboard/ppm-scheduler'), `${Component.name}: selected PPM missing`);
    uiReady = false;
    assert.ok(!renderToStaticMarkup(React.createElement(Component)).includes('/dashboard/ppm-scheduler'), 'Menu leaked during initial loading');
    uiReady = true;
  }
}
const department = { id: 'maintenance', name: 'Maintenance', description: 'Workshop', userCount: 3, kpi1Name: 'Time', kpi1Type: 'auto', kpi1Weight: 40, kpi2Name: 'Done', kpi2Type: 'auto', kpi2Weight: 30, kpi3Name: 'Quality', kpi3Type: 'manual', kpi3Weight: 30, navigation: ['/dashboard/history', '/dashboard/inventory'] };
const request = (role, company = 'esstee', departments = [department], version = 0) => ({ company, sessionUser: role ? { role } : null, json: async () => ({ departments, version }) });
(async () => {
  assert.equal(utility.departmentSelection([], { role: 'MECHANIC' }), null);
  assert.deepEqual(utility.departmentSelection([department], { department: ' MAINTENANCE ' }), department.navigation);
  assert.deepEqual(utility.departmentSelection([{ ...department, navigation: [] }], { department: 'Maintenance' }), []);
  assert.deepEqual(utility.departmentSelection([department], { department: 'Other', role: 'MAINTENANCE' }), department.navigation);
  assert.throws(() => utility.validateDepartments([{ ...department, navigation: ['/dashboard/not-a-menu'] }]));
  assert.throws(() => utility.validateDepartments([department, { ...department, id: 'different', name: ' maintenance ' }]));
  const defaults = [{ href: '/dashboard', label: 'Home' }, { href: '/dashboard/settings', label: 'Settings' }, { href: '/dashboard/users', label: 'Users' }];
  assert.equal(utility.departmentMenu(defaults, null, 'ADMIN', item => item), defaults);
  assert.deepEqual(utility.departmentMenu(defaults, [], 'ADMIN', item => item), []);
  assert.deepEqual(utility.departmentMenu(defaults, ['/dashboard/settings'], 'ADMIN', item => item).map(item => item.href), ['/dashboard/settings']);
  assert.deepEqual(utility.departmentMenu(defaults, ['/dashboard/settings', '/dashboard/users'], 'MECHANIC', item => item), []);
  assert.deepEqual(utility.departmentMenu(defaults, null, 'ADMIN', item => item, false), [], 'Do not flash the default menu before loading department choices');
  const withoutPpm = ['/dashboard', '/dashboard/history'];
  for (const role of ['MECHANIC', 'ADMIN', 'STORE_PERSON', 'SENIOR_MECHANIC']) {
    const filtered = utility.departmentMenu([...defaults, { href: '/dashboard/ppm-scheduler', label: 'PPM Scheduler' }], withoutPpm, role, item => item);
    assert.deepEqual(filtered.map(item => item.href), withoutPpm, `${role}: only selected routes may appear`);
    assert.equal(utility.navigationItemVisible('/esstee/dashboard/ppm-scheduler', withoutPpm, role), false);
    assert.equal(utility.navigationItemVisible('/dashboard/messages', withoutPpm, role), false);
    assert.equal(utility.navigationItemVisible('/dashboard/kpi', withoutPpm, role), false);
    assert.equal(utility.navigationItemVisible('/dashboard/history', withoutPpm, role, false), false);
  }
  assert.equal(utility.navigationItemVisible('/dashboard/ppm-scheduler', ['/dashboard/ppm-scheduler'], 'ADMIN'), true);
  assert.deepEqual(utility.departmentMenu(defaults, department.navigation, 'MECHANIC', item => item).map(item => item.href), department.navigation);
  assert.equal((await route.GET(request(null))).status, 401);
  assert.equal((await route.PUT(request('MECHANIC'))).status, 403);
  assert.equal((await route.PUT(request('ADMIN', 'esstee', [{ ...department, navigation: ['unknown'] }]))).status, 400);
  const saved = await route.PUT(request('ADMIN'));
  assert.equal(saved.status, 200); assert.equal(saved.body.version, 1);
  assert.deepEqual((await route.GET(request('MECHANIC'))).body.departments[0].navigation, department.navigation);
  assert.equal((await route.GET(request('ADMIN', 'other-company'))).body.departments, null);
  assert.equal((await route.PUT(request('ADMIN'))).status, 409, 'Stale editors must not overwrite newer choices');
  const rename = await route.PUT(request('ADMIN', 'esstee', [{ ...department, name: 'Workshop' }], 1));
  assert.equal(rename.status, 200);
  assert.deepEqual(utility.departmentSelection(rename.body.departments, { department: 'Maintenance' }), department.navigation);
  const legacy = { ...department }; delete legacy.navigation;
  assert.equal(utility.departmentSelection(utility.validateDepartments([legacy]), { department: 'Maintenance' }), null);
  console.log('PASS: selected-only menus, PPM toggling, shortcut visibility, loading state, role checks, validation, save/load, tenant isolation, edit conflicts and renaming');
})().catch(error => { console.error(error); process.exitCode = 1; });
