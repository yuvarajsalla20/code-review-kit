// 1.16.0: the integrity area (cached first answers, upload retries, Storage rule paths, decimal commas).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runIntegrity } from '../scripts/integrity/index.mjs';
import { STARTERS } from '../scripts/lib/starter.mjs';
import { project } from './helpers.mjs';

const kit = join(dirname(fileURLToPath(import.meta.url)), '..');
const rows = (files, check, integrity = {}) => runIntegrity({ integrity }, project(files)).findings.filter((f) => f.check === check).map((f) => f.where);

test('cachedSnapshot: a listener is a row unless the project reads fromCache, keeps a disk cache or uses the native SDK', () => {
  const listen = "export const watch = (q, cb) => onSnapshot(q, (snap) => cb(snap.docs));";
  assert.deepEqual(rows({ 'src/a.ts': listen, 'src/b.ts': `${listen}\n${listen}` }, 'cachedSnapshot'), ['src/a.ts:1', 'src/b.ts:1'], 'one row per file');
  assert.deepEqual(rows({ 'src/a.ts': listen, 'src/b.ts': 'if (snap.metadata.fromCache) return;' }, 'cachedSnapshot'), []);
  assert.deepEqual(rows({ 'src/a.ts': listen, 'src/db.ts': 'initializeFirestore(app, { localCache: persistentLocalCache() });' }, 'cachedSnapshot'), []);
  assert.deepEqual(rows({ 'src/a.ts': `import firestore from '@react-native-firebase/firestore';\n${listen}` }, 'cachedSnapshot'), []);
  assert.deepEqual(rows({ 'src/a.ts': `// onSnapshot(q, cb) in a comment\nexport const a = 1;` }, 'cachedSnapshot'), [], 'comments do not count');
});

test('uploadRetry: an upload is a row until the project sets a shorter retry limit', () => {
  const up = "await uploadBytes(ref(st, path), blob);";
  assert.deepEqual(rows({ 'src/up.ts': up }, 'uploadRetry'), ['src/up.ts:1']);
  assert.deepEqual(rows({ 'src/up.ts': "task.putFile(uri);" }, 'uploadRetry'), ['src/up.ts:1']);
  assert.deepEqual(rows({ 'src/up.ts': up, 'src/fb.ts': 'storage.maxUploadRetryTime = 20000;' }, 'uploadRetry'), []);
});

test('storagePaths: a recursive wildcard that allows write or create is a row; read-only or exact paths are not', () => {
  const rules = (body) => `rules_version = '2';\nservice firebase.storage {\n  match /b/{bucket}/o {\n${body}\n  }\n}`;
  const open = rules('    match /users/{uid}/{allPaths=**} {\n      allow read, write: if request.auth.uid == uid;\n    }');
  assert.deepEqual(rows({ 'storage.rules': open, 'src/a.ts': '' }, 'storagePaths'), ['storage.rules:4']);
  const readOnly = rules('    match /public/{p=**} {\n      allow read: if true;\n    }');
  assert.deepEqual(rows({ 'storage.rules': readOnly, 'src/a.ts': '' }, 'storagePaths'), []);
  const denyRest = rules('    match /{allPaths=**} {\n      allow read, write: if false;\n    }');
  assert.deepEqual(rows({ 'storage.rules': denyRest, 'src/a.ts': '' }, 'storagePaths'), [], 'deny everything else is not open');
  const bare = rules('    match /tmp/{p=**} {\n      allow write;\n    }');
  assert.deepEqual(rows({ 'storage.rules': bare, 'src/a.ts': '' }, 'storagePaths'), ['storage.rules:4'], 'an allow with no condition is open');
  const exact = rules('    match /users/{uid}/items/{itemId}/{file} {\n      allow create: if request.auth.uid == uid;\n    }');
  assert.deepEqual(rows({ 'storage.rules': exact, 'src/a.ts': '' }, 'storagePaths'), []);
  assert.deepEqual(rows({ 'rules/st.rules': open, 'src/a.ts': '' }, 'storagePaths', { storageRules: 'rules/st.rules' }), ['rules/st.rules:4'], 'the path comes from the config');
  assert.deepEqual(rows({ 'src/a.ts': '' }, 'storagePaths'), [], 'no rules file, no row');
});

test('decimalComma: stripping every comma before Number or parseFloat is a row; other replaces are not', () => {
  const parse = "export function parse(t: string) {\n  const clean = t.replace(/[,\\s₹$]/g, '');\n  return Number(clean);\n}";
  assert.deepEqual(rows({ 'src/money.ts': parse }, 'decimalComma'), ['src/money.ts:2']);
  assert.deepEqual(rows({ 'src/money.ts': "const n = parseFloat(t.replace(/,/g, ''));" }, 'decimalComma'), ['src/money.ts:1']);
  assert.deepEqual(rows({ 'src/money.ts': "const n = parseFloat(t.replace(',', '.'));" }, 'decimalComma'), [], 'one comma made a point is the fix, not the bug');
  assert.deepEqual(rows({ 'src/name.ts': "const slug = t.replace(/[,\\s]/g, '');" }, 'decimalComma'), [], 'no number is read');
});

test('integrity: the starter block, the CLI report and the check.mjs section', () => {
  const root = project({ 'src/a.ts': "onSnapshot(q, cb);\nuploadBytes(r, b);", 'storage.rules': 'match /u/{p=**} { allow write: if true; }' });
  assert.deepEqual(STARTERS.integrity(root), { roots: ['src'], ignore: ['tests'], storageRules: 'storage.rules', gate: [] });
  const r = spawnSync('node', [join(kit, 'scripts/integrity.mjs'), '--report', 'out.md'], { cwd: root, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const c = spawnSync('node', [join(kit, 'scripts/check.mjs')], { cwd: project({ 'src/a.ts': 'onSnapshot(q, cb);', 'review.config.json': { integrity: {}, skipAreas: Object.fromEntries(['structure', 'release', 'tests', 'speed', 'links'].map((a) => [a, 'not part of this test'])) } }), encoding: 'utf8' });
  assert.match(c.stdout, /== Data integrity ==[\s\S]*REVIEW {2}cachedSnapshot \(1\)/);
  assert.equal(c.status, 0, 'nothing gates by default');
  const gated = spawnSync('node', [join(kit, 'scripts/check.mjs')], { cwd: project({ 'src/a.ts': 'onSnapshot(q, cb);', 'review.config.json': { integrity: { gate: ['cachedSnapshot'] }, skipAreas: Object.fromEntries(['structure', 'release', 'tests', 'speed', 'links'].map((a) => [a, 'x'])) } }), encoding: 'utf8' });
  assert.equal(gated.status, 1, 'a gated check fails the run');
});

test('check.mjs notes an empty commands list and names the package.json scripts that could fill it', () => {
  const skip = { skipAreas: Object.fromEntries(['structure', 'release', 'tests', 'speed', 'links', 'integrity'].map((a) => [a, 'not part of this test'])) };
  const r = spawnSync('node', [join(kit, 'scripts/check.mjs')], { cwd: project({ 'src/a.ts': '', 'package.json': { scripts: { test: 'vitest run', typecheck: 'tsc', start: 'expo start' } }, 'review.config.json': { ...skip, commands: [] } }), encoding: 'utf8' });
  assert.match(r.stdout, /NOTE {2}No commands are set .* package\.json has: npm run test, npm run typecheck\./);
  assert.equal(r.status, 0, 'a note, not a failure');
  const set = spawnSync('node', [join(kit, 'scripts/check.mjs')], { cwd: project({ 'src/a.ts': '', 'review.config.json': { ...skip, commands: [{ name: 'ok', run: 'node -e 0' }] } }), encoding: 'utf8' });
  assert.doesNotMatch(set.stdout, /No commands are set/);
});
