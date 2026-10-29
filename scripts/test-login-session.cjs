const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const compiled = ts.transpileModule(fs.readFileSync('src/context/AuthContext.tsx', 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
function harness(fetcher, path = '/login') {
    const values = [], effects = [], storage = new Map([['cmms_current_user', '{"companySlug":"esstee","role":"ADMIN"}']]);
    const react = { createContext: () => ({ Provider: 'provider' }), useState: v => { const i = values.length; values.push(v); return [v, x => values[i] = x]; }, useEffect: f => effects.push(f), useRef: v => ({ current: v }), createElement: (_type, props) => props };
    const module = { exports: {} };
    vm.runInNewContext(compiled, { module, exports: module.exports, require: n => { if (n === 'react') return { ...react, default: react }; throw Error(n); }, fetch: fetcher, console, Event: class { }, window: { location: { pathname: path }, dispatchEvent: () => { } }, localStorage: { getItem: k => storage.get(k), setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) } });
    const provider = module.exports.AuthProvider({ children: null });
    return { values, effects, storage, auth: provider.value };
}
const flush = () => new Promise(resolve => setImmediate(resolve));
(async () => {
    const expired = harness(async () => ({ ok: false })); expired.effects[0](); await flush(); assert.equal(expired.values[0], null); assert.equal(expired.storage.has('cmms_current_user'), false);
    const offline = harness(async () => { throw Error('offline'); }); offline.effects[0](); await flush(); assert.equal(offline.values[0], null); assert.equal(offline.values[1], false);
    for (const slug of ['esstee', 'partner']) {
        let payload; const h = harness(async (_url, options) => { payload = JSON.parse(options.body); return { ok: true, json: async () => ({ success: true, user: { companySlug: slug, role: 'ADMIN' } }) }; });
        await h.auth.loginWithEmail('EMP-01', 'test-password', slug); assert.equal(payload.companySlug, slug); assert.equal(h.values[0].companySlug, slug);
    }
    const automatic = harness(async (_url, options) => { assert.equal(JSON.parse(options.body).companySlug, ''); return { ok: true, json: async () => ({ success: true, user: { companySlug: 'partner' } }) }; }); assert.equal((await automatic.auth.loginWithEmail('unique-user', 'test-password')).companySlug, 'partner');
    const mismatch = harness(async () => ({ ok: true, json: async () => ({ success: true, user: { companySlug: 'esstee' } }) })); await assert.rejects(mismatch.auth.loginWithEmail('EMP-01', 'test-password', 'partner'), /does not match/);
    let resolveRestore; const race = harness((url) => url.endsWith('/me') ? new Promise(r => resolveRestore = r) : Promise.resolve({ ok: true, json: async () => ({ success: true, user: { companySlug: 'partner' } }) })); race.effects[0](); await race.auth.loginWithEmail('EMP-01', 'test-password', 'partner'); resolveRestore({ ok: true, json: async () => ({ authenticated: true, user: { companySlug: 'esstee' } }) }); await flush(); assert.equal(race.values[0].companySlug, 'partner');
    console.log('PASS: expired session, offline session, both company logins, automatic workspace, mismatched response, stale session race.');
})().catch(e => { console.error(e); process.exitCode = 1; });
