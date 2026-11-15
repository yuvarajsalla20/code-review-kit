// Release readiness checks: things that fail a build or a store review, found before you submit.
// Findings have the same shape as the structure checks: { check, gate, where, what, fix, effort }.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assemble } from '../lib/findings.mjs';
import { SOURCE, listFiles, readText } from '../lib/files.mjs';
import { lineFinder, stripComments } from '../lib/source.mjs';

export const CHECKS = ['lockfile', 'appConfig', 'permissions', 'permissionUse', 'tracked', 'privacy', 'kits', 'kitTests', 'storeKeys'];
const DEFAULTS = {
  appConfig: 'app.json', privacyFile: null, kitsOnline: false, kitsRemote: 'https://github.com/{owner}/{repo}.git', lockfileCommand: 'npm ci --dry-run --ignore-scripts',
  sourceRoots: ['src', 'App.tsx', 'app'], keyPrefixes: {}, productionProfiles: ['production'],
  gate: ['lockfile', 'appConfig', 'permissions', 'tracked', 'storeKeys'],
};

/** Packages that need a written reason before the store accepts the app: package, the plugin options and plist keys that carry it. */
const NEEDS_REASON = {
  'expo-location': ['locationWhenInUsePermission', 'NSLocationWhenInUseUsageDescription'],
  'expo-image-picker': ['photosPermission', 'NSPhotoLibraryUsageDescription'],
  'expo-camera': ['cameraPermission', 'NSCameraUsageDescription'],
  'expo-contacts': ['contactsPermission', 'NSContactsUsageDescription'],
  'expo-av': ['microphonePermission', 'NSMicrophoneUsageDescription'],
};
/** The calls that use each permission, to set beside its reason text. */
const PERMISSION_CALLS = {
  'expo-location': /\b(getCurrentPositionAsync|getLastKnownPositionAsync|watchPositionAsync|reverseGeocodeAsync|geocodeAsync|startLocationUpdatesAsync)\s*\(/,
  'expo-image-picker': /\b(launchImageLibraryAsync|launchCameraAsync)\s*\(/,
  'expo-camera': /<(CameraView|Camera)\b|\btakePictureAsync\s*\(/,
  'expo-contacts': /\b(getContactsAsync|presentContactPickerAsync)\s*\(/,
  'expo-av': /\bRecording\b|\bcreateAsync\s*\(/,
};
/** Words in a reason text that promise a narrow use. */
const NARROW = /\b(only|just|never|solely)\b/i;

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

/** The reason text the app gives for each sensitive package it depends on: [[package, option, plist key, text]]. */
const reasons = (root, s) => {
  const app = readJson(root, s.appConfig)?.expo;
  const deps = readJson(root, 'package.json')?.dependencies ?? {};
  if (!app) return [];
  const plist = app.ios?.infoPlist ?? {};
  const options = (app.plugins ?? []).filter(Array.isArray).map(([name, opts]) => [name, opts ?? {}]);
  return Object.entries(NEEDS_REASON).filter(([pkg]) => deps[pkg]).map(([pkg, [option, key]]) => [pkg, option, key, plist[key] ?? options.find(([n]) => n === pkg)?.[1][option]]);
};

const permissions = (root, s) => {
  const out = [];
  for (const [pkg, option, key, given] of reasons(root, s)) {
    if (typeof given !== 'string' || !given.trim()) out.push({ where: s.appConfig, what: `${pkg} is used but no reason text is set (${option} / ${key})`, fix: `Write one plain sentence saying why the app needs it, as ${option} on the ${pkg} plugin.`, effort: 'small' });
    else if (PLACEHOLDER.test(given)) out.push({ where: s.appConfig, what: `The reason text for ${pkg} is a default or placeholder: "${given.slice(0, 50)}"`, fix: 'Replace it with a specific sentence about this app. Generic text is a common rejection reason.', effort: 'small' });
  }
  return out;
};

/**
 * The reason text against the code: when a text promises a narrow use ("only when you tap Current") but the matching
 * calls sit in more than one file, the prompt may understate what the app does (App Review guideline 5.1.1). Review, not gate.
 */
const permissionUse = (root, s) => {
  const files = listFiles(root, s.sourceRoots, { match: SOURCE });
  const out = [];
  for (const [pkg, option, , given] of reasons(root, s)) {
    if (typeof given !== 'string' || !PERMISSION_CALLS[pkg] || !NARROW.test(given)) continue;
    const calls = new RegExp(PERMISSION_CALLS[pkg].source, 'g');
    const sites = files.flatMap((file) => {
      const text = stripComments(readText(root, file));
      const at = lineFinder(text);
      return [...text.matchAll(calls)].map((m) => ({ file, from: at(m.index), call: m[1] ?? m[0].trim() }));
    });
    if (sites.length < 2) continue;
    out.push({ where: s.appConfig, what: `The ${pkg} reason text promises a narrow use ("${given.slice(0, 70)}"), but the code uses it in ${sites.length} places: ${sites.map((x) => `${x.call} at ${x.file}:${x.from}`).join(', ')}`, fix: `Open each place and check the text covers it. If not, reword ${option} to name each use, and match the App Privacy answers.`, effort: 'small', places: sites.map(({ file, from }) => ({ file, from })) });
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

/** A dependency pinned to one commit: a codeload tarball, a git URL with `#<commit>`, or `github:owner/repo#<commit>`. */
const PINS = [
  /^https:\/\/codeload\.github\.com\/([^/]+)\/([^/]+)\/tar\.gz\/([0-9a-f]{7,40})$/,
  /^git\+(?:https|ssh):\/\/(?:git@)?github\.com[/:]([^/]+)\/([^/#]+?)(?:\.git)?#([0-9a-f]{7,40})$/,
  /^(?:github:)?([\w.-]+)\/([\w.-]+)#([0-9a-f]{7,40})$/,
];
const PIN = { exec: (url) => PINS.map((re) => re.exec(url)).find(Boolean) ?? null };
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

/** Packages whose version a kit should test against: the ones the app actually ships. */
const SHARED_RUNTIME = ['react', 'react-native', 'expo'];
const majorMinor = (v) => (/(\d+)\.(\d+)/.exec(String(v)) ?? []).slice(1, 3).join('.');

/** Each installed kit's own test setup against the app: a kit tested on React 18 can pass its tests and still break on the React 19 the app ships. */
const kitTests = (root) => {
  const pkg = readJson(root, 'package.json');
  if (!pkg) return [];
  const app = { ...pkg.devDependencies, ...pkg.dependencies };
  const out = [];
  for (const [name, url] of Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })) {
    if (!PIN.exec(String(url))) continue;
    const kit = readJson(root, `node_modules/${name}/package.json`);
    if (!kit) continue;
    const wrong = SHARED_RUNTIME.filter((dep) => kit.devDependencies?.[dep] && app[dep] && majorMinor(kit.devDependencies[dep]) !== majorMinor(app[dep]));
    if (wrong.length) out.push({ where: `node_modules/${name}/package.json`, what: `${name} runs its tests on ${wrong.map((d) => `${d} ${kit.devDependencies[d]}`).join(', ')}, but the app ships ${wrong.map((d) => `${d} ${app[d]}`).join(', ')}`, fix: `In the ${name} repository, set those devDependencies to the app's versions and run its tests again.`, effort: 'small' });
  }
  return out;
};

/**
 * Keys that must have a given prefix in a store build, e.g. `{ "EXPO_PUBLIC_RC_IOS_KEY": "appl_" }` so a RevenueCat test key never ships.
 * A wrong value in eas.json or a tracked .env file fails (gate). When the production value is not in the repository, a build-time guard must exist:
 * some file under the source or scripts folders, or app.config, that names both the key and its prefix.
 */
const storeKeys = (root, s) => {
  const entries = Object.entries(s.keyPrefixes ?? {});
  if (!entries.length) return [];
  const eas = readJson(root, 'eas.json')?.build ?? {};
  const envFiles = ['.env', '.env.production', '.env.local'].filter((f) => existsSync(join(root, f)));
  const guardFiles = listFiles(root, [...s.sourceRoots, 'scripts', 'app.config.js', 'app.config.ts'], { match: SOURCE });
  const out = [];
  for (const [key, prefix] of entries) {
    const seen = [];
    for (const profile of s.productionProfiles) {
      const v = eas[profile]?.env?.[key];
      if (v !== undefined) seen.push([`eas.json build.${profile}.env`, String(v)]);
    }
    for (const f of envFiles) {
      const m = new RegExp(`^\\s*${key}\\s*=\\s*["']?([^"'\\s]*)`, 'm').exec(readText(root, f));
      if (m) seen.push([f, m[1]]);
    }
    for (const [where, value] of seen) if (!value.startsWith(prefix)) out.push({ where, what: `${key} is "${value.slice(0, 6)}…" here, but a store build needs it to start with "${prefix}"`, fix: `Set the production value to the ${prefix} key. A wrong key ships fake or broken purchases to real customers.`, effort: 'small' });
    const guarded = guardFiles.some((f) => { const t = readText(root, f); return t.includes(key) && t.includes(prefix); });
    if (!seen.length && !guarded) out.push({ where: 'eas.json', what: `The production value of ${key} is not in the repository (it lives in the build service), and no build step checks that it starts with "${prefix}"`, fix: `Add a check to the build config, e.g. in app.config.js: \`if (process.env.EAS_BUILD_PROFILE === 'production' && !process.env.${key}?.startsWith('${prefix}')) throw new Error('${key} must start with ${prefix}')\`.`, effort: 'small' });
  }
  return out;
};

export function runRelease(config, root) {
  const s = { ...DEFAULTS, ...config.release };
  const found = { lockfile: lockfile(root, s), appConfig: appConfig(root, s), permissions: permissions(root, s), permissionUse: permissionUse(root, s), tracked: tracked(root), privacy: privacy(root, s), kits: kits(root, s), kitTests: kitTests(root), storeKeys: storeKeys(root, s) };
  for (const rows of Object.values(found)) for (const f of rows) f.places ??= [{ file: f.where, from: 1 }];
  return { ...assemble(CHECKS, found, s.gate), settings: s };
}
