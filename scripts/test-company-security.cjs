const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, imports, globals = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  vm.runInNewContext(code, { exports, require: name => imports[name], process: { env: {} }, global: {}, URL, ...globals });
  return exports;
}
const company = { slug: 'esstee', name: 'Esstee', databaseName: 'compliance_esstee' };
let session = null, account = { uid: 'u1', role: 'MECHANIC', status: 'ACTIVE' }, connections = 0;
const client = { connect: async () => { connections++; }, db: () => ({ collection: () => ({ findOne: async () => account }) }) };
const mongodb = load('src/lib/mongodb.ts', {
  './companyIdentity': { canonicalCompanySlug: s => String(s || '').toLowerCase() },
  mongodb: { MongoClient: class { constructor() { return client; } }, ObjectId: { isValid: () => false } },
  './registry': { ensureRegistryInitialized: async () => {}, validateActiveCompany: async () => ({ valid: true, company }) },
  './auth': { extractSessionToken: req => req.headers.get('authorization'), verifySessionToken: () => session },
}, { process: { env: { MONGODB_URI: 'mongodb://test' } } });
function request(path = '/api/machines', method = 'GET', companySlug) {
  return new Request('http://localhost' + path, { method, headers: { authorization: 'test', ...(companySlug ? { 'x-company-slug': companySlug } : {}) } });
}
(async () => {
  await assert.rejects(mongodb.getDatabase(request()), error => error.statusCode === 401);
  assert.equal(connections, 0, 'Unauthenticated requests must not connect');
  session = { uid: 'u1', companySlug: 'esstee', role: 'ADMIN' };
  await assert.rejects(mongodb.getDatabase(request('/api/machines', 'GET', 'partner')), error => error.statusCode === 403);
  assert.equal(connections, 0, 'Cross-company requests must not connect');
  await assert.rejects(mongodb.getDatabase(request('/api/users', 'POST')), error => error.statusCode === 403);
  account = { ...account, role: 'ADMIN' };
  assert.equal((await mongodb.getDatabase(request('/api/users', 'POST'))).tenant, 'esstee');
  account = { ...account, status: 'INACTIVE' };
  await assert.rejects(mongodb.getDatabase(request()), error => error.statusCode === 401);
  account = null;
  await assert.rejects(mongodb.getDatabase(request()), error => error.statusCode === 401);
  const scan = load('src/lib/scanUrl.ts', { './companyIdentity': { canonicalCompanySlug: s => s || '' } });
  assert.equal(scan.assetScanUrl('https://plant.test', 'A/1', 'esstee'), 'https://plant.test/esstee/scan/A%2F1');
  assert.throws(() => scan.assetScanUrl('https://plant.test', 'A1'), /Sign in/);
  let active = 'esstee';
  const values = new Map();
  const preferences = load('src/lib/tenantPreferences.ts', { './companyIdentity': { canonicalCompanySlug: s => s } }, {
    window: {}, localStorage: { getItem: key => key === 'cmms_active_company' ? active : values.get(key), setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) },
  });
  preferences.tenantPreferences.setItem('cmms_settings_units', 'Esstee units');
  active = 'partner';
  assert.equal(preferences.tenantPreferences.getItem('cmms_settings_units'), undefined);
  console.log('PASS: unsigned access, cross-company access, refreshed user roles, admin writes, inactive/deleted accounts, company QR URLs, isolated preferences.');
})().catch(error => { console.error(error); process.exitCode = 1; });
