const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
const vm = require('node:vm');
function load(file, imports = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText,
    { exports, require: name => { if (!(name in imports)) throw Error(name); return imports[name]; }, console });
  return exports;
}
const { repairSpareCost } = load('src/lib/repairCost.ts');
assert.equal(repairSpareCost({ partsUsed: [], repairCost: 900, laborCost: 900 }), 0);
assert.equal(repairSpareCost({ partsUsed: [{ partId: 'P1', quantity: 2, unitCost: 125.5 }], repairCost: 1000, laborCost: 749 }), 251);
assert.equal(repairSpareCost({ partsUsed: [{ partId: 'P1', quantity: 2 }] }, [{ partId: 'P1', unitCost: 100 }]), 200);
assert.equal(repairSpareCost({ partsUsed: [{ partId: 'missing', quantity: 2 }] }), 0, 'Unknown costs are not fabricated');
const { apiRoleAllowed } = load('src/lib/apiAccess.ts');
assert.equal(apiRoleAllowed('MECHANIC', '/api/parts', 'PATCH'), false);
assert.equal(apiRoleAllowed('STORE_PERSON', '/api/parts', 'PATCH'), true);
assert.equal(apiRoleAllowed('MECHANIC', '/api/repairs', 'DELETE'), false);
assert.equal(apiRoleAllowed('MECHANIC', '/api/repairs', 'PATCH'), true);
assert.equal(apiRoleAllowed('STORE_PERSON', '/api/users', 'POST'), false);
assert.equal(apiRoleAllowed('Floor Manager', '/api/users', 'POST'), false);

const source = fs.readFileSync('src/lib/services/cmmsService.ts', 'utf8');
const begin = source.indexOf('export async function resolveRepairTicket(');
const end = source.indexOf('export function subscribeNotifications(', begin);
let cache, calls, succeeds, refreshes;
const methods = {};
new Function('exports', 'getLocal', 'setLocal', 'notifyLocal', 'apiFetch', 'STORAGE_KEYS', 'fetchRepairsOnce', 'fetchPartsOnce', 'fetchMachinesOnce',
  ts.transpileModule(source.slice(begin, end), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText)(
  methods, key => cache[key], (key, value) => { cache[key] = value; }, () => {},
  async (url, init) => { calls.push({ url, body: JSON.parse(init.body) }); return { ok: succeeds, json: async () => succeeds
    ? { success: true, data: { ...cache.repairs[0], status: 'COMPLETED', partsCost: 200, repairCost: 200 } }
    : { error: 'Save failed' } }; },
  { REPAIRS: 'repairs', PARTS: 'parts', MACHINES: 'machines' },
  ...[1, 2, 3].map(() => async () => { refreshes++; }));
function reset() {
  cache = { repairs: [{ id: 'WO-1', status: 'IN_PROGRESS', partsUsed: [{ partId: 'P1', quantity: 2 }] }], parts: [{ partId: 'P1', stock: 10 }], machines: [] };
  calls = []; refreshes = 0; succeeds = true;
}
(async () => {
  reset(); succeeds = false;
  const previous = JSON.stringify(cache);
  await assert.rejects(methods.resolveRepairTicket('WO-1', 10, 'Fixed', 'Mechanic'), /Save failed/);
  assert.equal(JSON.stringify(cache), previous, 'Failed completion cannot change local state');
  assert.equal(calls.length, 1, 'Failed completion cannot continue stock/machine writes');
  assert.equal(refreshes, 0);
  reset();
  await methods.resolveRepairTicket('WO-1', 10, 'Fixed', 'Mechanic', [], { repairCost: 999, partsCost: 999 });
  assert.equal(calls.length, 1, 'Completion is one server mutation');
  assert.equal(cache.parts[0].stock, 10, 'Browser never deducts stock');
  assert.equal(cache.repairs[0].repairCost, 200, 'Only server spare cost is accepted');
  assert.equal(calls[0].body.updates.repairCost, undefined);
  assert.equal(refreshes, 3);

  let active = 'esstee';
  const storage = new Map([['cmms_parts', '[{"partId":"legacy-leak"}]'], ['esstee_cmms_parts', '[{"partId":"esstee-only"}]']]);
  const cacheCode = source.slice(source.indexOf('function getLocal<'), source.indexOf('function notifyLocal<'));
  const cacheMethods = new Function('localStorage', 'getActiveTenant', 'window',
    ts.transpileModule(cacheCode, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText + '\nreturn { getLocal, setLocal };')(
      { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) }, () => active, {});
  assert.equal(cacheMethods.getLocal('cmms_parts', [])[0].partId, 'esstee-only');
  active = 'partner';
  assert.equal(cacheMethods.getLocal('cmms_parts', []).length, 0, 'Shared cache cannot leak to another tenant');
  cacheMethods.setLocal('cmms_parts', [{ partId: 'partner-only' }]);
  assert.equal(storage.get('cmms_parts'), '[{"partId":"legacy-leak"}]', 'No writes to shared cache');
  const { qrBookingCompany, finishQrBooking } = load('src/lib/qrTicket.ts');
  assert.equal(qrBookingCompany('/partner/scan/M1', 'esstee'), 'partner', 'QR path chooses the company without modifying browser storage');
  assert.equal(qrBookingCompany('/scan/M1'), 'esstee', 'Legacy QR links retain their default company');
  const actions = [];
  const browser = { alert: text => actions.push(['alert', text]), close: () => actions.push(['close']), closed: false, location: { replace: url => actions.push(['replace', url]) } };
  finishQrBooking('WO-QR-test', browser);
  assert.equal(actions[0][0], 'alert');
  assert.match(actions[0][1], /Ticket booked successfully/);
  assert.equal(actions[1][0], 'close');
  assert.deepEqual(actions[2], ['replace', '/scan/booked?ticket=WO-QR-test']);
  actions.length = 0;
  finishQrBooking('WO-QR-test', { ...browser, closed: true });
  assert.equal(actions.length, 2, 'Closed tabs need no navigation');
  actions.length = 0;
  finishQrBooking('WO-QR-test', { ...browser, close: () => { throw Error('Phone camera tabs cannot close themselves'); } });
  assert.equal(actions[1][0], 'replace', 'A blocked close still leaves the form for the confirmation screen');
  console.log('PASS: spare-only costs, API roles, failed saves, single completion request, server pricing, tenant caches, QR company selection and success/exit flow.');
})().catch(error => { console.error(error); process.exitCode = 1; });
