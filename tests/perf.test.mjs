import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AREAS } from '../scripts/areas.mjs';
import { runPerf } from '../scripts/perf/index.mjs';
import { toMarkdown } from '../scripts/perf/report.mjs';
import { project } from './helpers.mjs';

const kit = join(dirname(fileURLToPath(import.meta.url)), '..');
const found = (files, speed = {}, check) => runPerf({ speed }, project(files)).findings.filter((f) => !check || f.check === check);
const kb = (n) => 'x'.repeat(n * 1024);

test('assets: finds files over the limit, including ones over 1 MB, and honours maxAssetKb', () => {
  const files = { 'assets/big.png': kb(400), 'assets/huge.mp4': kb(2048), 'assets/small.png': kb(100), 'assets/notes.txt': kb(900) };
  const rows = found(files, {}, 'assets');
  assert.deepEqual(rows.map((r) => r.where).sort(), ['assets/big.png', 'assets/huge.mp4']);
  assert.match(rows.find((r) => r.where === 'assets/big.png').what, /400 KB, over the 300 KB limit/);
  assert.equal(found(files, { maxAssetKb: 50 }, 'assets').length, 3);
  assert.throws(() => found(files, { maxAssetKb: 0 }), /maxAssetKb must be a number above 0/);
});

test('heavy: flags listed packages by name, accepts your own list, and reports a broken package.json', () => {
  const pkg = JSON.stringify({ dependencies: { moment: '2', lodash: '4', react: '19' } });
  assert.deepEqual(found({ 'package.json': pkg }, {}, 'heavy').map((r) => r.where), ['package.json:moment', 'package.json:lodash']);
  assert.deepEqual(found({ 'package.json': pkg }, { heavy: { react: 'test' } }, 'heavy').map((r) => r.where), ['package.json:moment', 'package.json:lodash', 'package.json:react']);
  assert.equal(found({ 'src/a.ts': '' }, {}, 'heavy').length, 0);
  assert.throws(() => found({ 'package.json': '{' }), /package\.json is not valid JSON/);
});

test('animation: needs a useNativeDriver that is not missing or false; comments do not count', () => {
  const src = [
    "Animated.timing(v, { toValue: 1, useNativeDriver: true }).start();",
    "Animated.spring(v, {",
    "  toValue: 1,",
    "  useNativeDriver: true,",
    "}).start();",
    "Animated.timing(w, { toValue: 1 }).start();",
    "Animated.timing(x, { toValue: 1, useNativeDriver: false }).start();",
    "// Animated.timing(y, {}) is only a comment",
    "Animated.timing(z, { toValue: 1, useNativeDriver: Platform.OS !== 'web' }).start();",
  ].join('\n');
  const rows = found({ 'src/a.tsx': src }, {}, 'animation');
  assert.deepEqual(rows.map((r) => r.where), ['src/a.tsx:6', 'src/a.tsx:7'], 'a variable or expression is the author\'s choice');
  assert.deepEqual(rows[0].places, [{ file: 'src/a.tsx', from: 6 }]);
});

test('lists: .map inside a ScrollView is flagged; FlatList, static children and self-closing tags are not', () => {
  const flagged = '<ScrollView>\n  {items.map((i) => <Row key={i} />)}\n</ScrollView>';
  const attrs = '<ScrollView onScroll={(e) => go(e)} style={s}>\n  {items.map((i) => <Row key={i} />)}\n</ScrollView>';
  const ok = '<FlatList data={items} />\n<ScrollView><Row /><Row /></ScrollView>\n<ScrollView style={s} />\n<View>{xs.map((x) => x)}</View>\n<ScrollView><Row /></ScrollView>';
  assert.deepEqual(found({ 'src/a.tsx': flagged }, {}, 'lists').map((r) => r.where), ['src/a.tsx:1']);
  assert.equal(found({ 'src/a.tsx': attrs }, {}, 'lists').length, 1);
  assert.equal(found({ 'src/a.tsx': ok }, {}, 'lists').length, 0);
});

test('cleanup: a started timer or listener needs a stop in the same file; a thrown-away live listener is flagged', () => {
  const rows = (src) => found({ 'src/a.ts': src }, {}, 'cleanup').map((r) => r.what.split(' ').slice(0, 3).join(' '));
  assert.equal(rows('setInterval(tick, 1000);\nsetInterval(tock, 1000);').length, 1, 'once per file');
  assert.equal(rows('const id = setInterval(tick, 1000);\nclearInterval(id);').length, 0);
  const effect = (body) => `useEffect(() => {\n  ${body}\n}, []);`;
  assert.equal(rows(effect('Keyboard.addListener("x", f);')).length, 1);
  assert.equal(rows('Keyboard.addListener("x", f);').length, 0, 'outside a component it lives as long as the app');
  assert.equal(rows(effect('const s = AppState.addEventListener("change", f);\n  return () => s.remove();')).length, 0);
  assert.equal(rows('useEffect(() => {\n  onSnapshot(q, cb);\n}, []);').length, 1);
  assert.equal(rows('const stop = onSnapshot(q, cb);').length, 0);
  assert.equal(rows('const watch = () => onAuthStateChanged(auth, cb);\nfunction f() {\n  return onSnapshot(q, cb);\n}').length, 0);
});

test('nothing gates by default; speed.gate makes a check fail the run; a mistyped gate stops it', () => {
  const root = project({ 'package.json': JSON.stringify({ dependencies: { moment: '2' } }), 'review.config.json': { speed: {} } });
  const run = (...args) => spawnSync('node', [join(kit, 'scripts/perf.mjs'), ...args], { cwd: root, encoding: 'utf8' });
  assert.equal(run().status, 0);
  assert.match(run().stdout, /moment/);
  const gated = project({ 'package.json': JSON.stringify({ dependencies: { moment: '2' } }), 'review.config.json': { speed: { gate: ['heavy'] } } });
  assert.equal(spawnSync('node', [join(kit, 'scripts/perf.mjs')], { cwd: gated }).status, 1);
  const typo = project({ 'review.config.json': { speed: { gate: ['hevy'] } } });
  const bad = spawnSync('node', [join(kit, 'scripts/perf.mjs')], { cwd: typo, encoding: 'utf8' });
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /Unknown gate name: hevy/);
});

test('works with no config at all, and check.mjs shows the speed area when the config has a speed block', () => {
  const root = project({ 'package.json': JSON.stringify({ dependencies: { lodash: '4' } }) });
  assert.equal(spawnSync('node', [join(kit, 'scripts/perf.mjs')], { cwd: root }).status, 0);
  const withBlock = project({ 'package.json': JSON.stringify({ dependencies: { lodash: '4' } }), 'review.config.json': { speed: {} } });
  const out = spawnSync('node', [join(kit, 'scripts/check.mjs')], { cwd: withBlock, encoding: 'utf8' });
  assert.equal(out.status, 0);
  assert.match(out.stdout, /== Speed and cost ==/);
  assert.match(out.stdout, /REVIEW {2}heavy \(1\)/);
  assert.ok(AREAS.some((a) => a.key === 'speed' && a.script === 'perf.mjs'));
});

test('the report has a decision column for every row and says what it could not check', () => {
  const md = toMarkdown('demo', '9.9.9', '2026-11-04', runPerf({}, project({ 'package.json': JSON.stringify({ dependencies: { moment: '2' } }) })));
  assert.match(md, /\| 1 \| package\.json:moment \|.*\| medium \| \|/);
  assert.match(md, /## Could not verify/);
  assert.match(md, /Review: you decide/);
  assert.doesNotMatch(md, /Gate: must be fixed/);
});
