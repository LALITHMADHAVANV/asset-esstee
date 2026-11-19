const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const assert = require('node:assert/strict');
const ts = require('typescript');
const { MongoClient } = require('mongodb');
const ExcelJS = require('exceljs');
function load(file, overrides = {}) {
  const exports = {};
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  new Function('exports', 'require', code)(exports, name => name in overrides ? overrides[name] : require(name));
  return exports;
}
const importer = load('src/lib/assetImport.ts');
const { readAssetImport, assetImportTemplate, reviewAssetImport, saveAssetImport } = importer;
const binary = process.env.MONGOD_BINARY || 'C:\\Program Files\\MongoDB\\Server\\9.0\\bin\\mongod.exe';
if (!fs.existsSync(binary)) throw Error('Set MONGOD_BINARY to run the isolated database tests.');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'esstee-asset-import-'));
const port = Number(process.env.TEST_MONGO_PORT || 27189);
const server = spawn(binary, ['--port', String(port), '--bind_ip', '127.0.0.1', '--dbpath', directory, '--logpath', path.join(directory, 'mongo.log'), '--quiet'], { windowsHide: true, stdio: 'ignore' });
const client = new MongoClient('mongodb://127.0.0.1:' + port, { serverSelectionTimeoutMS: 500 });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function ready() {
  for (let attempt = 0; attempt < 30; attempt++) { try { await client.connect(); return; } catch { await delay(200); } }
  throw Error('Isolated MongoDB did not start.');
}
const csv = 'id,brand,serialNo,type,purchaseDate,unit,cost,name\r\n00123,Juki,SERIAL-001,SNLS,18/11/2026,UNIT - 1,125.5,"Sewing, machine"\r\n';
function uploadFile(text) { return new File([text], 'assets.csv'); }
(async () => {
  for (const format of ['csv', 'xlsx']) {
    const template = await assetImportTemplate(format);
    const parsed = await readAssetImport(new File([template.content], 'template.' + format));
    assert.equal(parsed.rows.length, 1); assert.equal(parsed.errors.length, 0);
  }
  const parsed = await readAssetImport(uploadFile(csv));
  assert.equal(parsed.rows[0].asset.id, '00123', 'CSV leading zeros are preserved');
  assert.equal(parsed.rows[0].asset.name, 'Sewing, machine', 'Quoted commas are preserved');
  assert.equal(parsed.rows[0].asset.purchaseDate, '2026-11-18');
  assert.equal((await readAssetImport(uploadFile(csv.replace('125.5', '-1')))).errors.length, 1);
  assert.equal((await readAssetImport(uploadFile(csv.replace('18/11/2026', '30/02/2026')))).errors.length, 1);
  await assert.rejects(readAssetImport(uploadFile('id,id\nA,A')), /Duplicate column/);
  await assert.rejects(readAssetImport(uploadFile('id,brand\nA,Juki')), /Required column/);
  const duplicate = csv + csv.split('\r\n')[1] + '\r\n';
  assert.equal((await readAssetImport(uploadFile(duplicate))).errors.length, 1);
  const formulaBook = new ExcelJS.Workbook(), sheet = formulaBook.addWorksheet('Assets');
  sheet.addRow(['id', 'brand', 'serialNo', 'type', 'purchaseDate', 'unit']);
  sheet.addRow(['FORMULA', { formula: '1+1', result: 2 }, 'F-SERIAL', 'SNLS', '2026-11-18', 'UNIT - 1']);
  const formulas = await readAssetImport(new File([await formulaBook.xlsx.writeBuffer()], 'formula.xlsx'));
  assert.equal(formulas.total, 1); assert.equal(formulas.errors.length, 1);
  const blanks = await readAssetImport(uploadFile('id,brand,serialNo,type,purchaseDate,unit,model\r\nBLANK-1,UZU,,Inspection,2007-05-18,,\r\nBLANK-2,UZU,-,Inspection,2007-08-21,,-\r\n'));
  assert.equal(blanks.errors.length, 0);
  assert.equal(blanks.rows.length, 2);
  assert.equal(blanks.rows[1].asset.serialNo, '');
  assert.equal(blanks.rows[1].asset.model, '');
  assert.equal(blanks.rows[1].asset.unit, '');
  await ready();
  const collection = client.db('asset_import_test').collection('machines');
  await collection.insertOne({ id: 'EXISTING', name: 'Preserve me', serialNo: 'OLD-SERIAL' });
  await collection.insertOne({ id: 'UNKNOWN-SERIAL', serialNo: '' });
  assert.equal((await reviewAssetImport(collection, blanks)).errors.length, 0);
  assert.equal((await saveAssetImport(collection, blanks.rows, 'Esstee Test', 'test')).imported, 2);
  const existingRow = { row: 3, asset: { ...parsed.rows[0].asset, id: 'existing', name: 'Overwrite attempt', serialNo: 'OTHER-SERIAL', serialNumber: 'OTHER-SERIAL' } };
  const reviewed = await reviewAssetImport(collection, { ...parsed, total: 2, rows: [...parsed.rows, existingRow] });
  assert.equal(reviewed.rows[1].exists, true, 'Existing IDs match case-insensitively');
  const result = await saveAssetImport(collection, reviewed.rows, 'Esstee Test', 'test');
  assert.equal(result.imported, 1); assert.equal(result.skipped, 1); assert.equal(result.errors.length, 0);
  assert.equal((await collection.findOne({ id: 'EXISTING' })).name, 'Preserve me');
  assert.equal((await collection.findOne({ id: '00123' })).companySlug, 'test');
  const retry = await saveAssetImport(collection, reviewed.rows, 'Esstee Test', 'test');
  assert.equal(retry.imported, 0); assert.equal(retry.skipped, 2);
  const serialConflict = await reviewAssetImport(collection, { total: 1, errors: [], rows: [{ row: 2, asset: { ...parsed.rows[0].asset, id: 'DIFFERENT', serialNo: 'old-serial' } }] });
  assert.equal(serialConflict.errors.length, 1, 'Reused serial numbers are rejected');
  const row = id => ({ row: 2, asset: { ...parsed.rows[0].asset, id, serialNo: 'SERIAL-' + id, serialNumber: 'SERIAL-' + id } });
  const flaky = new Proxy(collection, { get(target, key) {
    if (key === 'updateOne') return (filter, ...args) => { if (filter.id === 'FAIL') throw Error('Simulated save failure'); return target.updateOne(filter, ...args); };
    const value = target[key]; return typeof value === 'function' ? value.bind(target) : value;
  } });
  const partial = await saveAssetImport(flaky, [row('GOOD'), row('FAIL'), row('AFTER')], 'Esstee Test', 'test');
  assert.equal(partial.imported, 1); assert.equal(partial.errors.length, 2);
  const recovered = await saveAssetImport(collection, [row('GOOD'), row('FAIL'), row('AFTER')], 'Esstee Test', 'test');
  assert.equal(recovered.imported, 2); assert.equal(recovered.skipped, 1);

  let role = null;
  class TenantError extends Error { constructor(message, statusCode) { super(message); this.statusCode = statusCode; } }
  const route = load('src/app/api/machines/import/route.ts', {
    '@/lib/auth': { extractSessionToken: () => role ? 'test' : null, verifySessionToken: token => token ? { uid: 'test' } : null },
    '@/lib/mongodb': { TenantError, getDatabase: async () => ({ sessionUser: role ? { role } : null, rawCollection: () => collection, companyName: 'Esstee Test', tenant: 'test' }) },
    '@/lib/assetImport': importer,
  });
  assert.equal((await route.GET(new Request('http://test/api/machines/import'))).status, 401);
  role = 'MECHANIC';
  assert.equal((await route.GET(new Request('http://test/api/machines/import'))).status, 403);
  role = 'ADMIN';
  assert.equal((await route.GET(new Request('http://test/api/machines/import?format=xlsx'))).status, 200);
  async function request(action, file) { const form = new FormData(); form.set('action', action); form.set('file', file); return route.POST(new Request('http://test/api/machines/import', { method: 'POST', body: form })); }
  const bad = await request('import', uploadFile(csv.replace('125.5', '-1')));
  assert.equal(bad.status, 400);
  const file = uploadFile(csv.replaceAll('00123', 'NEW-ASSET').replaceAll('SERIAL-001', 'NEW-SERIAL'));
  const preview = await request('preview', file);
  assert.equal(preview.status, 200); assert.equal((await preview.json()).rows.length, 1);
  const saved = await request('import', file);
  assert.equal(saved.status, 200); assert.equal((await saved.json()).imported, 1);
  const repeated = await request('import', file);
  assert.equal((await repeated.json()).skipped, 1);
  const { machines, importMachines } = require('./import-image-machines.cjs');
  assert.equal(machines.length, 14);
  assert.equal(machines.find(row => row.id === 'A-S90').serialNo, '0099403');
  await client.db('asset_import_registry_test').collection('companies').insertOne({ slug: 'image-test', name: 'Image Test', active: true, databaseName: 'asset_import_image_test' });
  const priorRegistry = process.env.REGISTRY_DB_NAME;
  process.env.REGISTRY_DB_NAME = 'asset_import_registry_test';
  try {
    const preview = await importMachines(client, 'image-test', true);
    assert.equal(preview.wouldImport, 14);
    const imageCollection = client.db('asset_import_image_test').collection('machines');
    assert.equal(await imageCollection.countDocuments(), 0);
    assert.equal((await importMachines(client, 'image-test')).imported, 14);
    assert.equal((await importMachines(client, 'image-test')).skipped, 14);
    const blank = await imageCollection.findOne({ id: 'A-S91' });
    assert.equal(blank.serialNo, '');
    assert.equal(blank.unit, '');
    assert.equal(blank.purchaseDate.slice(0, 4), '2007');
    assert.equal(blank.purchaseDateEstimated, true);
    await assert.rejects(importMachines(client, 'missing-company'), /Active company not found/);
  } finally {
    if (priorRegistry === undefined) delete process.env.REGISTRY_DB_NAME;
    else process.env.REGISTRY_DB_NAME = priorRegistry;
  }
  console.log('PASS: Excel/CSV templates, parsing, required fields, dates, formulas, duplicates, serial conflicts, standalone MongoDB, retries, partial failures, tenant metadata and endpoint permissions.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  await client.close();
  if (server.exitCode === null) { const stopped = once(server, 'exit'); server.kill(); await stopped; }
  const resolved = path.resolve(directory);
  if (path.dirname(resolved) === path.resolve(os.tmpdir()) && path.basename(resolved).startsWith('esstee-asset-import-')) fs.rmSync(resolved, { recursive: true, force: true });
});
