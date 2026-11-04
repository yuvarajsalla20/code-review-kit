import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { stripComments, withoutImports } from '../scripts/lib/source.mjs';
import { parseImports, resolveImport, buildGraph } from '../scripts/lib/imports.mjs';
import { findCycles } from '../scripts/structure/cycles.mjs';
import { checkLayers, checkRestricted, layerOf } from '../scripts/structure/layers.mjs';
import { findDuplicateBlocks, findRepeatedValues } from '../scripts/structure/dupes.mjs';
import { findOversize } from '../scripts/structure/size.mjs';
import { runStructure } from '../scripts/structure/index.mjs';
import { toMarkdown } from '../scripts/structure/report.mjs';

/** Writes a small project to a temp folder and returns its path. */
const project = (files) => {
  const root = mkdtempSync(join(tmpdir(), 'review-kit-'));
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, name)), { recursive: true });
    writeFileSync(join(root, name), text);
  }
  return root;
};
const texts = (files) => new Map(Object.entries(files).map(([f, t]) => [f, stripComments(t)]));
const block = (tag, n = 8) => Array.from({ length: n }, (_, i) => `const step${i}_${tag === 'same' ? '' : tag} = compute(value${i}, other${i}, 'label number ${i}');`).join('\n');

test('stripComments keeps every line and leaves strings alone', () => {
  const src = "const url = 'http://a.b//c'; // note\n/* one\ntwo */ const x = 1;\n";
  const out = stripComments(src);
  assert.equal(out.split('\n').length, src.split('\n').length);
  assert.ok(out.includes("'http://a.b//c'"));
  assert.ok(!out.includes('note'));
  assert.ok(out.includes('const x = 1;'));
});

test('parseImports reads every form and ignores commented ones', () => {
  const clean = stripComments("import a from './a';\n// import b from './b';\nimport type { T } from './t';\nexport * from './c';\nimport {\n  q,\n  r,\n} from '../z';\nimport './side';\nconst d = await import('./d');\nconst e = require('./e');\n");
  const specs = parseImports(clean).map((i) => [i.spec, i.typeOnly]);
  assert.deepEqual(specs.sort(), [['../z', false], ['./a', false], ['./c', false], ['./d', false], ['./e', false], ['./side', false], ['./t', true]].sort());
});

test('resolveImport finds files, index files, aliases and .js names for .ts files', () => {
  const files = new Set(['src/a.ts', 'src/ui/index.tsx', 'src/lib/util.ts']);
  assert.equal(resolveImport('src/x.ts', './a', files), 'src/a.ts');
  assert.equal(resolveImport('src/x.ts', './ui', files), 'src/ui/index.tsx');
  assert.equal(resolveImport('src/x.ts', '@/lib/util', files, { '@/': 'src/' }), 'src/lib/util.ts');
  assert.equal(resolveImport('src/x.ts', './lib/util.js', files), 'src/lib/util.ts');
  assert.equal(resolveImport('src/x.ts', 'react', files), null);
  assert.equal(resolveImport('src/x.ts', './missing', files), null);
});

test('cycles: finds a three-file loop, a self-import, and ignores type-only loops by default', () => {
  const loop = buildGraph(texts({ 'a.ts': "import './b';", 'b.ts': "import './c';", 'c.ts': "import './a';", 'd.ts': "import './a';" }));
  const found = findCycles(loop.edges);
  assert.equal(found.length, 1);
  assert.deepEqual(found[0].files, ['a.ts', 'b.ts', 'c.ts']);
  assert.deepEqual(found[0].loop, ['a.ts', 'b.ts', 'c.ts', 'a.ts']);
  assert.equal(findCycles(buildGraph(texts({ 'a.ts': "import './a';" })).edges).length, 1);
  const typed = buildGraph(texts({ 'a.ts': "import type { B } from './b';", 'b.ts': "import { a } from './a';" }));
  assert.equal(findCycles(typed.edges).length, 0);
  assert.equal(findCycles(typed.edges, { includeTypeOnly: true }).length, 1);
  assert.equal(findCycles(buildGraph(texts({ 'a.ts': "import './b';", 'b.ts': '' })).edges).length, 0);
});

test('layers: allows downward imports, flags upward ones, picks the longest matching path', () => {
  const layers = [
    { name: 'shared', paths: ['src/shared'], mayImport: [] },
    { name: 'data', paths: ['src/data'], mayImport: ['shared'] },
    { name: 'screens', paths: ['src/screens'], mayImport: ['shared', 'data'] },
    { name: 'special', paths: ['src/data/special'], mayImport: ['screens'] },
  ];
  assert.equal(layerOf('src/data/special/x.ts', layers).name, 'special');
  assert.equal(layerOf('src/database/x.ts', layers), null);
  const g = buildGraph(texts({
    'src/screens/Home.tsx': "import '../data/store'; import '../shared/c';",
    'src/data/store.ts': "import '../screens/Home'; import '../shared/c';",
    'src/shared/c.ts': "import '../data/store';",
    'src/other/o.ts': "import '../screens/Home';",
  }));
  const bad = checkLayers(g.edges, layers).map((p) => `${p.file}>${p.to}`).sort();
  assert.deepEqual(bad, ['src/data/store.ts>src/screens/Home.tsx', 'src/shared/c.ts>src/data/store.ts']);
});

test('restricted: a package may only be imported from its allowed places', () => {
  const g = buildGraph(texts({ 'src/data/db.ts': "import { getDoc } from 'firebase/firestore';", 'src/screens/A.tsx': "import { doc } from 'firebase/firestore';", 'src/screens/B.tsx': "import firebaseish from 'firebasex';" }));
  const bad = checkRestricted(g.externals, [{ module: 'firebase', onlyIn: ['src/data'] }]);
  assert.deepEqual(bad.map((p) => p.file), ['src/screens/A.tsx']);
});

test('duplicates: finds a copied block, ignores imports and short runs, groups copies in three files', () => {
  const same = block('same');
  const two = findDuplicateBlocks(texts({ 'a.ts': `import { x } from './x';\n${same}\nconst only = 1;`, 'b.ts': `import { x } from './x';\nconst different = 2;\n${same}` }));
  assert.equal(two.length, 1);
  assert.equal(two[0].lines, 8);
  assert.deepEqual(two[0].places.map((p) => p.file), ['a.ts', 'b.ts']);
  assert.equal(two[0].places[0].from, 2);
  const three = findDuplicateBlocks(texts({ 'a.ts': same, 'b.ts': same, 'c.ts': `const z = 0;\n${same}` }));
  assert.equal(three.length, 1);
  assert.equal(three[0].places.length, 3);
  assert.equal(findDuplicateBlocks(texts({ 'a.ts': block('x', 4), 'b.ts': block('x', 4) })).length, 0);
  const imports = "import { aaaaaaaaaa,\n bbbbbbbbbb,\n cccccccccc,\n dddddddddd,\n eeeeeeeeee,\n ffffffffff,\n gggggggggg } from './x';";
  assert.equal(findDuplicateBlocks(texts({ 'a.ts': imports, 'b.ts': imports })).length, 0);
});

test('duplicates: a repeating pattern inside one file is not a copy of itself', () => {
  const pattern = Array.from({ length: 6 }, () => "const same = callSomething('the same long text to pass the size floor', 12345);").join('\n');
  assert.equal(findDuplicateBlocks(texts({ 'a.ts': pattern })).length, 0);
});

test('repeated values: lists in two places, text in three files, rules files included', () => {
  const found = findRepeatedValues(texts({
    'a.ts': "export const A = [0, 15, 30, 45, 60];\nconst t = 'a long repeated sentence';",
    'b.ts': "const B = [0,15,30,45,60];\nconst t = 'a long repeated sentence';",
    'c.ts': "const S = ['Sparkle', 'Bell', 'Chime', 'Ping'];\nconst t = 'a long repeated sentence';",
    'firestore.rules': "d.sound in ['Sparkle', \"Bell\", 'Chime', 'Ping']",
  }));
  assert.deepEqual(found.map((f) => [f.kind, f.places.length]).sort(), [['list', 2], ['list', 2], ['text', 3]].sort());
  const two = findRepeatedValues(texts({ 'a.ts': "const t = 'a long repeated sentence';", 'b.ts': "const t = 'a long repeated sentence';" }));
  assert.equal(two.length, 0);
  assert.equal(findRepeatedValues(texts({ 'a.ts': "const t = 'x ignore me please';", 'b.ts': "const t = 'x ignore me please';", 'c.ts': "const t = 'x ignore me please';" }), { ignore: ['x ignore me please'] }).length, 0);
});

test('size: flags long files and long functions, and not short ones', () => {
  const longFn = `export function big() {\n${'  doThing();\n'.repeat(90)}}\n`;
  const result = findOversize(texts({ 'big.ts': longFn, 'small.ts': 'export const f = (x) => x + 1;\n' }), { maxFileLines: 50, maxFunctionLines: 80 });
  assert.deepEqual(result.files.map((f) => f.file), ['big.ts']);
  assert.deepEqual(result.functions.map((f) => [f.name, f.lines]), [['big', 92]]);
  assert.equal(findOversize(texts({ 'small.ts': 'const a = 1;' })).files.length, 0);
});

test('runStructure + report: gate findings, review findings, and a clean project', () => {
  const dirty = project({
    'src/shared/c.ts': "import '../data/store';\nexport const c = 1;",
    'src/data/store.ts': "import '../shared/c';\nexport const s = 1;",
    'src/screens/A.ts': `${block('same')}`,
    'src/screens/B.ts': `${block('same')}`,
    'tests/ignored.ts': `${block('same')}`,
  });
  const config = { name: 'demo', structure: { layers: [{ name: 'shared', paths: ['src/shared'], mayImport: [] }, { name: 'data', paths: ['src/data'], mayImport: ['shared'] }] } };
  const result = runStructure(config, dirty);
  assert.equal(result.counts.cycles, 1);
  assert.equal(result.counts.layers, 1);
  assert.equal(result.counts.duplicates, 1);
  assert.ok(result.findings.filter((f) => f.gate).length >= 2);
  assert.ok(result.findings.filter((f) => f.check === 'duplicates').every((f) => !f.gate));
  const md = toMarkdown('demo', '1.4.0', '2026-11-04', result);
  assert.match(md, /# Structure report: demo/);
  assert.match(md, /\| # \| Where \| What \| Suggested fix \| Effort \| Your decision \|/);
  assert.match(md, /Gate: must be fixed or accepted/);
  assert.match(md, /## Size\n\nNone found\./);

  const clean = project({ 'src/a.ts': "import './b';\nexport const a = 1;", 'src/b.ts': 'export const b = 2;' });
  const ok = runStructure({ structure: {} }, clean);
  assert.equal(ok.findings.length, 0);
  assert.match(toMarkdown('x', '1', 'd', ok), /No layer map is configured/);
});

test('the command line exits 1 on a gated finding, 0 when clean, and writes the report', () => {
  const kit = join(import.meta.dirname, '..', 'scripts');
  const bad = project({ 'review.config.json': JSON.stringify({ name: 'bad' }), 'src/a.ts': "import './b';", 'src/b.ts': "import './a';" });
  const run = (cwd, ...extra) => spawnSync('node', [join(kit, 'structure.mjs'), ...extra], { cwd, encoding: 'utf8' });
  assert.equal(run(bad).status, 1);
  const report = join(bad, 'out.md');
  run(bad, '--report', report);
  assert.match(spawnSync('cat', [report], { encoding: 'utf8' }).stdout, /Circular imports/);
  const good = project({ 'review.config.json': JSON.stringify({ name: 'good' }), 'src/a.ts': 'export const a = 1;' });
  assert.equal(run(good).status, 0);
  const viaCheck = spawnSync('node', [join(kit, 'check.mjs')], { cwd: bad, encoding: 'utf8' });
  assert.equal(viaCheck.status, 0, 'check.mjs only runs structure when the config has a structure block');
  writeFileSync(join(bad, 'review.config.json'), JSON.stringify({ name: 'bad', structure: {} }));
  const gated = spawnSync('node', [join(kit, 'check.mjs')], { cwd: bad, encoding: 'utf8' });
  assert.equal(gated.status, 1);
  assert.match(gated.stdout, /FAIL {2}cycles \(1\)/);
});
