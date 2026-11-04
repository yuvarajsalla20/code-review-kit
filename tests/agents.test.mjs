import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAgents } from '../scripts/agents/load.mjs';
import { runAgents } from '../scripts/agents/index.mjs';
import { toMarkdown } from '../scripts/agents/report.mjs';
import { spawnSync } from 'node:child_process';
import { KIT_VERSION } from '../scripts/lib/version.mjs';
import { project } from './helpers.mjs';

const kit = join(dirname(fileURLToPath(import.meta.url)), '..');
const CATEGORIES = ['design', 'clean-code', 'safety', 'ship', 'people', 'meta'];
const agents = loadAgents(kit);

const POINTER = 'See `rules/review-rules.md`.';
const agent = (name, extra = '') => `---\nname: ${name}\ndescription: Reviews things and never edits.\ntools: Read, Grep, Glob\n---\n## Method\nStep.\n## Rules\n${POINTER}\n## Output\nReport.\n${extra}`;
const run = (files) => runAgents({}, project({ 'rules/review-rules.md': '# Rules', ...files }));
const rows = (r, check) => r.findings.filter((f) => f.check === check);

test('the kit has agents, each in a known category folder', () => {
  assert.ok(agents.length >= 10);
  assert.deepEqual(agents.filter((a) => !CATEGORIES.includes(a.category)).map((a) => a.file), []);
});

test("the kit's own agents pass the gated checks", () => {
  const gated = runAgents({}, kit).findings.filter((f) => f.gate);
  assert.deepEqual(gated.map((f) => `${f.where} ${f.what}`), []);
});

test('the README Categories table lists every agent', () => {
  const readme = readFileSync(join(kit, 'README.md'), 'utf8');
  assert.deepEqual(agents.filter((a) => !readme.includes(`\`${a.stem}\``)).map((a) => a.file), []);
});

test('a clean agent passes every check', () => {
  const r = run({ 'agents/safety/a-reviewer.md': agent('a-reviewer'), 'skills/s/SKILL.md': 'Start `a-reviewer`.' });
  assert.deepEqual(r.findings, []);
});

test('front matter: wrong name, writer tools and missing tools are found', () => {
  const r = run({
    'agents/x/one.md': agent('other'),
    'agents/x/two.md': agent('two').replace('tools: Read, Grep, Glob', 'tools: Read, Edit'),
    'agents/x/three.md': agent('three').replace('tools: Read, Grep, Glob\n', ''),
    'skills/s/SKILL.md': '`one` `two` `three`',
  });
  const what = rows(r, 'frontmatter').map((f) => f.what).join('|');
  assert.match(what, /"other" but the file is one\.md/);
  assert.match(what, /Tools include Edit/);
  assert.match(what, /No `tools` line/);
  assert.equal(r.gate.includes('frontmatter'), true);
});

test('references: a missing file and an unknown agent are found, optional and output names are not', () => {
  const r = run({
    'agents/x/a-reviewer.md': agent('a-reviewer', 'Read `checklists/nope.md` and `ghost-reviewer`.\nRun it with --report out-report.md `out-report.md`.\nAlso `play.md` if present.\nProject file `app.json`.\n'),
    'skills/s/SKILL.md': 'Start `a-reviewer`.',
  });
  const what = rows(r, 'references').map((f) => f.what);
  assert.equal(what.length, 2);
  assert.match(what.join('|'), /checklists\/nope\.md/);
  assert.match(what.join('|'), /ghost-reviewer/);
});

test('agents that do not point to the shared rules are one row; a repeated line is found', () => {
  const same = 'This exact rule line is written word for word in many agents.\n';
  const own = (n) => agent(n, same).replace(POINTER, 'Own rules.');
  const r = run({ 'agents/x/a.md': own('a'), 'agents/x/b.md': own('b'), 'agents/x/c.md': own('c'), 'skills/s/SKILL.md': '`a` `b` `c`' });
  assert.equal(rows(r, 'shared').length, 1);
  assert.equal(rows(r, 'shared')[0].places.length, 3);
  assert.equal(rows(r, 'repeated').length, 1);
  assert.match(rows(r, 'repeated')[0].what, /repeated word for word in 3 agents/);
});

test('an agent no skill starts, and an agent without Output, are found', () => {
  const r = run({ 'agents/x/a.md': agent('a').replace('## Output\nReport.\n', ''), 'skills/s/SKILL.md': 'nothing' });
  assert.equal(rows(r, 'orphan').length, 1);
  assert.match(rows(r, 'sections')[0].what, /an Output section/);
});

test('the report has a decision column and a could-not-verify list', () => {
  const md = toMarkdown('kit', '1', '2026-01-01', run({ 'agents/x/a.md': agent('a'), 'skills/s/SKILL.md': 'x' }));
  assert.match(md, /Your decision/);
  assert.match(md, /## Could not verify/);
});

test('any tool that is not on the read-only list is flagged, including Write, NotebookEdit and MultiEdit', () => {
  for (const tool of ['Write', 'NotebookEdit', 'MultiEdit', 'Edit']) {
    const r = run({ 'agents/x/a.md': agent('a').replace('tools: Read, Grep, Glob', `tools: Read, ${tool}`), 'skills/s/SKILL.md': '`a`' });
    assert.match(rows(r, 'frontmatter').map((f) => f.what).join('|'), new RegExp(`Tools include ${tool}`), tool);
  }
  const allowed = runAgents({ agents: { allowedTools: ['Read', 'Grep', 'Glob', 'Special'] } }, project({ 'rules/review-rules.md': '#', 'agents/x/a.md': agent('a').replace('Read, Grep, Glob', 'Read, Special'), 'skills/s/SKILL.md': '`a`' }));
  assert.deepEqual(rows(allowed, 'frontmatter'), []);
});

test('front matter, references and frontmatter are gated by default', () => {
  assert.deepEqual(runAgents({}, project({})).gate, ['frontmatter', 'references']);
});

test('front matter with Windows line endings is read', () => {
  const crlf = agent('a').replace(/\n/g, '\r\n');
  const r = run({ 'agents/x/a.md': crlf, 'skills/s/SKILL.md': '`a`' });
  assert.deepEqual(r.findings, []);
});

test('agents.mjs exits 1 for a reviewer that can edit and 0 for a clean one', () => {
  const cli = (files) => spawnSync('node', [join(kit, 'scripts/agents.mjs')], { cwd: project({ 'rules/review-rules.md': '#', ...files }), encoding: 'utf8' });
  const bad = cli({ 'agents/x/a.md': agent('a').replace('Read, Grep, Glob', 'Read, Edit'), 'skills/s/SKILL.md': '`a`' });
  assert.equal(bad.status, 1);
  assert.match(bad.stdout, /Tools include Edit/);
  assert.equal(cli({ 'agents/x/a.md': agent('a'), 'skills/s/SKILL.md': '`a`' }).status, 0);
});

test('the kit version is the same in the code, the plugin manifest and the README footer', () => {
  const manifest = JSON.parse(readFileSync(join(kit, '.claude-plugin/plugin.json'), 'utf8'));
  assert.equal(KIT_VERSION, manifest.version);
  assert.match(readFileSync(join(kit, 'README.md'), 'utf8'), new RegExp(`Version ${KIT_VERSION.replace(/\./g, '\\.')} - `));
  assert.match(readFileSync(join(kit, 'CHANGELOG.md'), 'utf8'), new RegExp(`## ${KIT_VERSION.replace(/\./g, '\\.')} - `));
});
