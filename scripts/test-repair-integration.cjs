// Starts an isolated replica set. Never connects to the application's database.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { randomBytes } = require('node:crypto');
const assert = require('node:assert/strict');
const ts = require('typescript');
const { MongoClient } = require('mongodb');
const binary = process.env.MONGOD_BINARY || 'C:\\Program Files\\MongoDB\\Server\\9.0\\bin\\mongod.exe';
if (!fs.existsSync(binary)) throw Error('Set MONGOD_BINARY to a local mongod executable.');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'esstee-repair-test-'));
const port = Number(process.env.TEST_MONGO_PORT || 27187);
const server = spawn(binary, ['--replSet', 'repair-test', '--port', String(port), '--bind_ip', '127.0.0.1', '--dbpath', directory, '--logpath', path.join(directory, 'mongo.log'), '--quiet'], { windowsHide: true, stdio: 'ignore' });
const direct = new MongoClient('mongodb://127.0.0.1:' + port + '/?directConnection=true', { serverSelectionTimeoutMS: 1000 });
const client = new MongoClient('mongodb://127.0.0.1:' + port + '/?replicaSet=repair-test', { serverSelectionTimeoutMS: 1000 });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function retry(action) {
  let last;
  for (let attempt = 0; attempt < 40; attempt++) {
    try { return await action(); } catch (error) { last = error; await delay(250); }
  }
  throw last;
}
class TenantError extends Error { constructor(message, statusCode = 400) { super(message); this.statusCode = statusCode; } }
const cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file);
  const exports = {};
  cache.set(file, exports);
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  new Function('exports', 'require', code)(exports, name => {
    if (name === '@/lib/mongodb' || name === './mongodb') return {
      TenantError, getMongoClient: async () => client,
      getCompanyDatabase: async slug => {
        if (!['esstee', 'partner'].includes(slug)) throw new TenantError('Workspace not found.', 404);
        return { db: slug === 'esstee' ? { collection: name => tenant.rawCollection(name) } : client.db('qr_partner'), company: { slug, name: slug === 'esstee' ? 'Esstee QA' : 'Partner QA' } };
      },
    };
    if (name.startsWith('@/')) return load('src/' + name.slice(2) + '.ts');
    return require(name);
  });
  return exports;
}
let injectMachineFailure = false;
let db;
let app;
const tenant = { tenant: 'test', companyName: 'Test', sessionUser: { uid: 'U1', name: 'Test mechanic', role: 'ADMIN' }, collection(name) { return db.collection(name); }, rawCollection(name) {
  const collection = db.collection(name);
  if (name !== 'machines' || !injectMachineFailure) return collection;
  return new Proxy(collection, { get(target, key) {
    if (key === 'updateOne') return async () => { throw Error('Simulated machine write failure'); };
    const value = target[key]; return typeof value === 'function' ? value.bind(target) : value;
  } });
} };
const { mutateRepair } = load('src/lib/services/repairMutation.ts');
async function ticket(id, machineId = 'M1') {
  return mutateRepair(tenant, id, { machineId, status: 'ASSIGNED', faultCategory: 'Test fault', urgency: 'WARNING', downtimeMinutes: 0 }, true);
}
async function complete(id, partsUsed = [{ partId: 'P1', quantity: 2 }]) {
  return mutateRepair(tenant, id, { status: 'COMPLETED', partsUsed, downtimeMinutes: 10, laborCost: 999, repairCost: 99999, partsCost: 99999 });
}
(async () => {
  await retry(() => direct.connect());
  await direct.db('admin').command({ replSetInitiate: { _id: 'repair-test', members: [{ _id: 0, host: '127.0.0.1:' + port }] } });
  await retry(async () => { const hello = await direct.db('admin').command({ hello: 1 }); if (!hello.isWritablePrimary) throw Error('Election pending'); });
  await retry(() => client.connect());
  db = client.db('repair_regression');
  await db.collection('machines').insertMany([{ id: 'M1', status: 'ACTIVE', totalDowntimeMinutes: 0 }, { id: 'M2', status: 'ACTIVE', totalDowntimeMinutes: 0 }]);
  await db.collection('spare_parts').insertMany([{ partId: 'P1', sku: 'SKU1', name: 'Hook', stock: 10, unitCost: 125 }, { partId: 'P2', sku: 'SKU2', name: 'Motor', stock: 0, unitCost: 1000 }]);
  await db.collection('repair_tickets').createIndex({ id: 1 }, { unique: true });
  await ticket('R1');
  await mutateRepair(tenant, 'R1', { status: 'IN_PROGRESS', startedAt: new Date().toISOString(), partsUsed: [{ partId: 'P1', quantity: 2, unitCost: 1 }] });
  assert.equal((await db.collection('spare_parts').findOne({ partId: 'P1' })).stock, 10, 'Starting never deducts stock');
  const first = await complete('R1');
  assert.equal(first.ticket.repairCost, 250, 'Server prices spares, ignoring supplied labour and totals');
  assert.equal(first.ticket.laborCost, undefined);
  assert.equal((await db.collection('spare_parts').findOne({ partId: 'P1' })).stock, 8);
  assert.equal((await db.collection('machines').findOne({ id: 'M1' })).totalDowntimeMinutes, 10);
  const repeat = await complete('R1');
  assert.equal(repeat.changed, false);
  assert.equal((await db.collection('spare_parts').findOne({ partId: 'P1' })).stock, 8);
  assert.equal((await db.collection('machines').findOne({ id: 'M1' })).totalDowntimeMinutes, 10);
  await assert.rejects(mutateRepair(tenant, 'R1', { status: 'IN_PROGRESS' }), error => error.statusCode === 409);
  await ticket('R2'); await ticket('R3');
  await complete('R2');
  assert.equal((await db.collection('machines').findOne({ id: 'M1' })).status, 'BREAKDOWN', 'Another open ticket keeps the asset down');
  const race = await Promise.all([complete('R3'), complete('R3')]);
  assert.equal(race.filter(result => result.changed).length, 1, 'Concurrent completion issues stock once');
  assert.equal((await db.collection('spare_parts').findOne({ partId: 'P1' })).stock, 4);
  assert.equal((await db.collection('machines').findOne({ id: 'M1' })).status, 'ACTIVE');
  await ticket('R4', 'M2');
  await assert.rejects(complete('R4', [{ partId: 'P1', quantity: 1 }, { partId: 'P2', quantity: 1 }]), error => error.statusCode === 409);
  assert.equal((await db.collection('spare_parts').findOne({ partId: 'P1' })).stock, 4, 'Insufficient second spare rolls back first deduction');
  assert.equal((await db.collection('repair_tickets').findOne({ id: 'R4' })).status, 'ASSIGNED');
  injectMachineFailure = true;
  await assert.rejects(complete('R4'), /Simulated machine write failure/);
  injectMachineFailure = false;
  assert.equal((await db.collection('spare_parts').findOne({ partId: 'P1' })).stock, 4, 'Asset write failure rolls back stock');
  assert.equal((await db.collection('repair_tickets').findOne({ id: 'R4' })).status, 'ASSIGNED', 'Asset failure rolls back ticket');
  await assert.rejects(complete('R4', [{ partId: 'P1', quantity: -1 }]), error => error.statusCode === 400);
  await assert.rejects(complete('missing'), error => error.statusCode === 404);
  await assert.rejects(mutateRepair(tenant, { $ne: '' }, {}), error => error.statusCode === 400);
  await mutateRepair(tenant, 'R4', { status: 'REJECTED' });
  assert.equal((await db.collection('machines').findOne({ id: 'M2' })).status, 'ACTIVE');
  console.log('PASS: real MongoDB transactions, single issue, concurrent retries, spare-only pricing, open-ticket status, rollback, invalid input, no ghost repairs.');

  const { readImportWorkbook, importTemplate } = load('src/lib/importWorkbook.ts');
  const { previewImport, commitImport, authorizeImport } = load('src/lib/services/bulkImport.ts');
  for (const kind of ['assets', 'spares']) for (const format of ['xlsx', 'csv']) {
    const template = await importTemplate(kind, format);
    const rows = await readImportWorkbook(new File([template.content], 'template.' + format), kind);
    assert.equal(rows.length, 1, kind + ' ' + format + ' template round-trips');
  }
  const csv = 'partId,quantity,sku,name,unitCost\r\n"00123",2,"0001","Hook, small",25.5\r\n';
  const received = await readImportWorkbook(new File([csv], 'receipt.csv'), 'spares');
  assert.equal(received[0].values.partId, '00123', 'Leading zero IDs are retained');
  assert.equal(received[0].values.name, 'Hook, small', 'Quoted CSV commas are retained');
  assert.equal((await previewImport(tenant, 'spares', received)).errors.length, 0);
  await commitImport(tenant, 'spares', received, 'import-new', 'hash-new');
  assert.equal((await db.collection('spare_parts').findOne({ partId: '00123' })).stock, 2);
  await commitImport(tenant, 'spares', received, 'import-new', 'hash-new');
  assert.equal((await db.collection('spare_parts').findOne({ partId: '00123' })).stock, 2, 'Retry never receives stock twice');
  await assert.rejects(commitImport(tenant, 'spares', received, 'import-new', 'different-hash'), error => error.statusCode === 409);
  const raceImport = await Promise.all([commitImport(tenant, 'spares', received, 'import-race', 'hash-race'), commitImport(tenant, 'spares', received, 'import-race', 'hash-race')]);
  assert.equal(raceImport.filter(result => !result.repeated).length, 1);
  assert.equal((await db.collection('spare_parts').findOne({ partId: '00123' })).stock, 4);
  const invalid = [...received, { row: 3, values: { partId: 'invalid', quantity: '-1' } }];
  assert.equal((await previewImport(tenant, 'spares', invalid)).errors.length, 1);
  await assert.rejects(commitImport(tenant, 'spares', invalid, 'invalid-import', 'invalid-hash'), error => error.statusCode === 400);
  assert.equal((await db.collection('spare_parts').findOne({ partId: '00123' })).stock, 4, 'One bad row prevents all writes');
  const assetTemplate = await importTemplate('assets', 'xlsx');
  const assets = await readImportWorkbook(new File([assetTemplate.content], 'assets.xlsx'), 'assets');
  assets[0].values.purchaseDate = '18/11/2026';
  await commitImport(tenant, 'assets', assets, 'asset-import', 'asset-hash');
  assert.equal((await db.collection('machines').findOne({ id: assets[0].values.id })).purchaseDate, '2026-11-18');
  assert.equal((await previewImport(tenant, 'assets', assets)).errors.length, 1, 'Existing asset IDs are not overwritten');
  assert.equal((await previewImport(tenant, 'spares', [received[0], { ...received[0], row: 3 }])).errors.length, 1);
  const tech = { ...tenant, sessionUser: { ...tenant.sessionUser, role: 'MECHANIC' } };
  assert.throws(() => authorizeImport(tech, 'spares'), error => error.statusCode === 403);
  const store = { ...tenant, sessionUser: { ...tenant.sessionUser, role: 'STORE_PERSON' } };
  assert.throws(() => authorizeImport(store, 'assets'), error => error.statusCode === 403);
  await assert.rejects(readImportWorkbook(new File(['partId,quantity,quantity\nA,1,1'], 'duplicate.csv'), 'spares'), /Duplicate column/);
  const ExcelJS = require('exceljs');
  const formulaBook = new ExcelJS.Workbook();
  const formulaSheet = formulaBook.addWorksheet('Spare Inward');
  formulaSheet.addRow(['partId', 'quantity']);
  formulaSheet.addRow(['P1', { formula: '1+1', result: 2 }]);
  await assert.rejects(readImportWorkbook(new File([await formulaBook.xlsx.writeBuffer()], 'formula.xlsx'), 'spares'), /replace formulas/);
  console.log('PASS: Excel/CSV templates, leading zeros, quoted values, bulk assets, stock receipts, retry/race protection, all-row validation, permissions, duplicate IDs/headers and formulas.');
  const { qrAsset, bookQrTicket } = load('src/lib/services/qrBooking.ts');
  await db.collection('machines').insertOne({ id: 'MQR', name: 'QR test machine', cost: 99999, status: 'ACTIVE', currentLine: 'Line 01', unit: 'UNIT - 1' });
  const publicAsset = await qrAsset('esstee', 'MQR');
  assert.equal(publicAsset.id, 'MQR');
  assert.equal(publicAsset.cost, undefined, 'Public QR lookup never returns acquisition costs');
  const booking = { company: 'esstee', machineId: 'MQR', requestId: 'qr-request-0000000001', faultCategory: 'Mechanical fault', urgency: 'CRITICAL', reporterName: 'Floor operator', faultDetails: 'Needle jam', status: 'COMPLETED', partsUsed: [{ partId: 'P1', quantity: 100 }] };
  const booked = await bookQrTicket(booking);
  assert.equal(booked.ticket.status, 'PENDING', 'Public input cannot complete a repair');
  assert.equal(booked.ticket.partsUsed.length, 0, 'Public bookings cannot issue stock');
  assert.equal(booked.ticket.repairCost, 0);
  const bookingRace = await Promise.all([bookQrTicket(booking), bookQrTicket(booking)]);
  assert.equal(bookingRace.every(result => !result.changed), true);
  assert.equal(await db.collection('repair_tickets').countDocuments({ id: booked.ticketId }), 1);
  assert.equal((await db.collection('machines').findOne({ id: 'MQR' })).status, 'BREAKDOWN');
  await assert.rejects(bookQrTicket({ ...booking, faultDetails: 'Changed retry' }), error => error.statusCode === 409);
  await bookQrTicket({ ...booking, requestId: 'qr-request-0000000002' });
  await bookQrTicket({ ...booking, requestId: 'qr-request-0000000003' });
  await assert.rejects(bookQrTicket({ ...booking, requestId: 'qr-request-0000000004' }), error => error.statusCode === 429);
  await assert.rejects(bookQrTicket({ ...booking, machineId: { $ne: '' } }), error => error.statusCode === 400);
  await assert.rejects(bookQrTicket({ ...booking, machineId: 'missing' }), error => error.statusCode === 404);
  await assert.rejects(qrAsset('missing-company', 'MQR'), error => error.statusCode === 404);
  await client.db('qr_partner').collection('machines').insertOne({ id: 'MQR', status: 'ACTIVE' });
  const partnerBooking = await bookQrTicket({ ...booking, company: 'partner' });
  assert.equal(await db.collection('repair_tickets').countDocuments({ id: partnerBooking.ticketId }), 0);
  assert.equal(await client.db('qr_partner').collection('repair_tickets').countDocuments({ id: partnerBooking.ticketId }), 1);
  await db.collection('machines').insertOne({ id: 'MQR-FAIL', status: 'ACTIVE' });
  injectMachineFailure = true;
  await assert.rejects(bookQrTicket({ ...booking, machineId: 'MQR-FAIL' }), /Simulated machine write failure/);
  injectMachineFailure = false;
  assert.equal(await db.collection('repair_tickets').countDocuments({ machineId: 'MQR-FAIL' }), 0, 'Failed public booking cannot leave a partial ticket');
  console.log('PASS: public QR asset privacy, pending-only booking, stock protection, retries, rate limits, tenant isolation and rollback.');
  if (process.env.TEST_HTTP === '1') {
    const registryName = 'repair_http_registry';
    await client.db(registryName).collection('companies').insertOne({ slug: 'esstee', name: 'Esstee QA', active: true, databaseName: db.databaseName });
    const bcrypt = require('bcryptjs');
    const password = randomBytes(20).toString('hex');
    const passwordHash = await bcrypt.hash(password, 10);
    await db.collection('users').insertMany([
      { uid: 'QA-ADMIN', email: 'admin@example.test', name: 'QA Administrator', role: 'ADMIN', status: 'ACTIVE', passwordHash },
      { uid: 'QA-MECH', email: 'mechanic@example.test', name: 'QA Mechanic', role: 'MECHANIC', status: 'ACTIVE', passwordHash },
    ]);
    const httpPort = Number(process.env.TEST_HTTP_PORT || 3117);
    const origin = 'http://127.0.0.1:' + httpPort;
    app = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--hostname', '127.0.0.1', '--port', String(httpPort)], {
      windowsHide: true, stdio: 'ignore', env: { ...process.env, NODE_ENV: 'production',
        MONGODB_URI: 'mongodb://127.0.0.1:' + port + '/?replicaSet=repair-test', REGISTRY_DB_NAME: registryName,
        JWT_SECRET: randomBytes(48).toString('hex'), SEED_DEMO_DATA: 'false', ESSTEE_TELEGRAM_BOT_TOKEN: '' },
    });
    await retry(async () => { const response = await fetch(origin + '/login'); if (!response.ok) throw Error('App not ready'); });
    for (const endpoint of ['machines', 'parts', 'repairs', 'users', 'ppm', 'requisitions', 'asset-logs', 'imports?kind=assets']) {
      assert.equal((await fetch(origin + '/api/' + endpoint)).status, 401, 'Signed-out ' + endpoint);
    }
    await db.collection('machines').insertOne({ id: 'MQR-HTTP', name: 'Phone booking asset', status: 'ACTIVE', cost: 50000 });
    const assetResponse = await fetch(origin + '/api/public/qr-tickets?company=esstee&id=MQR-HTTP');
    assert.equal(assetResponse.status, 200, 'A phone can resolve its scanned asset without signing in');
    const assetInfo = (await assetResponse.json()).asset;
    assert.equal(assetInfo.id, 'MQR-HTTP'); assert.equal(assetInfo.cost, undefined);
    const publicPayload = { company: 'esstee', machineId: 'MQR-HTTP', requestId: 'http-qr-request-000001', faultCategory: 'Mechanical fault', urgency: 'WARNING', faultDetails: 'Reported from phone' };
    async function phoneBooking() {
      const response = await fetch(origin + '/api/public/qr-tickets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(publicPayload), redirect: 'manual' });
      assert.equal(response.status, 200, 'Guest booking saves without a login redirect');
      assert.equal(response.headers.get('location'), null);
      return response.json();
    }
    const phoneTicket = await phoneBooking();
    assert.equal((await phoneBooking()).ticketId, phoneTicket.ticketId);
    assert.equal(await db.collection('repair_tickets').countDocuments({ id: phoneTicket.ticketId }), 1);
    assert.equal((await fetch(origin + '/api/public/qr-tickets', { method: 'POST', headers: { 'Content-Type': 'application/json', origin: 'https://another-site.test' }, body: JSON.stringify(publicPayload) })).status, 403);
    const donePage = await fetch(origin + '/scan/booked?ticket=' + phoneTicket.ticketId);
    assert.equal(donePage.status, 200); assert.match(await donePage.text(), /Ticket booked/);
    assert.equal((await fetch(origin + '/esstee/scan/MQR-HTTP', { redirect: 'manual' })).status, 200);
    assert.equal((await fetch(origin + '/api/repairs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 401, 'QR reporting never opens private repair APIs');
    async function login(email) {
      const response = await fetch(origin + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, companySlug: 'esstee' }) });
      assert.equal(response.status, 200, 'Test account signs in');
      return response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
    }
    const cookie = await login('admin@example.test');
    const headers = { cookie, 'x-company-slug': 'esstee' };
    assert.equal((await fetch(origin + '/api/machines?id=M%5B1', { headers })).status, 404, 'Literal special-character lookup is safe');
    assert.equal((await fetch(origin + '/api/imports?kind=assets&format=xlsx', { headers })).status, 200);
    const httpFile = new File(['partId,quantity\nP1,3\n'], 'inward.csv');
    async function importRequest(action) {
      const body = new FormData(); body.set('kind', 'spares'); body.set('action', action); body.set('file', httpFile); body.set('requestId', 'http-inward');
      const response = await fetch(origin + '/api/imports', { method: 'POST', headers, body });
      const result = await response.json();
      assert.equal(response.status, 200, result.error);
      return result;
    }
    assert.equal((await importRequest('preview')).errors.length, 0);
    await importRequest('commit');
    assert.equal((await importRequest('commit')).repeated, true);
    assert.equal((await db.collection('spare_parts').findOne({ partId: 'P1' })).stock, 7);
    const repairsResponse = await fetch(origin + '/api/repairs', { headers });
    const repair = (await repairsResponse.json()).data.find(row => row.id === 'R1');
    assert.equal(repair.repairCost, 250); assert.equal(repair.laborCost, undefined);
    const mechanicCookie = await login('mechanic@example.test');
    assert.equal((await fetch(origin + '/api/imports?kind=spares', { headers: { cookie: mechanicCookie } })).status, 403);
    assert.equal((await fetch(origin + '/api/parts', { method: 'PATCH', headers: { cookie: mechanicCookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ partId: 'P1', delta: 1 }) })).status, 403);
    assert.equal((await fetch(origin + '/api/machines', { method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ id: { $ne: '' }, updates: { status: 'ACTIVE' } }) })).status, 400);
    console.log('PASS: production HTTP authentication, permissions, literal asset lookup, Excel template, multipart CSV preview/commit/retry and spare-only repair responses.');
    console.log('PASS: phone QR lookup/booking without login, one ticket per retry, public confirmation page, same-origin protection and private API isolation.');
  }
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (app && app.exitCode === null) { const stopped = once(app, 'exit'); app.kill(); await stopped; }
  await Promise.allSettled([direct.close(), client.close()]);
  if (server.exitCode === null) {
    const exited = once(server, 'exit');
    server.kill();
    await exited;
  }
  // Delete only this script's verified, newly created temporary database directory.
  const resolved = path.resolve(directory);
  if (path.dirname(resolved) === path.resolve(os.tmpdir()) && path.basename(resolved).startsWith('esstee-repair-test-')) fs.rmSync(resolved, { recursive: true, force: true });
});
