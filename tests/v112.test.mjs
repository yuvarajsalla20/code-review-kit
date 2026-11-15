// 1.12.0: Incomplete runs, links, widgets, release guards, kit pins, the richer summary, decisions, end-to-end starters and the load plan.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { runLinks } from '../scripts/links/index.mjs';
import { runWidgets, usesWidgets } from '../scripts/widgets/index.mjs';
import { runRelease } from '../scripts/release/index.mjs';
import { buildModel, mergeExtras, stableKey } from '../scripts/summary/model.mjs';
import { toMarkdown } from '../scripts/summary/markdown.mjs';
import { toHtml } from '../scripts/summary/html.mjs';
import { decide, readMarks } from '../scripts/summary/decide.mjs';
import { brokenLinks, maestroFlows, testIdCoverage } from '../scripts/e2e/index.mjs';
import { loadPlan, readRun } from '../scripts/load/plan.mjs';
import { coverage } from '../scripts/areas.mjs';
import { project } from './helpers.mjs';

const kit = join(import.meta.dirname, '..', 'scripts');
const node = (script, cwd, ...args) => spawnSync('node', [join(kit, script), ...args], { cwd, encoding: 'utf8' });
const rows = (result, check) => result.findings.filter((f) => f.check === check);

test('links: a decode outside try is a row, inside try or with .catch it is not', () => {
  const root = project({
    'src/a.ts': "export const a = (s: string) => decodeURIComponent(s);\nexport const b = (s: string) => { try { return JSON.parse(s); } catch { return null; } };\nexport const c = (s: string) => fetch(s).then((r) => JSON.parse(r)).catch(() => null);",
  });
  const found = rows(runLinks({}, root), 'unguarded');
  assert.deepEqual(found.map((f) => f.where), ['src/a.ts:1']);
  assert.match(found[0].what, /decodeURIComponent/);
});

test('links: a link handler with no unsaved-input guard is a row; one that mentions discard is not', () => {
  const bare = project({ 'src/links.ts': "Linking.addEventListener('url', ({ url }) => setRoute(url));" });
  assert.equal(rows(runLinks({}, bare), 'handlers').length, 1);
  const guarded = project({ 'src/links.ts': "Linking.addEventListener('url', ({ url }) => (hasChanges ? ask(url) : setRoute(url)));" });
  assert.equal(rows(runLinks({}, guarded), 'handlers').length, 0);
});

test('widgets: the area applies only with a widget package; personal text without privacySensitive is a row', () => {
  assert.equal(usesWidgets(project({ 'package.json': { dependencies: { react: '1' } } })), false);
  const files = (draw) => project({ 'package.json': { dependencies: { 'expo-widgets': '1' } }, 'src/w/Live.tsx': draw });
  const open = files("export const Live = () => { 'widget'; return <Text>{props.name}</Text>; };");
  assert.equal(usesWidgets(open), true);
  assert.equal(rows(runWidgets({}, open), 'lockscreen').length, 1);
  assert.equal(rows(runWidgets({}, files("export const Live = () => { 'widget'; return <Text modifiers={[privacySensitive()]}>{props.name}</Text>; };")), 'lockscreen').length, 0);
});

test('widgets: a timeline with a fixed entry cap is a row that names the cap', () => {
  const root = project({ 'package.json': { dependencies: { 'expo-widgets': '1' } }, 'src/w/timeline.ts': 'const MAX_ENTRIES = 16;\nexport const nextUpTimeline = (now: Date) => [{ date: now }];' });
  const found = rows(runWidgets({}, root), 'timeline');
  assert.equal(found.length, 1);
  assert.match(found[0].what, /at most 16 entries/);
  assert.equal(found[0].where, 'src/w/timeline.ts:1');
});

const app = (expo) => ({ expo: { name: 'X', version: '1.0.0', icon: './i.png', ios: { bundleIdentifier: 'com.x.y', buildNumber: '1' }, ...expo } });

test('release permissionUse: a narrow promise with two call sites is a row; a broad text is not', () => {
  const files = (text) => project({
    'package.json': { dependencies: { 'expo-location': '1' } },
    'app.json': app({ plugins: [['expo-location', { locationWhenInUsePermission: text }]] }),
    'src/places.ts': 'await Location.getLastKnownPositionAsync();\nawait Location.getCurrentPositionAsync();',
  });
  const narrow = rows(runRelease({ release: {} }, files('Used only when you tap Current.')), 'permissionUse');
  assert.equal(narrow.length, 1);
  assert.match(narrow[0].what, /2 places: getLastKnownPositionAsync at src\/places.ts:1, getCurrentPositionAsync at src\/places.ts:2/);
  assert.equal(narrow[0].gate, false);
  assert.equal(rows(runRelease({ release: {} }, files('Used to fill in an address and to show nearby suggestions.')), 'permissionUse').length, 0);
});

test('release kits: git+https and github: pins are read; kitTests flags a kit tested on an older React', () => {
  const sha = 'a'.repeat(40);
  const root = project({
    'package.json': { dependencies: { react: '19.3.0', 'kit-a': `git+https://github.com/me/kit-a.git#${sha}`, 'kit-b': `github:me/kit-b#${sha}` }, kitVersions: { 'kit-a': 'v1.0.0' } },
    'node_modules/kit-a/package.json': { name: 'kit-a', devDependencies: { react: '^18.3.1' } },
    'node_modules/kit-b/package.json': { name: 'kit-b', devDependencies: { react: '19.3.0' } },
  });
  const r = runRelease({ release: {} }, root);
  assert.deepEqual(rows(r, 'kits').map((f) => f.what), [`kit-b is pinned to commit aaaaaaa but \`kitVersions\` does not say which version that is`]);
  const old = rows(r, 'kitTests');
  assert.equal(old.length, 1);
  assert.match(old[0].what, /kit-a runs its tests on react \^18\.3\.1, but the app ships react 19\.3\.0/);
});

test('release storeKeys: a wrong value fails, a missing value needs a build guard, a guard satisfies it', () => {
  const cfg = { release: { keyPrefixes: { RC_KEY: 'appl_' } } };
  const wrong = project({ 'eas.json': { build: { production: { env: { RC_KEY: 'test_abc' } } } } });
  const bad = rows(runRelease(cfg, wrong), 'storeKeys');
  assert.equal(bad.length, 1);
  assert.equal(bad[0].gate, true);
  assert.match(bad[0].what, /needs it to start with "appl_"/);
  assert.match(rows(runRelease(cfg, project({ 'eas.json': { build: {} } })), 'storeKeys')[0].what, /no build step checks/);
  const guarded = project({ 'eas.json': { build: {} }, 'app.config.js': "if (!process.env.RC_KEY?.startsWith('appl_')) throw new Error('x');" });
  assert.equal(rows(runRelease(cfg, guarded), 'storeKeys').length, 0);
  assert.equal(rows(runRelease({ release: {} }, wrong), 'storeKeys').length, 0, 'no keyPrefixes, nothing to check');
});

test('coverage: an area with a reason is skipped on purpose, one without is not run', () => {
  const root = project({ 'src/a.ts': '' });
  const c = coverage({ structure: {}, skipAreas: { release: 'no store build', tests: '' } }, root);
  assert.deepEqual(c.skipped.map((a) => a.key), ['release']);
  assert.ok(c.notRun.some((a) => a.key === 'tests'));
});

const script = (findings) => [{ area: 'release', result: { findings: findings.map((f) => ({ check: 'permissions', gate: false, places: [], effort: 'small', fix: 'f', ...f })) } }];

test('summary: Incomplete beats Ready and Ready after fixes, but not Not ready', () => {
  assert.equal(buildModel(script([]), {}, { notRun: ['links'] }).verdict, 'Incomplete');
  assert.match(buildModel(script([]), {}, { notRun: ['links'] }).verdictMeaning, /links/);
  assert.equal(buildModel(script([{ where: 'a', what: 'x', gate: true }]), {}, { notRun: ['links'] }).verdict, 'Not ready');
  assert.equal(buildModel(script([]), {}, {}).verdict, 'Ready');
  const failed = buildModel(script([]), { results: [{ name: 'load', result: 'fail' }] });
  assert.equal(failed.verdict, 'Not ready', 'a failed test run is never Ready');
  assert.match(failed.verdictMeaning, /1 test run failed/);
});

test('summary: rows carry their proof, results are shown, and the markdown and page have both', () => {
  const extra = { add: [{ area: 'logic', severity: 'High', where: 'src/a.ts:3', what: 'x', meaning: 'Repeats missing', impact: 'i', fix: 'f', proof: 'device' }], results: [{ name: 'unit', result: 'pass', detail: '271 passed' }, { name: 'load', result: 'fail' }] };
  const m = buildModel(script([{ where: 'app.json', what: 'y' }]), extra);
  assert.deepEqual(m.rows.map((r) => r.proof), ['device', 'script']);
  const md = toMarkdown(m);
  assert.match(md, /## Test results/);
  assert.match(md, /\| unit \| Pass \| 271 passed \|/);
  assert.match(md, /\| load \| Fail \|/);
  assert.match(md, /Needs a device to confirm/);
  assert.match(toHtml(m), /Script match, not yet opened/);
  assert.equal(buildModel(script([]), { add: [{ area: 'x', where: 'w', severity: 'Low', proof: 'bogus' }] }).rows[0].proof, 'code', 'an unknown proof is treated as read in the code');
});

test('summary: --previous marks rows New or Still open (line numbers ignored) and lists what was fixed', () => {
  const before = buildModel(script([{ where: 'src/a.ts:10', what: 'old' }, { where: 'src/gone.ts:1', what: 'gone' }]));
  const now = buildModel(script([{ where: 'src/a.ts:14', what: 'old' }, { where: 'src/new.ts:2', what: 'new' }]), {}, { previous: JSON.parse(JSON.stringify(before)) });
  assert.deepEqual(Object.fromEntries(now.rows.map((r) => [r.where, r.status])), { 'src/a.ts:14': 'Still open', 'src/new.ts:2': 'New' });
  assert.deepEqual(now.fixed.map((f) => f.where), ['src/gone.ts:1']);
  assert.match(toMarkdown(now), /## Fixed since last run/);
  assert.match(toMarkdown(now), /Since last run/);
  assert.equal(stableKey('a:b|src/x.ts:12-30'), 'a:b|src/x.ts');
});

test('mergeExtras joins lists from several reviewers and keeps the first verifiedBy', () => {
  const m = mergeExtras([{ verifiedBy: 'agents', add: [1], drop: ['a'], override: { k: { severity: 'Low' } } }, { verifiedBy: 'inline', add: [2], results: [3], override: { j: {} } }]);
  assert.deepEqual(m, { verifiedBy: 'agents', add: [1, 2], drop: ['a'], override: { k: { severity: 'Low' }, j: {} }, results: [3] });
});

test('decide: reads the marks by header, needs a reason to accept, and keeps agent rows out of the file', () => {
  const model = buildModel(script([{ where: 'app.json', what: 'reason text missing' }]), { add: [{ area: 'logic', severity: 'High', where: 'src/a.ts:3', what: 'x' }] });
  const md = toMarkdown(model).replace(/^\| 1 \| High \|(.*)\|\s+\|$/m, '| 1 | High |$1| accept: known, fixing in 1.1 |').replace(/^\| 2 \| Medium \|(.*)\|\s+\|$/m, '| 2 | Medium |$1| accept: only wiring |');
  assert.equal(readMarks(md).length, 2);
  const d = decide(md, model, '2026-11-15');
  assert.equal(d.acceptedByAgent.length, 1);
  assert.deepEqual(d.entries, [{ area: 'release', check: 'permissions', file: 'app.json', reason: 'only wiring', date: '2026-11-15', contains: 'reason text missing' }]);
  const noReason = decide(md.replace('accept: only wiring', 'accept'), model, 'd');
  assert.match(noReason.problems[0], /needs a reason/);
  assert.match(decide(md.replace('accept: only wiring', 'maybe'), model, 'd').problems[0], /not fix, later/);
});

test('decide.mjs previews, then --write adds the accepted rows to review.accepted.json', () => {
  const root = project({ 'review.config.json': { release: {} }, 'package.json': { name: 'x', dependencies: { 'expo-location': '1' } }, 'app.json': app({}) });
  const json = node('summary.mjs', root, '--areas', 'release', '--json').stdout;
  node('summary.mjs', root, '--areas', 'release', '--report', 's.md');
  const marked = readFileSync(join(root, 's.md'), 'utf8').replace(/^(\| 1 \|.*)\|\s+\|$/m, '$1| accept: location comes in 1.1 |');
  const { writeFileSync } = require_fs();
  writeFileSync(join(root, 's.md'), marked);
  writeFileSync(join(root, 's.json'), json);
  const preview = node('decide.mjs', root, '--report', 's.md', '--previous', 's.json');
  assert.equal(preview.status, 0, preview.stderr);
  assert.match(preview.stdout, /Would add/);
  assert.equal(existsSync(join(root, 'review.accepted.json')), false);
  node('decide.mjs', root, '--report', 's.md', '--previous', 's.json', '--write');
  assert.equal(JSON.parse(readFileSync(join(root, 'review.accepted.json'), 'utf8'))[0].reason, 'location comes in 1.1');
  assert.equal(node('decide.mjs', root).status, 2);
});
import * as fs from 'node:fs';
const require_fs = () => fs;

test('e2e: test-ID coverage, starter flows, and broken variants of every handled link', () => {
  assert.deepEqual(testIdCoverage(new Map([['a', '<Pressable testID="save">'], ['b', '<TextInput />'], ['c', 'const x = 1']])), { withIds: 1, interactive: 2 });
  const flows = maestroFlows({ appId: 'com.x', firstScreen: 'Welcome', signIn: { button: 'Sign In', email: 'Email', password: 'Password', done: 'Home' }, add: { open: 'Add', field: 'Name', save: 'Save' }, links: [{ url: 'x://item/1', expect: 'Item' }] });
  assert.deepEqual(Object.keys(flows), ['01-launch.yaml', '02-sign-in.yaml', '03-add-restart.yaml', '04-links.yaml']);
  assert.match(flows['04-links.yaml'], /openLink: "x:\/\/item\/%"/);
  assert.match(flows['02-sign-in.yaml'], /inputText: \$\{EMAIL\}/);
  assert.deepEqual(brokenLinks(['x://a?q=1', 'x://a/2', 'x://b']).length, 7);
});

test('e2e.mjs reports coverage, refuses --out without an e2e block, and writes flows with one', () => {
  const root = project({ 'src/a.tsx': '<Pressable onPress={go} />', 'review.config.json': {} });
  assert.match(node('e2e.mjs', root).stdout, /0 of 1 files/);
  assert.equal(node('e2e.mjs', root, '--out', 'flows').status, 2);
  const ok = project({ 'src/a.tsx': '', 'review.config.json': { e2e: { appId: 'com.x', firstScreen: 'Hi' } } });
  assert.equal(node('e2e.mjs', ok, '--out', 'flows').status, 0);
  assert.ok(existsSync(join(ok, 'flows', '01-launch.yaml')) && existsSync(join(ok, 'flows', 'README.md')));
});

test('load plan: needs owner and items paths with {uid}, an item, and a demo- project id; reads the runner lines', () => {
  const base = { owner: 'users/{uid}', items: 'users/{uid}/things', item: { name: 'a', updatedAt: '' }, newerField: 'updatedAt' };
  assert.equal(loadPlan({ firestoreLoad: base }).labelField, 'name');
  assert.throws(() => loadPlan({}), /No "firestoreLoad" block/);
  assert.throws(() => loadPlan({ firestoreLoad: { ...base, items: 'things' } }), /items must be a path with \{uid\}/);
  assert.throws(() => loadPlan({ firestoreLoad: { ...base, projectId: 'my-real-app' } }), /must start with "demo-"/);
  assert.throws(() => loadPlan({ firestoreLoad: { ...base, users: 0 } }), /users must be a whole number/);
  assert.deepEqual(readRun('noise\n{"kind":"rules","name":"a","ok":true}\n{"kind":"load","name":"b","ok":false}'), { rows: [{ kind: 'rules', name: 'a', ok: true }, { kind: 'load', name: 'b', ok: false }], ok: false });
  assert.equal(readRun('').ok, false, 'no results is never a pass');
});

test('firestore-load.mjs stops with a clear line on a missing block or rules file', () => {
  assert.match(node('firestore-load.mjs', project({ 'review.config.json': {} })).stderr, /No "firestoreLoad" block/);
  const noRules = node('firestore-load.mjs', project({ 'review.config.json': { firestoreLoad: { owner: 'u/{uid}', items: 'u/{uid}/i', item: {} } } }));
  assert.equal(noRules.status, 2);
  assert.match(noRules.stderr, /Rules file not found/);
});

test('links.mjs and widgets.mjs write their reports without a config', () => {
  const root = project({ 'package.json': { dependencies: { 'expo-widgets': '1' } }, 'src/a.ts': 'decodeURIComponent(x);', 'src/w.tsx': "'widget'; <Text>{n}</Text>" });
  const links = node('links.mjs', root);
  assert.match(links.stdout, /Parsing that can throw on bad input/);
  assert.match(node('widgets.mjs', root).stdout, /Personal text shown on a locked phone/);
});

test('upgrade.mjs skips release and widgets on purpose for a library, with the reason written down', () => {
  const root = project({ 'src/a.ts': '', 'review.config.json': { design: { kind: 'library' } } });
  node('upgrade.mjs', root, '--write');
  const cfg = JSON.parse(readFileSync(join(root, 'review.config.json'), 'utf8'));
  assert.match(cfg.skipAreas.release, /no store build/);
  assert.equal(cfg.release, undefined);
  assert.ok(cfg.links && cfg.structure);
});

test('widgets 1.12.1: a plan ending on a refresh entry, and calls that only hand a plan over, are not rows', () => {
  const pkg = { 'package.json': { dependencies: { 'expo-widgets': '1' } } };
  const ends = project({ ...pkg, 'src/w/timeline.ts': 'const MAX_ENTRIES = 100;\nexport const nextUpTimeline = (now: Date) => [{ date: now }, { date: now, props: { refresh: true } }];' });
  assert.equal(rows(runWidgets({}, ends), 'timeline').length, 0);
  const hands = project({ ...pkg, 'src/w/use.ts': 'w.updateTimeline([{ date: now, props: EMPTY }]);\nw.updateTimeline(nextUpTimeline(list, now));' });
  assert.equal(rows(runWidgets({}, hands), 'timeline').length, 0);
  const built = project({ ...pkg, 'src/w/use.ts': 'const entries = list.map((r) => ({ date: r.at }));\nw.updateTimeline(entries);' });
  assert.equal(rows(runWidgets({}, built), 'timeline').length, 1);
});

test('load plan 1.12.1: eraseOrder names the app\'s own erase order and needs ownerRequired for ownerFirst', () => {
  const base = { owner: 'users/{uid}', items: 'users/{uid}/items', item: { name: 'x' }, projectId: 'demo-x' };
  assert.equal(loadPlan({ firestoreLoad: { ...base, ownerRequired: true, eraseOrder: 'ownerFirst' } }).eraseOrder, 'ownerFirst');
  assert.throws(() => loadPlan({ firestoreLoad: { ...base, eraseOrder: 'ownerFirst' } }), /ownerRequired/);
  assert.throws(() => loadPlan({ firestoreLoad: { ...base, eraseOrder: 'last' } }), /ownerFirst/);
});
