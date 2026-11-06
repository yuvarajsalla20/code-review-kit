import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execSync, spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { runRelease } from '../scripts/release/index.mjs';
import { toMarkdown } from '../scripts/release/report.mjs';
import { project } from './helpers.mjs';

const lock = (deps = {}) => ({ name: 'x', lockfileVersion: 3, packages: { '': { name: 'x', dependencies: deps } } });
const app = (expo) => ({ expo: { name: 'X', version: '1.0.0', icon: './i.png', ios: { bundleIdentifier: 'com.x.y', buildNumber: '1' }, ...expo } });
const found = (root, config = {}, check) => runRelease({ release: config }, root).findings.filter((f) => !check || f.check === check);

test('lockfile: in sync passes, out of sync fails and says what is missing', () => {
  assert.equal(found(project({ 'package.json': { name: 'x', version: '1.0.0' }, 'package-lock.json': lock() }), {}, 'lockfile').length, 0);
  const bad = found(project({ 'package.json': { name: 'x', version: '1.0.0', dependencies: { 'left-pad': '1.3.0' } }, 'package-lock.json': lock() }), {}, 'lockfile');
  assert.equal(bad.length, 1);
  assert.equal(bad[0].gate, true);
  assert.match(bad[0].what, /Missing: left-pad/);
  assert.equal(found(project({ 'package.json': { name: 'x' } }), {}, 'lockfile').length, 0, 'no lock file, nothing to check');
});

test('appConfig: lists what the store needs, and accepts EAS remote versioning for the build number', () => {
  const missing = found(project({ 'app.json': { expo: { name: 'X' } } }), {}, 'appConfig');
  assert.match(missing[0].what, /version.*ios\.bundleIdentifier.*icon.*buildNumber/);
  assert.equal(found(project({ 'app.json': app({}) }), {}, 'appConfig').length, 0);
  const remote = app({ ios: { bundleIdentifier: 'com.x.y' } });
  assert.equal(found(project({ 'app.json': remote }), {}, 'appConfig').length, 1);
  assert.equal(found(project({ 'app.json': remote, 'eas.json': { cli: { appVersionSource: 'remote' } } }), {}, 'appConfig').length, 0);
});

test('permissions: needs a real reason for each sensitive package', () => {
  const pkg = { name: 'x', dependencies: { 'expo-location': '1', 'expo-image-picker': '1' } };
  const none = found(project({ 'package.json': pkg, 'app.json': app({}) }), {}, 'permissions');
  assert.equal(none.length, 2);
  const ok = app({ plugins: [['expo-location', { locationWhenInUsePermission: 'Used when you tap Current, to fill in an address.' }]], ios: { bundleIdentifier: 'a.b', buildNumber: '1', infoPlist: { NSPhotoLibraryUsageDescription: 'To choose a profile picture.' } } });
  assert.equal(found(project({ 'package.json': pkg, 'app.json': ok }), {}, 'permissions').length, 0);
  const generic = app({ plugins: [['expo-location', { locationWhenInUsePermission: 'Allow $(PRODUCT_NAME) to use your location.' }]], ios: { bundleIdentifier: 'a.b', buildNumber: '1', infoPlist: { NSPhotoLibraryUsageDescription: 'ok text' } } });
  const flagged = found(project({ 'package.json': pkg, 'app.json': generic }), {}, 'permissions');
  assert.equal(flagged.length, 1);
  assert.match(flagged[0].what, /default or placeholder/);
});

test('tracked: a secret file in git is a gated finding; outside git nothing is reported', () => {
  const root = project({ '.env': 'KEY=1', 'src/a.ts': '', '.gitignore': '' });
  assert.equal(found(root, {}, 'tracked').length, 0);
  execSync('git init -q && git add -A', { cwd: root });
  const hit = found(root, {}, 'tracked');
  assert.deepEqual(hit.map((f) => [f.where, f.gate]), [['.env', true]]);
});

test('privacy: the policy must mention what the app uses; review, not gate', () => {
  const files = (policy) => project({ 'package.json': { name: 'x', dependencies: { '@sentry/react-native': '1', firebase: '1' } }, 'public/privacy.html': policy });
  const config = { privacyFile: 'public/privacy.html' };
  const bad = found(files('We store nothing.'), config, 'privacy');
  assert.equal(bad.length, 2);
  assert.ok(bad.every((f) => !f.gate));
  assert.equal(found(files('We use Firebase, and send crash reports to Sentry.'), config, 'privacy').length, 0);
  assert.equal(found(project({ 'package.json': { name: 'x' } }), config, 'privacy')[0].what, 'The privacy policy file was not found');
});

test('report and command line', () => {
  const root = project({ 'review.config.json': { name: 'demo', release: {} }, 'app.json': { expo: { name: 'X' } } });
  const md = toMarkdown('demo', '1.5.0', '2026-11-04', runRelease({ release: {} }, root));
  assert.match(md, /# Release readiness report: demo/);
  assert.match(md, /Gate: must be fixed or accepted/);
  assert.match(md, /\| # \| Where \| What \| Suggested fix \| Effort \| Your decision \|/);
  const run = (cwd) => spawnSync('node', [join(import.meta.dirname, '..', 'scripts', 'release.mjs')], { cwd, encoding: 'utf8' });
  assert.equal(run(root).status, 1);
  assert.equal(run(project({ 'review.config.json': { name: 'ok' }, 'app.json': app({}) })).status, 0);
});

const pin = (repo, sha) => `https://codeload.github.com/o/${repo}/tar.gz/${sha}`;
const SHA = 'a'.repeat(40);

test('kits: labels must agree with pins, offline; advisory', () => {
  const ok = project({ 'package.json': { name: 'x', dependencies: { 'k-a': pin('k-a', SHA) }, kitVersions: { 'k-a': 'v1.0.0' } } });
  assert.equal(found(ok, {}, 'kits').length, 0);
  const none = found(project({ 'package.json': { name: 'x', dependencies: { 'k-a': pin('k-a', SHA) } } }), {}, 'kits');
  assert.match(none[0].what, /k-a is pinned to commit aaaaaaa/);
  assert.equal(none[0].gate, false);
  const stale = found(project({ 'package.json': { name: 'x', dependencies: { 'k-a': pin('k-a', SHA) }, kitVersions: { 'k-a': 'v1.0.0', 'k-b': 'v2.0.0' } } }), {}, 'kits');
  assert.match(stale[0].what, /lists k-b/);
  assert.equal(found(project({ 'package.json': { name: 'x', dependencies: { left: '1.0.0' } } }), {}, 'kits').length, 0, 'normal dependencies are not kits');
});

test('kits online: tag mismatch, missing tag, newer tag and unreachable remote', () => {
  const dir = project({});
  const git = (c) => execSync(c, { cwd: dir, stdio: 'pipe' });
  git('git init -q -b main && git config user.email a@b.c && git config user.name t');
  git('git commit -q --allow-empty -m one && git tag v1.0.0');
  const first = String(git('git rev-parse HEAD')).trim();
  git('git commit -q --allow-empty -m two && git tag v1.1.0');
  const remote = { kitsOnline: true, kitsRemote: dir };
  const mk = (sha, label) => project({ 'package.json': { name: 'x', dependencies: { 'k-a': pin('k-a', sha) }, kitVersions: { 'k-a': label } } });
  const whats = (root, cfg = remote) => found(root, cfg, 'kits').map((f) => f.what);
  assert.match(whats(mk(first, 'v1.0.0')).join(), /v1\.1\.0 exists; the app is on v1\.0\.0/);
  assert.match(whats(mk(first, 'v1.1.0')).join(), /not the commit of that tag/);
  assert.match(whats(mk(first, 'v9.9.9')).join(), /does not exist on the remote/);
  const latest = String(git('git rev-parse HEAD')).trim();
  assert.deepEqual(whats(mk(latest, 'v1.1.0')), []);
  assert.match(whats(mk(first, 'v1.0.0'), { kitsOnline: true, kitsRemote: '/nonexistent/path' }).join(), /Could not reach/);
});

test('kits online: no label adds no tag rows, and an annotated tag is compared by the commit it points to', () => {
  const dir = project({});
  const git = (c) => String(execSync(c, { cwd: dir, stdio: 'pipe' })).trim();
  git('git init -q -b main && git config user.email a@b.c && git config user.name t');
  git('git commit -q --allow-empty -m one && git tag -a v1.0.0 -m release');
  const sha = git('git rev-parse HEAD');
  const cfg = { kitsOnline: true, kitsRemote: dir };
  const labelled = project({ 'package.json': { name: 'x', dependencies: { 'k-a': pin('k-a', sha) }, kitVersions: { 'k-a': 'v1.0.0' } } });
  assert.deepEqual(found(labelled, cfg, 'kits'), []);
  const bare = found(project({ 'package.json': { name: 'x', dependencies: { 'k-a': pin('k-a', sha) } } }), cfg, 'kits');
  assert.equal(bare.length, 1, 'only the missing label is reported');
});
