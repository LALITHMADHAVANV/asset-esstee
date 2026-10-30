// One-time audit helper: guard text methods on record fields, leaving local
// search strings and form state alone. TypeScript's parser preserves the source.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const p = path.join(dir, entry.name);
    return entry.isDirectory() ? files(p) : /\.tsx?$/.test(p) ? [p] : [];
  });
}
const targets = [...files('src/app'), ...files('src/components'), 'src/lib/services/cmmsService.ts'];
let total = 0;
for (const file of targets) {
  // Server validation and auth have their own stricter rules.
  if (file.replaceAll('\\', '/').includes('/api/')) continue;
  let source = fs.readFileSync(file, 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const edits = [];
  function hasRecordFieldWithoutCalls(node) {
    let hasField = false;
    let hasCall = false;
    function inspect(part) {
      if (ts.isPropertyAccessExpression(part) || ts.isElementAccessExpression(part)) hasField = true;
      if (ts.isCallExpression(part)) hasCall = true;
      ts.forEachChild(part, inspect);
    }
    inspect(node);
    return hasField && !hasCall;
  }
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const method = node.expression;
      const value = method.expression;
      if (['trim', 'toLowerCase', 'toUpperCase'].includes(method.name.text) &&
          (ts.isPropertyAccessExpression(value) || ts.isElementAccessExpression(value) ||
           (ts.isParenthesizedExpression(value) && hasRecordFieldWithoutCalls(value)))) {
        // Method chains are already strings; guard only stored field values.
        if (!ts.isCallExpression(value.expression)) {
          edits.push({ start: value.getStart(ast), end: value.end, text: `textValue(${value.getText(ast)})` });
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  if (!edits.length) continue;
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    source = source.slice(0, edit.start) + edit.text + source.slice(edit.end);
  }
  const importText = "import { textValue } from '@/lib/textValue';\n";
  const directive = source.match(/^(['"])use client\1;?\r?\n/);
  if (!source.includes("import { textValue } from '@/lib/textValue'")) {
    source = directive ? source.slice(0, directive[0].length) + '\n' + importText + source.slice(directive[0].length) : importText + source;
  }
  fs.writeFileSync(file, source);
  console.log(`${file}: ${edits.length} guarded fields`);
  total += edits.length;
}
console.log(`Total: ${total}`);
