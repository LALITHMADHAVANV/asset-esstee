const fs = require('node:fs');
const ts = require('typescript');
const assert = require('node:assert/strict');
const source = fs.readFileSync('src/lib/services/cmmsService.ts', 'utf8');
const start = source.indexOf('export async function startRepairTicket(');
const end = source.indexOf('export async function rejectRepairTicket(', start);
const compiled = ts.transpile(source.slice(start, end), { module: ts.ModuleKind.CommonJS });
let now = Date.parse('2026-10-30T10:00:00Z');
class TestDate extends Date {
  constructor(...args) { super(...(args.length ? args : [now])); }
  static now() { return now; }
}
let cache = { repairs: [{ id: 'WO-1', status: 'ASSIGNED', downtimeMinutes: 0 }], parts: [] };
let ok = true;
let calls = [];
const methods = {};
new Function('exports', 'getLocal', 'setLocal', 'notifyLocal', 'apiFetch', 'STORAGE_KEYS', 'Date', compiled)(
  methods,
  key => cache[key],
  (key, value) => { cache[key] = value; },
  () => {},
  async (_, init) => { calls.push(JSON.parse(init.body)); return { ok }; },
  { REPAIRS: 'repairs', PARTS: 'parts' },
  TestDate
);
(async () => {
  await methods.startRepairTicket('WO-1', 'Mechanic');
  assert.equal(cache.repairs[0].status, 'IN_PROGRESS');
  const firstStart = cache.repairs[0].startedAt;
  await methods.startRepairTicket('WO-1', 'Mechanic');
  assert.equal(calls.length, 1, 'Repeated start is idempotent');
  now += 5 * 60000;
  await methods.stopRepairTicket('WO-1');
  assert.equal(cache.repairs[0].status, 'ASSIGNED');
  assert.equal(cache.repairs[0].downtimeMinutes, 5);
  assert.equal(cache.repairs[0].startedAt, null);
  await methods.stopRepairTicket('WO-1');
  assert.equal(cache.repairs[0].downtimeMinutes, 5, 'Repeated stop cannot add time');
  now += 10 * 60000; // Paused time must not count as work.
  await methods.startRepairTicket('WO-1', 'Mechanic');
  assert.notEqual(cache.repairs[0].startedAt, firstStart);
  now += 3 * 60000;
  await methods.stopRepairTicket('WO-1');
  assert.equal(cache.repairs[0].downtimeMinutes, 8);
  ok = false;
  await assert.rejects(methods.startRepairTicket('WO-1', 'Mechanic'));
  assert.equal(cache.repairs[0].status, 'ASSIGNED', 'Failed save cannot start the local timer');
  ok = true;
  await methods.startRepairTicket('WO-1', 'Mechanic');
  ok = false;
  await assert.rejects(methods.stopRepairTicket('WO-1'));
  assert.equal(cache.repairs[0].status, 'IN_PROGRESS', 'Failed save cannot stop the local timer');
  cache.repairs[0].status = 'COMPLETED';
  await assert.rejects(methods.startRepairTicket('WO-1', 'Mechanic'));
  console.log('PASS: start, pause, resume, accumulated time, repeated actions, failed saves, closed work orders');
})().catch(error => { console.error(error); process.exitCode = 1; });
