// Run against the production preview; sends no authenticated writes.
const assert = require('node:assert/strict');
const origin = process.env.TEST_ORIGIN || 'http://localhost:3100';
(async () => {
  for (const path of ['/api/machines', '/api/repairs', '/api/users', '/api/parts', '/api/ppm', '/api/requisitions', '/api/asset-logs', '/api/auth/me', '/api/telegram']) {
    const response = await fetch(origin + path, { signal: AbortSignal.timeout(10000) });
    assert.equal(response.status, 401, path);
    console.log('PASS signed-out access blocked: ' + path);
  }
  for (const path of ['/login', '/esstee/dashboard', '/esstee/scan/test']) {
    const response = await fetch(origin + path, { signal: AbortSignal.timeout(10000) });
    assert.equal(response.status, 200, path);
    console.log('PASS page served: ' + path);
  }
  for (const path of ['/api/users', '/api/auth/set-password', '/api/telegram']) {
    const response = await fetch(origin + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(10000) });
    assert.equal(response.status, 401, path);
    console.log('PASS signed-out write blocked: ' + path);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
