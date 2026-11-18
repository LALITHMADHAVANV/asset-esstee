const fs = require('node:fs');
const ts = require('typescript');
const assert = require('node:assert/strict');
const { MongoClient } = require('mongodb');
const exportsObject = {};
new Function('exports', ts.transpileModule(fs.readFileSync('src/lib/mongoUri.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText)(exportsObject);
const { normalizeMongoUri } = exportsObject;
const broken = 'mongodb+srv://example:p%40ss@cluster.example.com/?retryWrites=true&w=majority&Asset-esstee';
assert.throws(() => new MongoClient(broken), /cannot be specified with no value/);
const fixed = normalizeMongoUri(broken);
assert.equal(fixed, 'mongodb+srv://example:p%40ss@cluster.example.com/?retryWrites=true&w=majority&appName=Asset-esstee');
assert.equal(new MongoClient(fixed).options.appName, 'Asset-esstee');
const valid = 'mongodb://127.0.0.1:27017/?replicaSet=rs0&tls=true&authSource=admin&appName=Existing';
assert.equal(normalizeMongoUri(valid), valid);
assert.equal(normalizeMongoUri(valid + '&Asset-esstee'), valid, 'An existing appName is preserved');
assert.equal(normalizeMongoUri(broken + '&Asset-esstee'), fixed, 'Repeated pasted labels do not produce duplicate options');
assert.equal(normalizeMongoUri('  mongodb://localhost:27017/  '), 'mongodb://localhost:27017/');
assert.equal(normalizeMongoUri(valid + '&tls'), valid + '&tls', 'Security options are never silently changed');
assert.throws(() => new MongoClient(normalizeMongoUri(valid + '&tls')), /URI option "tls"/);
console.log('PASS: reproduced deployed URI error, repaired app label, preserved credentials and security options, valid URIs and duplicate-label handling.');
