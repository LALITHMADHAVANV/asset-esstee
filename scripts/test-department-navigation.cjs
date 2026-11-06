const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const assert = require('node:assert/strict');
const cache = new Map();
const stores = new Map();
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
  const code = ts.transpileModule(fs.readFileSync(full, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const requireLocal = name => {
    if (name === 'next/server') return { NextResponse: { json: (body, options) => ({ status: options?.status || 200, body }) } };
    if (name === '@/lib/mongodb') return { TenantError, getDatabase: async request => ({ sessionUser: request.sessionUser, rawCollection: () => collection(request.company) }) };
    if (name.startsWith('@/')) return load(`src/${name.slice(2)}.ts`);
    if (name.startsWith('.')) return load(path.resolve(path.dirname(full), `${name}.ts`));
    return require(name);
  };
  new Function('exports', 'require', code)(exports, requireLocal);
  return exports;
}
const utility = load('src/lib/departmentNavigation.ts');
const route = load('src/app/api/departments/route.ts');
const department = { id: 'maintenance', name: 'Maintenance', description: 'Workshop', userCount: 3, kpi1Name: 'Time', kpi1Type: 'auto', kpi1Weight: 40, kpi2Name: 'Done', kpi2Type: 'auto', kpi2Weight: 30, kpi3Name: 'Quality', kpi3Type: 'manual', kpi3Weight: 30, navigation: ['/dashboard/history', '/dashboard/inventory'] };
const request = (role, company = 'esstee', departments = [department], version = 0) => ({ company, sessionUser: role ? { role } : null, json: async () => ({ departments, version }) });
(async () => {
  assert.equal(utility.departmentSelection([], { role: 'MECHANIC' }), null);
  assert.deepEqual(utility.departmentSelection([department], { department: ' MAINTENANCE ' }), department.navigation);
  assert.deepEqual(utility.departmentSelection([{ ...department, navigation: [] }], { department: 'Maintenance' }), []);
  assert.deepEqual(utility.departmentSelection([department], { department: 'Other', role: 'MAINTENANCE' }), department.navigation);
  assert.throws(() => utility.validateDepartments([{ ...department, navigation: ['/dashboard/settings'] }]));
  assert.throws(() => utility.validateDepartments([department, { ...department, id: 'different', name: ' maintenance ' }]));
  const defaults = [{ href: '/dashboard', label: 'Home' }, { href: '/dashboard/settings', label: 'Settings' }, { href: '/dashboard/users', label: 'Users' }];
  assert.equal(utility.departmentMenu(defaults, null, 'ADMIN', item => item), defaults);
  assert.deepEqual(utility.departmentMenu(defaults, [], 'ADMIN', item => item).map(item => item.href), ['/dashboard/settings', '/dashboard/users']);
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
  console.log('PASS: selection, legacy fallback, empty menu, admin controls, validation, authenticated save/load, tenant isolation, edit conflicts and renaming');
})().catch(error => { console.error(error); process.exitCode = 1; });
