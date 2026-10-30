// Compare feature coverage with the separate ASSET checkout without copying data.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const ts = require('typescript');
const reference = process.argv[2] || 'D:/Maintenance-Module';
function files(dir, prefix = '') {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const rel = path.join(prefix, entry.name);
    return entry.isDirectory() ? files(path.join(dir, entry.name), rel) : /\.tsx?$/.test(rel) ? [rel] : [];
  });
}
function inspect(root, file) {
  const source = fs.readFileSync(path.join(root, 'src', file), 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const imports = new Set();
  const rendered = new Set();
  const exported = new Set();
  const declarations = new Map();
  function visit(node) {
    if (ts.isImportDeclaration(node) && /^(\.|@\/)/.test(node.moduleSpecifier.text)) {
      if (node.importClause?.name) imports.add(node.importClause.name.text);
      const bindings = node.importClause?.namedBindings;
      if (bindings && ts.isNamedImports(bindings)) bindings.elements.forEach(element => imports.add(element.name.text));
    }
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) rendered.add(node.tagName.getText(ast));
    if (node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword) && node.name) exported.add(node.name.getText(ast));
    if (ts.isVariableStatement(node)) node.declarationList.declarations.forEach(declaration => {
      declarations.set(declaration.name.getText(ast), node.getText(ast));
    });
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return { source, exported, declarations, components: [...rendered].filter(tag => imports.has(tag)) };
}
let checked = 0;
for (const file of files(path.join(reference, 'src'))) {
  if (file.startsWith(`data${path.sep}`)) continue;
  assert.ok(fs.existsSync(path.join('src', file)), `Missing module: ${file}`);
  const original = inspect(reference, file);
  const local = inspect('.', file);
  for (const name of original.exported) assert.ok(local.exported.has(name), `${file}: missing export ${name}`);
  for (const component of original.components) assert.ok(local.components.includes(component), `${file}: missing UI component ${component}`);
  if (file.endsWith(`${path.sep}route.ts`)) {
    for (const verb of ['GET', 'POST', 'PATCH', 'PUT', 'DELETE']) {
      if (original.exported.has(verb)) assert.ok(local.exported.has(verb), `${file}: missing ${verb} handler`);
    }
  }
  if (file.endsWith(`${path.sep}Sidebar.tsx`) || file.endsWith(`${path.sep}Navbar.tsx`)) {
    const variable = file.endsWith('Sidebar.tsx') ? 'navSections' : 'navTabs';
    const normalize = text => text.replace(/sahana/g, 'esstee').replace(/\r\n/g, '\n');
    assert.equal(normalize(local.declarations.get(variable)), normalize(original.declarations.get(variable)), `${file}: navigation differs`);
  }
  checked++;
}
const ledger = fs.readFileSync('src/app/dashboard/asset-log/page.tsx', 'utf8');
assert.ok(ledger.includes('toggleMachineActiveIdle') && ledger.includes('addExtraMachineToZone'));
assert.ok(!ledger.includes("redirect('/dashboard')"));
const identity = fs.readFileSync('src/lib/companyIdentity.ts', 'utf8');
assert.ok(!identity.includes("? 'sahana'"), 'Esstee must retain its own company identity');
console.log(`PASS: ${checked} source modules checked for routes, exports, feature components and matching navigation. Esstee identity retained.`);
