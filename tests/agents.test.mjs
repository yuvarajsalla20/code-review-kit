import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const kit = join(dirname(fileURLToPath(import.meta.url)), '..');
const CATEGORIES = ['design', 'clean-code', 'safety', 'ship', 'people'];
const agentsDir = join(kit, 'agents');

const agents = readdirSync(agentsDir, { withFileTypes: true }).flatMap((entry) =>
  entry.isDirectory() ? readdirSync(join(agentsDir, entry.name)).map((file) => ({ category: entry.name, file })) : [{ category: null, file: entry.name }],
);
const field = (text, key) => text.match(new RegExp(`^${key}: (.+)$`, 'm'))?.[1];

test('every agent sits in a known category folder', () => {
  assert.deepEqual(agents.filter((a) => !CATEGORIES.includes(a.category)), []);
});

test('every agent has a name matching its file and a description', () => {
  for (const { category, file } of agents) {
    const text = readFileSync(join(agentsDir, category, file), 'utf8');
    assert.equal(field(text, 'name'), file.replace(/\.md$/, ''), `${category}/${file}`);
    assert.ok(field(text, 'description'), `${category}/${file} needs a description`);
  }
});

test('the README Categories table lists every agent', () => {
  const readme = readFileSync(join(kit, 'README.md'), 'utf8');
  const missing = agents.filter((a) => !readme.includes('`' + a.file.replace(/\.md$/, '') + '`'));
  assert.deepEqual(missing, []);
});
