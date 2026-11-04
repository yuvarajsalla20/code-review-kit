// Release readiness checks: things that fail a build or a store review, found before you submit.
// Findings have the same shape as the structure checks: { check, gate, where, what, fix, effort }.
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const CHECKS = ['lockfile', 'appConfig', 'permissions', 'tracked', 'privacy'];
const DEFAULTS = { appConfig: 'app.json', privacyFile: null, lockfileCommand: 'npm ci --dry-run --ignore-scripts', gate: ['lockfile', 'appConfig', 'permissions', 'tracked'] };

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

export function runRelease(config, root) {
  const s = { ...DEFAULTS, ...config.release };
  const gated = new Set(s.gate);
  const found = { lockfile: lockfile(root, s), appConfig: appConfig(root, s), permissions: permissions(root, s), tracked: tracked(root), privacy: privacy(root, s) };
  const findings = CHECKS.flatMap((check) => found[check].map((f) => ({ check, gate: gated.has(check), places: [{ file: f.where, from: 1 }], ...f })));
  return { findings, counts: Object.fromEntries(CHECKS.map((c) => [c, found[c].length])), gate: s.gate, settings: s };
}
