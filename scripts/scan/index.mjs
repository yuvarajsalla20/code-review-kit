// The secrets scan and the project's banned patterns (`forbidden`), as two check areas, so check.mjs and summary.mjs
// read the same rows and an owner can accept a known false alarm in review.accepted.json by file and `contains`.
// Every row gates: a leaked key or banned code makes the summary Not ready until it is fixed or accepted.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { ALWAYS_SKIP, REVIEW_OUTPUT, SOURCE, TEXT, toPosix, walk } from '../lib/files.mjs';
import { ConfigError, assemble } from '../lib/findings.mjs';
import { stripComments } from '../lib/source.mjs';

/** Files that can hold a secret: code and config text, every `.env*` file, shell scripts, keys and certificates, native and build settings. */
export const SECRET_FILES = /^\.env(\..+)?$|\.(ts|tsx|js|jsx|mjs|cjs|json|md|html|css|rules|ya?ml|env|txt|sh|bash|zsh|pem|p8|key|plist|xml|properties|gradle|kts|toml|ini|cfg|conf|swift|kt|java|m|py|rb)$/i;
/** Files whose values are written without quotes (`DB_PASSWORD=hunter2`). */
const BARE_VALUES = /^\.env(\..+)?$|\.(env|sh|bash|zsh|properties|ini|cfg|conf)$/i;

/** Formats that are a secret whatever they are called. */
const PROVIDER = [
  ['privateKey', 'private key block', /-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED |)PRIVATE KEY-----/],
  ['serviceAccount', 'service account key', /"private_key"\s*:/],
  ['awsKey', 'AWS access key', /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/],
  ['stripeKey', 'Stripe live key', /\b[sr]k_live_[0-9a-zA-Z]{10,}/],
  ['githubToken', 'GitHub token', /\bgh[pousr]_[A-Za-z0-9]{30,}|\bgithub_pat_[A-Za-z0-9_]{20,}/],
  ['slackToken', 'Slack token', /\bxox[abprs]-[A-Za-z0-9-]{10,}/],
];
export const SECRET_CHECKS = [...PROVIDER.map(([check]) => check), 'assignment'];
const LABELS = { ...Object.fromEntries(PROVIDER.map(([check, label]) => [check, label])), assignment: 'secret assignment' };

/** A name that says it holds a secret, then an optional closing quote (JSON keys), `:` or `=`, then a quoted value, or a bare one in .env-style files. */
const ASSIGNMENT = /([\w.-]*(?:secret|password|passwd|pwd|token|api[_-]?key|private[_-]?key|access[_-]?key)[\w.-]*)["']?\s*[:=]\s*(?:(["'`])([^"'`\s]*)\2|([^\s"'`#;,]+))/gi;

/** `${...}`, `<your key>`, `{{key}}`, process.env.X (braces written as \x7b \x7d so the size check's brace count stays right). */
/** A pattern, not a value: `.*`, `.+`, `\\d`. */
const REGEX_LIKE = /\.[*+]|\\[dwsb]/;
const PLACEHOLDER = /\$\x7b|^<.*>$|^\x7b\x7b.*\x7d\x7d$|^process\.env\b/;

/**
 * Whether a value looks like a real secret rather than a code, a label or a placeholder. Not secrets: error codes (letters split
 * by `/`, such as `auth/weak-password`), a short capitalised label (`Password`), the key's own name (`password: 'password'`),
 * URLs without a login, `${...}` templates, patterns (`.*[Pp]assword.*`) and runs of one character. Any other value of 8 or more
 * characters counts, letters-only ones too (`supersecretpassword`, `CorrectHorseBatteryStaple`); all digits needs 16 or more.
 */
const squash = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
/**
 * An error code (`auth/weak-password`), a short label (`Password`, `Passphrase`), the name of a setting (`FIREBASE_SERVICE_ACCOUNT`,
 * an environment variable named in docs), or the key's own name written as the value.
 */
const isCodeOrLabel = (value, key) =>
  /^[A-Za-z]+(?:[._:-][A-Za-z]+)*(?:\/[A-Za-z]+(?:[._:-][A-Za-z]+)*)+$/.test(value) || /^[A-Z][a-z]{7,11}$/.test(value) || /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/.test(value) || (!!key && squash(value) === squash(key));

export function looksSecret(value, key = '') {
  if (value.length < 8 || /\s/.test(value)) return false;
  if (isCodeOrLabel(value, key)) return false;
  if (/^[a-z][a-z0-9+.-]*:\/\/[^@]*$/i.test(value)) return false;
  if (PLACEHOLDER.test(value) || REGEX_LIKE.test(value)) return false;
  if (/^(.)\1+$/.test(value)) return false;
  return /[A-Za-z]/.test(value) || value.length >= 16;
}

const secretRow = (file, line, check, key) => ({
  where: `${file}:${line}`,
  what: `${LABELS[check]}${key ? ` (${key})` : ''}`,
  subject: key || LABELS[check],
  fix: 'Move it out of the code into an environment setting or secret store that is not committed, and replace the key: anyone who has seen the code has it.',
  effort: 'small',
  places: [{ file, from: line }],
});

/** The rows one line of one file gives. A line that holds a known format is not also reported as an assignment. */
export function secretsInLine(text, { bare = false } = {}) {
  const hits = PROVIDER.filter(([, , re]) => re.test(text)).map(([check]) => ({ check }));
  if (hits.length) return hits;
  for (const m of text.matchAll(ASSIGNMENT)) {
    // `cond ? 'newPassword' : 'password'` is a choice between two strings, not a key and its value.
    if (/\?\s*["'`]?$/.test(text.slice(0, m.index))) continue;
    const value = m[3] ?? (bare ? m[4] : undefined);
    if (value !== undefined && looksSecret(value, m[1])) return [{ check: 'assignment', key: m[1] }];
  }
  return [];
}

const settingsFor = (config) => {
  const s = config.secrets ?? {};
  const paths = s.paths ?? ['.'];
  const skip = s.skip ?? ALWAYS_SKIP;
  if (!Array.isArray(paths) || !paths.every((p) => typeof p === 'string')) throw new ConfigError('secrets.paths must be a list of folders or files, for example ["."].');
  if (!Array.isArray(skip) || !skip.every((p) => typeof p === 'string')) throw new ConfigError('secrets.skip must be a list of names or paths, for example ["node_modules", "src/theme.ts"].');
  // .git, node_modules and the review's own reports are never the project's own files, whatever the list says.
  return { paths, skip: [...new Set(['.git', 'node_modules', ...REVIEW_OUTPUT, ...skip])] };
};

/** Files under `bases` (folders or files, relative to `root`), with `skip` applied. A base that does not exist is a config problem. */
function filesUnder(root, bases, skip, match, label) {
  const out = [];
  for (const base of bases) {
    const start = join(root, base);
    if (!existsSync(start)) throw new ConfigError(`${label}: path not found: ${base} (check the spelling in review.config.json)`);
    const files = statSync(start).isDirectory() ? walk(start, skip, match, undefined, root) : [start];
    for (const file of files) out.push(toPosix(relative(root, file)));
  }
  return [...new Set(out)];
}

export function runSecrets(config, root) {
  const s = settingsFor(config);
  const files = filesUnder(root, s.paths, s.skip, SECRET_FILES, 'secrets.paths');
  const found = Object.fromEntries(SECRET_CHECKS.map((c) => [c, []]));
  for (const file of files) {
    const bare = BARE_VALUES.test(file.split('/').at(-1));
    readFileSync(join(root, file), 'utf8').split('\n').forEach((text, i) => {
      for (const hit of secretsInLine(text, { bare })) found[hit.check].push(secretRow(file, i + 1, hit.check, hit.key));
    });
  }
  return { ...assemble(SECRET_CHECKS, found, SECRET_CHECKS), files: files.length, settings: s };
}

/** The checked rules: each has a name and a pattern that compiles, so a typo stops the run with one clear line. */
export function forbiddenRules(config) {
  const rules = config.forbidden ?? [];
  if (!Array.isArray(rules)) throw new ConfigError('forbidden must be a list of rules: { "name", "pattern", "paths", "skip" }.');
  return rules.map((rule, i) => {
    const at = `forbidden rule ${i + 1}${rule?.name ? ` ("${rule.name}")` : ''}`;
    if (typeof rule?.name !== 'string' || !rule.name.trim()) throw new ConfigError(`${at}: "name" is required.`);
    if (typeof rule.pattern !== 'string' || !rule.pattern) throw new ConfigError(`${at}: "pattern" is required.`);
    let re;
    try {
      re = new RegExp(rule.pattern);
    } catch (e) {
      throw new ConfigError(`${at}: "${rule.pattern}" is not a valid pattern (${e.message.replace(/^Invalid regular expression: /, '')}).`);
    }
    let files = TEXT;
    if (rule.files !== undefined) {
      try {
        files = new RegExp(rule.files, 'i');
      } catch (e) {
        throw new ConfigError(`${at}: "files" ("${rule.files}") is not a valid pattern.`);
      }
    }
    return { name: rule.name, re, paths: rule.paths ?? ['.'], skip: [...ALWAYS_SKIP, ...(rule.skip ?? [])], files, comments: rule.comments !== false };
  });
}

/** The check names of the forbidden area are the owner's rule names. */
export const forbiddenChecks = (config) => (Array.isArray(config.forbidden) ? config.forbidden.map((r) => r?.name).filter((n) => typeof n === 'string') : []);

/**
 * Each rule's matches. `skip` (names or paths, as in secrets.skip) leaves out files a rule does not apply to, such as a CLI whose
 * console output is the point. `comments: false` reads code only (a commented-out console.log does not count); the default keeps
 * comments, because rules such as TODO/FIXME only ever match in them. `files` narrows which files a rule reads (default: text files).
 */
export function runForbidden(config, root) {
  const rules = forbiddenRules(config);
  const found = Object.fromEntries(rules.map((r) => [r.name, []]));
  const seen = new Set();
  for (const rule of rules) {
    for (const file of filesUnder(root, rule.paths, rule.skip, rule.files, `forbidden rule "${rule.name}"`)) {
      seen.add(file);
      const raw = readFileSync(join(root, file), 'utf8');
      const text = !rule.comments && SOURCE.test(file) ? stripComments(raw) : raw;
      const lines = raw.split('\n');
      text.split('\n').forEach((line, i) => {
        if (!rule.re.test(line)) return;
        const shown = lines[i].trim().slice(0, 100);
        found[rule.name].push({ where: `${file}:${i + 1}`, what: shown, subject: shown.slice(0, 60), fix: `Remove it, or if this file is meant to have it, add the file to the rule's "skip" list (or accept it in review.accepted.json).`, effort: 'small', places: [{ file, from: i + 1 }] });
      });
    }
  }
  const names = rules.map((r) => r.name);
  return { ...assemble(names, found, names), files: seen.size };
}
