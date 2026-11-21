// The secrets scan and forbidden rules (1.15.0): what they find, what they no longer flag, accepting a known false alarm,
// and that their hits reach the summary verdict.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { looksSecret, runForbidden, runSecrets, secretsInLine } from '../scripts/scan/index.mjs';
import { AREAS } from '../scripts/areas.mjs';
import { collect } from '../scripts/summary/collect.mjs';
import { buildModel } from '../scripts/summary/model.mjs';
import { project } from './helpers.mjs';

const kit = join(import.meta.dirname, '..');
const SKIP_ALL = { skipAreas: Object.fromEntries(['structure', 'release', 'tests', 'agents', 'speed', 'links', 'widgets'].map((a) => [a, 'not part of this test'])) };
const check = (files, config = {}) => spawnSync('node', [join(kit, 'scripts/check.mjs')], { cwd: project({ ...files, 'review.config.json': { ...SKIP_ALL, ...config } }), encoding: 'utf8' });
const secretsArea = AREAS.find((a) => a.key === 'secrets');
const forbiddenArea = AREAS.find((a) => a.key === 'forbidden');

test('secrets: .env files of every name, shell scripts and unquoted values are read', () => {
  // The reviewer's repro: all three gave PASS secrets scan in 1.14.0.
  const r = check({ '.env': 'STRIPE_SECRET=sk_live_abcdefghijklmnop1234\n', '.env.local': 'DB_PASSWORD=hunter2hunter2\n', 'deploy.sh': 'export TOKEN=ghp_abcdefghijklmnopqrstuvwxyz0123456789\n' });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /FAIL {2}secrets scan \(3\)/);
  for (const where of ['.env:1', '.env.local:1', 'deploy.sh:1']) assert.match(r.stdout, new RegExp(`\\] ${where.replace(/[\\^$.*+?()[\]{}|]/g, '\\$&')}`));
  assert.doesNotMatch(r.stdout, /hunter2|sk_live_abc|ghp_abc/, 'the value is never printed');
});

test('secrets: keys, certificates, native and build settings are read', () => {
  const files = { 'AuthKey.p8': '-----BEGIN PRIVATE KEY-----\n', 'server.pem': '-----BEGIN RSA PRIVATE KEY-----\n', 'tls.key': '-----BEGIN EC PRIVATE KEY-----\n', 'ios/Info.plist': '<string>xoxb-1234567890-abcdefghij</string>\n', 'android/res/values/keys.xml': '<string name="k">AKIAABCDEFGHIJKLMNOP</string>\n', 'android/gradle.properties': 'storePassword=s3cretPass99\n' };
  const r = runSecrets({}, project(files));
  assert.deepEqual(r.findings.map((f) => f.where).sort(), ['AuthKey.p8:1', 'android/gradle.properties:1', 'android/res/values/keys.xml:1', 'ios/Info.plist:1', 'server.pem:1', 'tls.key:1']);
});

test('secrets: each provider format has a pattern, inside any name', () => {
  const cases = [
    ['const k = "sk_live_abcdefghijklmnop1234";', 'stripeKey'],
    ['const k = "rk_live_abcdefghijklmnop1234";', 'stripeKey'],
    ['const k = "ghp_abcdefghijklmnopqrstuvwxyz0123456789";', 'githubToken'],
    ['const k = "github_pat_11ABCDEFG0123456789_abcdefghijklmnop";', 'githubToken'],
    ['const k = "xoxb-1234567890-abcdefghij";', 'slackToken'],
    ['const k = "xoxp-1234567890-abcdefghij";', 'slackToken'],
    ['const k = "AKIAABCDEFGHIJKLMNOP";', 'awsKey'],
    ['{ "private_key": "x" }', 'serviceAccount'],
  ];
  for (const [text, want] of cases) assert.deepEqual(secretsInLine(text).map((h) => h.check), [want], text);
});

test('secrets: JSON keys and unquoted .env values match the assignment pattern; bare values only in .env-style files', () => {
  assert.deepEqual(secretsInLine('"password": "hunter2hunter2"'), [{ check: 'assignment', key: 'password' }]);
  assert.deepEqual(secretsInLine("{ 'apiKey': 'a1b2c3d4e5f6' }"), [{ check: 'assignment', key: 'apiKey' }]);
  assert.deepEqual(secretsInLine('DB_PASSWORD=hunter2hunter2', { bare: true }), [{ check: 'assignment', key: 'DB_PASSWORD' }]);
  assert.deepEqual(secretsInLine('password = someVariable9'), [], 'a bare value in code is a variable, not a secret');
});

test('secrets: error codes, labels, words, URLs and placeholders are not secrets', () => {
  // app-auth-kit src/supabase/errors.ts:10 and src/theme.ts:95: both flagged in 1.14.0.
  assert.deepEqual(secretsInLine("  weak_password: 'auth/weak-password',"), []);
  assert.deepEqual(secretsInLine("  password: 'Password',"), []);
  for (const v of ['.*[Pp]assword.*', 'auth/weak-password', 'Password', 'Passphrase', 'PASSWORD_RESET', 'FIREBASE_SERVICE_ACCOUNT', 'https://oauth2.googleapis.com/token', '${process.env.TOKEN}', '********', 'xxxxxxxxxx', 'short1']) assert.equal(looksSecret(v), false, v);
  assert.equal(looksSecret('password_reset', 'PASSWORD_RESET'), false, "the key's own name is not a secret");
  for (const v of ['hunter2hunter2', 'realpassword123', 'abcdefgh12345678', 'aB3/xY9+zQ1=', 'https://user:pa55@db.example.com']) assert.equal(looksSecret(v), true, v);
});

test('secrets: letters-only values still count unless they look like a code or label (1.14.0 caught these)', () => {
  assert.deepEqual(secretsInLine("password: 'supersecretpassword'"), [{ check: 'assignment', key: 'password' }]);
  assert.deepEqual(secretsInLine('DB_PASSWORD = "CorrectHorseBatteryStaple"'), [{ check: 'assignment', key: 'DB_PASSWORD' }]);
  assert.deepEqual(secretsInLine('secret = "abc-def-ghi-jkl"'), [{ check: 'assignment', key: 'secret' }]);
  for (const v of ['realpassword', 'correct.horse.battery']) assert.equal(looksSecret(v), true, v);
  assert.deepEqual(secretsInLine("password: 'password'"), []);
  // app-auth-kit AuthFields.tsx: a ternary between two strings is not a key and value.
  assert.deepEqual(secretsInLine("textContentType={signingUp ? 'newPassword' : 'password'}"), []);
  assert.deepEqual(secretsInLine("autoComplete={signingUp ? 'new-password' : 'current-password'}"), []);
});

test('secrets: skip takes paths from the project root as well as names', () => {
  const files = { 'src/theme.ts': "const secret = 'hunter2hunter2';", 'lib/theme.ts': "const secret = 'hunter2hunter2';", 'src/gen/a.ts': "const token = 'abc123def456';" };
  const where = (skip) => runSecrets({ secrets: { skip } }, project(files)).findings.map((f) => f.where).sort();
  assert.deepEqual(where(['src/theme.ts']), ['lib/theme.ts:1', 'src/gen/a.ts:1']);
  assert.deepEqual(where(['theme.ts']), ['src/gen/a.ts:1'], 'a bare name still skips that name everywhere');
  assert.deepEqual(where(['src/gen/']), ['lib/theme.ts:1', 'src/theme.ts:1']);
});

test('secrets: the review\'s own reports are never read: they quote the findings', () => {
  const r = runSecrets({}, project({ 'review-out/summary.md': '"password": "hunter2hunter2"', 'summary.html': "password: 'hunter2hunter2'", 'docs/summary.md': "password: 'hunter2hunter2'" }));
  assert.deepEqual(r.findings.map((f) => f.where), ['docs/summary.md:1']);
});

test('secrets: a block without paths, or without skip, uses the defaults instead of crashing', () => {
  // 1.14.0: {"secrets":{"skip":["x"]}} printed a TypeError stack.
  const r = check({ 'src/a.ts': 'export const a = 1;', 'dist/out.js': "const token = 'abc123def456';" }, { secrets: { skip: ['x'] } });
  assert.equal(r.status, 1, 'dist is read when the owner gives their own skip list');
  assert.doesNotMatch(r.stderr, /TypeError|at .*\.mjs/);
  const d = check({ 'src/a.ts': 'export const a = 1;', 'dist/out.js': "const token = 'abc123def456';", 'node_modules/x/a.js': "const token = 'abc123def456';" }, { secrets: {} });
  assert.equal(d.status, 0, 'the default skip list leaves out dist and node_modules');
  assert.match(d.stdout, /PASS {2}secrets scan/);
});

test('secrets and forbidden rows are accepted per file in review.accepted.json, and a stale entry is reported', () => {
  const files = {
    'src/errors.ts': "export const E = { badPassword: 'x1-bad-pass9' };",
    'src/cli.js': "console.log('Usage: tool <file>');",
    'src/app.js': "console.log('debug');",
    'review.accepted.json': [
      { area: 'secrets', check: 'assignment', file: 'src/errors.ts', contains: 'badPassword', reason: 'an error code, not a password', date: '2026-11-21' },
      { area: 'forbidden', check: 'console.log', file: 'src/cli.js', reason: 'the CLI prints its own messages', date: '2026-11-21' },
      { area: 'secrets', check: 'awsKey', file: 'src/gone.ts', reason: 'old', date: '2026-11-21' },
    ],
  };
  const config = { forbidden: [{ name: 'console.log', pattern: 'console\\.log\\(', paths: ['src'] }] };
  const root = project(files);
  const s = secretsArea.run(config, root);
  assert.equal(s.findings.length, 0);
  assert.equal(s.accepted.length, 1);
  assert.deepEqual(s.stale.map((e) => e.file), ['src/gone.ts']);
  const f = forbiddenArea.run(config, root);
  assert.deepEqual(f.findings.map((x) => x.where), ['src/app.js:1']);
  assert.deepEqual(f.accepted.map((x) => x.where), ['src/cli.js:1']);
  const r = check(files, config);
  assert.match(r.stdout, /FAIL {2}console\.log \(1\) \(1 accepted\)/);
  assert.match(r.stdout, /PASS {2}secrets scan \(1 accepted\)/);
  assert.match(r.stdout, /STALE {2}accepted entry matches nothing now: awsKey in src\/gone\.ts/);
});

test('an accepted entry for a forbidden rule that does not exist is a config problem', () => {
  const root = project({ 'src/a.js': '', 'review.accepted.json': [{ area: 'forbidden', check: 'console.lg', file: 'src/a.js', reason: 'r', date: 'd' }] });
  assert.throws(() => forbiddenArea.run({ forbidden: [{ name: 'console.log', pattern: 'x', paths: ['src'] }] }, root), /"console\.lg" is not a check in forbidden/);
});

test('forbidden: per-rule skip, code-only matching with comments: false, files, and a bad pattern is one clear line', () => {
  const files = { 'src/cli.js': "console.log('hi');", 'src/app.js': "// console.log('old');\nconsole.log('x'); // TODO later", 'src/README.md': 'console.log( in docs' };
  const root = project(files);
  const rows = (rule) => runForbidden({ forbidden: [{ name: 'r', paths: ['src'], ...rule }] }, root).findings.map((f) => f.where).sort();
  assert.deepEqual(rows({ pattern: 'console\\.log\\(' }), ['src/README.md:1', 'src/app.js:1', 'src/app.js:2', 'src/cli.js:1']);
  assert.deepEqual(rows({ pattern: 'console\\.log\\(', skip: ['src/cli.js'], comments: false, files: '\\.(js|ts)$' }), ['src/app.js:2']);
  assert.deepEqual(rows({ pattern: 'TODO' }), ['src/app.js:2'], 'comments are read by default: a TODO rule only ever matches in them');
  const bad = check({ 'src/a.js': '' }, { forbidden: [{ name: 'x', pattern: '((' }] });
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /Config problem: forbidden rule 1 \("x"\): "\(\(" is not a valid pattern/);
  assert.doesNotMatch(bad.stderr, /SyntaxError|at .*\.mjs/);
});

test('a secret hit makes the summary Not ready, even with no reviewer hand-off', () => {
  // The reviewer's repro: check.mjs failed on these two lines, while summary.mjs said Ready.
  const files = { 'lib/k.js': "export const k = { password: 'realpassword123' };\nexport const aws='AKIAABCDEFGHIJKLMNOP';\n", 'lib/a.js': 'export const a = 1;\n' };
  const config = { name: 'p', structure: { roots: ['lib'], gate: [] } };
  const m = buildModel(collect(config, project(files)), { results: [] });
  assert.equal(m.verdict, 'Not ready');
  assert.equal(m.counts.mustFix, 2);
  assert.deepEqual(m.rows.filter((r) => r.area === 'secrets').map((r) => r.where).sort(), ['lib/k.js:1', 'lib/k.js:2']);
  const cli = spawnSync('node', [join(kit, 'scripts/summary.mjs')], { cwd: project({ ...files, 'review.config.json': { ...config, skipAreas: SKIP_ALL.skipAreas } }), encoding: 'utf8' });
  assert.equal(cli.status, 1);
  assert.match(cli.stdout, /\*\*Not ready\*\*/);
  assert.doesNotMatch(cli.stdout, /realpassword123/);
});

test('a forbidden hit reaches the summary as a must-fix row naming the rule', () => {
  const config = { name: 'p', structure: { roots: ['src'], gate: [] }, forbidden: [{ name: 'debugger', pattern: '\\bdebugger\\b', paths: ['src'] }] };
  const m = buildModel(collect(config, project({ 'src/a.ts': 'debugger;\n' })), {});
  assert.equal(m.verdict, 'Not ready');
  const row = m.rows.find((r) => r.area === 'forbidden');
  assert.equal(row.technical, 'debugger: debugger;');
  assert.match(row.meaning, /banned/);
});
