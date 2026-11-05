const fs = require('node:fs');
const assert = require('node:assert/strict');
const ts = require('typescript');
const exportsObject = {};
new Function('exports', ts.transpile(fs.readFileSync('src/lib/textValue.ts', 'utf8'), { module: ts.ModuleKind.CommonJS }))(exportsObject);
const { textValue } = exportsObject;
for (const value of [undefined, null, {}, [], NaN, Infinity, true]) {
  assert.equal(textValue(value), '');
  assert.doesNotThrow(() => textValue(value).trim().toLowerCase());
}
assert.equal(textValue(1234), '1234');
assert.equal(textValue(' MC-01 '), ' MC-01 ');

// Exercise the actual lookup callback from the active-work page with incomplete
// imported records. The intended asset must still be selected after a bad row.
const page = fs.readFileSync('src/app/dashboard/active-tna/page.tsx', 'utf8');
const match = page.match(/machines\.find\((\(m\) => [^;]+)\);/);
assert.ok(match, 'Active-work machine lookup exists');
const lookup = new Function('textValue', 'r', `return ${match[1]};`)(textValue, { machineId: 'mc-01' });
const machines = [{}, { id: null }, { id: 12 }, { id: 'MC-01' }];
assert.equal(machines.find(lookup), machines[3]);

// Exercise the actual history search predicate, including numeric serial fields.
const source = fs.readFileSync('src/components/history/BulkQrPrintModal.tsx', 'utf8');
const serialExpression = source.match(/const serialMatch = ([^;]+);/)[1];
const search = new Function('textValue', 'a', 'q', `return ${serialExpression};`);
assert.equal(Boolean(search(textValue, {}, '123')), false);
assert.equal(search(textValue, { serialNo: 1234 }, '123'), true);
assert.equal(search(textValue, { serialNumber: 'SN-1234' }, '123'), true);
console.log('PASS: malformed imported text, active-work lookup and QR serial search');
