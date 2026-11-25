'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const serverSource = fs.readFileSync(path.join(__dirname, '../server.js'), 'utf8');

// Extract one route handler's source: from its app.get(...) line up to the
// next app.get/app.post route definition.
function routeBlock(route) {
  const start = serverSource.indexOf(`app.get('${route}'`);
  assert.notEqual(start, -1, `route ${route} not found`);
  const rest = serverSource.slice(start + 1);
  const next = rest.search(/app\.(get|post)\('/);
  return next === -1 ? serverSource.slice(start) : serverSource.slice(start, start + 1 + next);
}

const READ_ROUTES = [
  '/api/user/profile',
  '/api/user/checks',
  '/api/user/role',
  '/api/admin/stats'
];

test('a server-only service-role read client exists and shares the payment client', () => {
  assert.match(serverSource, /function getServiceRoleSupabase\(\) \{\s*return getPaymentSupabase\(\);\s*\}/);
  assert.match(serverSource, /createClient\(process\.env\.SUPABASE_URL, process\.env\.SUPABASE_SERVICE_ROLE_KEY\)/);
});

for (const route of READ_ROUTES) {
  test(`${route} reads through the service-role client, never the anon client`, () => {
    const block = routeBlock(route);
    assert.match(block, /getServiceRoleSupabase\(\)/);
    assert.doesNotMatch(block, /await supabase\b/);
    assert.doesNotMatch(block, /supabase\.from\(/);
    assert.doesNotMatch(block, /supabase\.rpc\(/);
  });
}

test('read endpoints stay behind Telegram initData validation', () => {
  for (const route of READ_ROUTES) {
    assert.match(routeBlock(route), new RegExp(`app\\.get\\('${route}', validateTelegramData,`));
  }
});

test('profile does not mask database errors as 404', () => {
  const block = routeBlock('/api/user/profile');
  assert.match(block, /const \{ data: user, error \} = await getServiceRoleSupabase\(\)/);
  assert.match(block, /error\.code === 'PGRST116'/);
  assert.match(block, /Profile database error/);
  assert.match(block, /status\(500\)/);
});

test('role endpoint surfaces database errors instead of silently returning user', () => {
  const block = routeBlock('/api/user/role');
  assert.match(block, /Role database error/);
  assert.match(block, /status\(500\)/);
});

test('service-role key is never referenced in browser-served files', () => {
  const publicDir = path.join(__dirname, '../public');
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
  for (const file of walk(publicDir)) {
    const content = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(content, /SUPABASE_SERVICE_ROLE_KEY|service-role|serviceRole/i, file);
  }
});
