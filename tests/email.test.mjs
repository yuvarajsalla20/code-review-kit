import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildMessage, emailSettings, loadRecipients, pickRecipients } from '../scripts/email/index.mjs';
import { ConfigError } from '../scripts/lib/findings.mjs';
import { project } from './helpers.mjs';

const kit = join(import.meta.dirname, '..');
const run = (cwd, ...args) => spawnSync('node', [join(kit, 'scripts', 'email.mjs'), ...args], { cwd, encoding: 'utf8' });
const git = (cwd, ...args) => spawnSync('git', args, { cwd, encoding: 'utf8' });
const ADDR = { main: 'owner@example.com', allowed: ['owner@example.com', 'Team@Example.com', 'qa@example.org'] };
const MODEL = {
  project: 'demo', verdict: 'Ready after fixes', verdictKey: 'after', verdictMeaning: 'Nothing blocks the release, but the High items are worth fixing first.', kitVersion: '1.13.0',
  counts: { mustFix: 0, Blocker: 0, High: 1, Medium: 2, Low: 0 }, notRun: [],
  fixFirst: [{ severity: 'High', meaning: 'A link with a stray <%> crashes the app', where: 'src/links.ts:12 | src/b.ts:3' }],
};
const setup = (files = {}) => project({ 'review.config.json': { name: 'demo', email: { enabled: true } }, 'review.email.json': ADDR, 'summary.json': MODEL, 'summary.html': '<html></html>', ...files });

test('no email block, or enabled false, means email is off', () => {
  assert.equal(emailSettings({}), null);
  assert.equal(emailSettings({ email: { enabled: false } }), null);
  assert.deepEqual(emailSettings({ email: {} }), { addressesFile: 'review.email.json', attach: ['summary.html'], send: 'always', subjectPrefix: 'Code review' });
});

test('any number of allowed addresses; main is always allowed, duplicates collapse', () => {
  const root = project({ 'review.email.json': { main: 'a@x.com', allowed: ['b@y.com', 'A@x.com', 'c@z.org', 'd@w.net'] } });
  assert.deepEqual(loadRecipients(root, emailSettings({ email: {} })).allowed, ['a@x.com', 'b@y.com', 'c@z.org', 'd@w.net']);
});

test('a missing file, a bad main, or a bad allowed entry stops with a clear message', () => {
  const s = emailSettings({ email: {} });
  assert.throws(() => loadRecipients(project({}), s), (e) => e instanceof ConfigError && /missing/.test(e.message));
  assert.throws(() => loadRecipients(project({ 'review.email.json': { main: 'nope' } }), s), /needs "main"/);
  assert.throws(() => loadRecipients(project({ 'review.email.json': { main: 'a@x.com', allowed: ['a@x.com', 'bad address'] } }), s), /bad address/);
});

test('main by default, all on request, named ones only when allowed (any case)', () => {
  const r = { main: ADDR.main, allowed: ADDR.allowed };
  assert.deepEqual(pickRecipients(r), ['owner@example.com']);
  assert.deepEqual(pickRecipients(r, 'all'), ADDR.allowed);
  assert.deepEqual(pickRecipients(r, 'team@example.com, qa@example.org'), ['Team@Example.com', 'qa@example.org']);
  assert.throws(() => pickRecipients(r, 'qa@example.org,stranger@evil.com'), (e) => e instanceof ConfigError && /stranger@evil\.com/.test(e.message) && !/qa@/.test(e.message));
});

test('the message carries the verdict, counts and fix-first rows, with HTML escaped', () => {
  const m = buildMessage(MODEL, emailSettings({ email: {} }), { date: '2026-11-15' });
  assert.equal(m.subject, 'Code review: demo - Ready after fixes (2026-11-15)');
  assert.match(m.body, /0 Blocker, 1 High, 2 Medium, 0 Low/);
  assert.match(m.body, /1\. \[High\] A link with a stray <%> crashes the app \(src\/links\.ts:12\)/);
  assert.match(m.htmlBody, /stray &lt;%&gt; crashes/);
  assert.doesNotMatch(m.htmlBody, /<%>/);
});

test('the script writes the hand-off file with the attachment path, and refuses a stranger', () => {
  const root = setup();
  const ok = run(root, '--summary', 'summary.json', '--out', 'review-out/email.json');
  assert.equal(ok.status, 0, ok.stderr);
  const out = JSON.parse(readFileSync(join(root, 'review-out/email.json'), 'utf8'));
  assert.deepEqual(out.to, ['owner@example.com']);
  assert.deepEqual(out.attachments.map((a) => a.name), ['summary.html']);
  assert.ok(out.attachments[0].path.startsWith('/'));
  const bad = run(root, '--summary', 'summary.json', '--to', 'stranger@evil.com', '--out', 'review-out/bad.json');
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /Not on the allowed list/);
});

test('a committed addresses file stops the run; an unignored one warns', () => {
  const root = setup();
  git(root, 'init', '-q');
  const warn = run(root, '--check');
  assert.equal(warn.status, 0);
  assert.match(warn.stderr, /not in \.gitignore/);
  writeFileSync(join(root, '.gitignore'), 'review.email.json\n');
  assert.doesNotMatch(run(root, '--check').stderr, /Warning/);
  git(root, 'add', '-f', 'review.email.json');
  const tracked = run(root, '--check');
  assert.equal(tracked.status, 2);
  assert.match(tracked.stderr, /committed to git/);
});

test('with email off the script says so and exits 0', () => {
  const root = project({ 'review.config.json': { name: 'demo' } });
  const r = run(root, '--check');
  assert.equal(r.status, 0);
  assert.match(r.stdout, /Email is off/);
});
