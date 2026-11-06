// Release readiness checks: things that fail a build or a store review, found before you submit.
// Findings have the same shape as the structure checks: { check, gate, where, what, fix, effort }.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assemble } from '../lib/findings.mjs';

export const CHECKS = ['lockfile', 'appConfig', 'permissions', 'tracked', 'privacy', 'kits'];
const DEFAULTS = { appConfig: 'app.json', privacyFile: null, kitsOnline: false, kitsRemote: 'https://github.com/{owner}/{repo}.git', lockfileCommand: 'npm ci --dry-run --ignore-scripts', gate: ['lockfile', 'appConfig', 'permissions', 'tracked'] };

/** Packages that need a written reason before the store accepts the app: package, the plugin options and plist keys that carry it. */
const NEEDS_REASON = {
  'expo-location': ['locationWhenInUsePermission', 'NSLocationWhenInUseUsageDescription'],
  'expo-image-picker': ['photosPermission', 'NSPhotoLibraryUsageDescription'],
  'expo-camera': ['cameraPermission', 'NSCameraUsageDescription'],
  'expo-contacts': ['contactsPermission', 'NSContactsUsageDescription'],
  'expo-av': ['microphonePermission', 'NSMicrophoneUsageDescription'],
};
/** What a privacy policy must mention when the app uses this package. */
const MUST_MENTION = {
  '@sentry/react-native': [/sentry/i, 'crash reports (Sentry)'],
  firebase: [/firebase/i, 'Firebase'],
  'expo-location': [/location/i, 'location'],
  'expo-image-picker': [/photo|camera/i, 'photos or camera'],
  'expo-notifications': [/notification/i, 'notifications'],
  '@react-native-google-signin/google-signin': [/google/i, 'Google sign-in'],
  'expo-apple-authentication': [/apple/i, 'Sign in with Apple'],
};
const SECRET_FILE = [/(^|\/)\.env$/, /\.(p8|p12|pem|keystore|jks)$/i, /service-?account.*\.json$/i];
const PLACEHOLDER = /Allow \$\(PRODUCT_NAME\)|TODO|lorem ipsum/i;

const readJson = (root, name) => (existsSync(join(root, name)) ? JSON.parse(readFileSync(join(root, name), 'utf8')) : null);
/** Runs a command and returns { ok, out }: out is its output, or its error text when it failed. */
const run = (cmd, cwd) => {
  try {
    return { ok: true, out: execSync(cmd, { cwd, stdio: 'pipe', encoding: 'utf8' }) };
  } catch (e) {
    return { ok: false, out: String(e.stderr || e.stdout || e.message) };
  }
};

const lockfile = (root, s) => {
  if (!existsSync(join(root, 'package.json')) || !existsSync(join(root, 'package-lock.json'))) return [];
  const { ok, out } = run(s.lockfileCommand, root);
  if (ok) return [];
  const lines = out.split('\n').filter((l) => /npm error (Missing|Invalid|code)|not in sync/i.test(l)).slice(0, 3).map((l) => l.replace(/^npm error\s*/, '').trim());
  return [{ where: 'package-lock.json', what: `The lock file does not match package.json, so a clean install (what EAS runs) fails: ${lines.join('; ') || 'see npm output'}`, fix: 'Regenerate the lock file with `npm install` on a clean checkout, or add an `overrides` entry for the conflicting peer dependency, then run `npm ci` to prove it.', effort: 'small' }];
};

const appConfig = (root, s) => {
  const app = readJson(root, s.appConfig)?.expo;
  if (!app) return existsSync(join(root, s.appConfig)) ? [{ where: s.appConfig, what: 'No `expo` section found', fix: 'Add the app settings under `expo`.', effort: 'small' }] : [];
  const remote = readJson(root, 'eas.json')?.cli?.appVersionSource === 'remote';
  const missing = [['name', app.name], ['version', app.version], ['ios.bundleIdentifier', app.ios?.bundleIdentifier], ['icon', app.icon ?? app.ios?.icon], ['ios.buildNumber (or EAS remote versioning)', app.ios?.buildNumber ?? (remote || undefined)]].filter(([, v]) => !v).map(([k]) => k);
  return missing.length ? [{ where: s.appConfig, what: `Missing: ${missing.join(', ')}`, fix: 'Fill them in; the store needs each one.', effort: 'small' }] : [];
};

const permissions = (root, s) => {
  const app = readJson(root, s.appConfig)?.expo;
  const deps = readJson(root, 'package.json')?.dependencies ?? {};
  if (!app) return [];
  const plist = app.ios?.infoPlist ?? {};
  const options = (app.plugins ?? []).filter(Array.isArray).map(([name, opts]) => [name, opts ?? {}]);
  const out = [];
  for (const [pkg, [option, key]] of Object.entries(NEEDS_REASON)) {
    if (!deps[pkg]) continue;
    const given = plist[key] ?? options.find(([n]) => n === pkg)?.[1][option];
    if (typeof given !== 'string' || !given.trim()) out.push({ where: s.appConfig, what: `${pkg} is used but no reason text is set (${option} / ${key})`, fix: `Write one plain sentence saying why the app needs it, as ${option} on the ${pkg} plugin.`, effort: 'small' });
    else if (PLACEHOLDER.test(given)) out.push({ where: s.appConfig, what: `The reason text for ${pkg} is a default or placeholder: "${given.slice(0, 50)}"`, fix: 'Replace it with a specific sentence about this app. Generic text is a common rejection reason.', effort: 'small' });
  }
  return out;
};

const tracked = (root) => {
  const { ok, out } = run('git ls-files', root);
  if (!ok) return [];
  return out.split('\n').filter((f) => SECRET_FILE.some((re) => re.test(f))).map((f) => ({ where: f, what: 'A file that usually holds secrets is tracked by git', fix: 'Remove it from git (`git rm --cached`), add it to .gitignore, and change anything it contained.', effort: 'medium' }));
};

const privacy = (root, s) => {
  if (!s.privacyFile || !existsSync(join(root, s.privacyFile))) return s.privacyFile ? [{ where: s.privacyFile, what: 'The privacy policy file was not found', fix: 'Point `release.privacyFile` at it, or add one.', effort: 'medium' }] : [];
  const text = readFileSync(join(root, s.privacyFile), 'utf8');
  const deps = readJson(root, 'package.json')?.dependencies ?? {};
  return Object.entries(MUST_MENTION).filter(([pkg, [re]]) => deps[pkg] && !re.test(text)).map(([, [, topic]]) => ({ where: s.privacyFile, what: `The app uses ${topic}, but the privacy policy does not mention it`, fix: `Add a sentence on what is collected through ${topic} and why. Update the App Store privacy answers to match.`, effort: 'small' }));
};

const PIN = /^https:\/\/codeload\.github\.com\/([^/]+)\/([^/]+)\/tar\.gz\/([0-9a-f]{7,40})$/;
const semver = (tag) => (/^v?(\d+)\.(\d+)\.(\d+)$/.exec(tag) ?? []).slice(1).map(Number);
const newer = (a, b) => { const x = semver(a); const y = semver(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]; return false; };

/** Tags of a remote repository as { tag: commit }. Returns null when the remote cannot be reached. */
const remoteTags = (url, root) => {
  const { ok, out } = run(`git ls-remote --tags "${url}"`, root);
  if (!ok) return null;
  const tags = {};
  for (const line of out.split('\n')) {
    const m = /^([0-9a-f]{40})\s+refs\/tags\/(.+?)(\^\{\})?$/.exec(line.trim());
    if (m && (m[3] || !tags[m[2]])) tags[m[2]] = m[1];
  }
  return tags;
};

/** Shared kits pinned by commit: the labels in `kitVersions` should agree with the pins, and (when asked) with the remote tags. Advisory. */
const kits = (root, s) => {
  const pkg = readJson(root, 'package.json');
  if (!pkg) return [];
  const pins = Object.entries({ ...pkg.dependencies, ...pkg.devDependencies }).map(([name, url]) => [name, PIN.exec(String(url))]).filter(([, m]) => m).map(([name, m]) => ({ name, owner: m[1], repo: m[2], sha: m[3] }));
  if (!pins.length) return [];
  const labels = pkg.kitVersions ?? {};
  const row = (what, fix) => ({ where: 'package.json', what, fix, effort: 'small' });
  const out = [];
  for (const p of pins) if (!labels[p.name]) out.push(row(`${p.name} is pinned to commit ${p.sha.slice(0, 7)} but \`kitVersions\` does not say which version that is`, `Add "${p.name}": "<tag>" to \`kitVersions\`, so a reader can tell what is installed.`));
  for (const name of Object.keys(labels)) if (!pins.some((p) => p.name === name)) out.push(row(`\`kitVersions\` lists ${name}, but no dependency pins it by commit`, 'Remove the label, or pin the dependency again.'));
  if (!s.kitsOnline) return out;
  for (const p of pins) {
    const label = labels[p.name];
    const tags = remoteTags(s.kitsRemote.replace('{owner}', p.owner).replace('{repo}', p.repo), root);
    if (!tags) { out.push(row(`Could not reach ${p.owner}/${p.repo} to compare tags`, 'Check the network, then run the check again.')); continue; }
    if (label && !tags[label]) out.push(row(`${p.name} is labelled ${label}, but that tag does not exist on the remote`, 'Fix the label, or create the tag.'));
    else if (label && !tags[label].startsWith(p.sha.slice(0, 7)) && !p.sha.startsWith(tags[label].slice(0, p.sha.length))) out.push(row(`${p.name} is labelled ${label}, but the pinned commit ${p.sha.slice(0, 7)} is not the commit of that tag`, 'Pin the tag\'s commit, or correct the label.'));
    const latest = Object.keys(tags).filter((t) => semver(t).length).sort((a, b) => (newer(a, b) ? -1 : 1))[0];
    if (label && latest && newer(latest, label)) out.push(row(`${p.name} ${latest} exists; the app is on ${label}`, 'Upgrade when you are ready; read the changelog first.'));
  }
  return out;
};

export function runRelease(config, root) {
  const s = { ...DEFAULTS, ...config.release };
  const found = { lockfile: lockfile(root, s), appConfig: appConfig(root, s), permissions: permissions(root, s), tracked: tracked(root), privacy: privacy(root, s), kits: kits(root, s) };
  for (const rows of Object.values(found)) for (const f of rows) f.places ??= [{ file: f.where, from: 1 }];
  return { ...assemble(CHECKS, found, s.gate), settings: s };
}
