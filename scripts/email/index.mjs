// Email the report: who may receive it, who gets it this time, and the message itself.
// The kit never sends mail. It writes a hand-off file (to, subject, body, htmlBody, attachments) that the assistant sends
// with the owner's mail connector (for example Gmail). Real addresses live only in a local file kept out of git.
import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { basename, join, relative, resolve, isAbsolute } from 'node:path';
import { ConfigError } from '../lib/findings.mjs';

export const DEFAULT_ADDRESSES_FILE = 'review.email.json';
const EMAIL = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:"]+$/;
const norm = (a) => a.trim().toLowerCase();

/** The `email` block with its defaults, or null when emailing is off. */
export function emailSettings(config) {
  const e = config.email;
  if (!e || e.enabled === false) return null;
  return { addressesFile: e.addressesFile ?? DEFAULT_ADDRESSES_FILE, attach: e.attach ?? ['summary.html'], send: e.send ?? 'always', subjectPrefix: e.subjectPrefix ?? 'Code review' };
}

/** Is `file` tracked by git, and is it ignored? Outside a git work tree, or with no git installed, both are false and `git` is false. */
export function gitStatus(root, file, git = 'git') {
  const run = (...a) => spawnSync(git, a, { cwd: root, encoding: 'utf8' });
  const inside = run('rev-parse', '--is-inside-work-tree');
  // With git missing, spawnSync gives an error and no output instead of throwing.
  if (inside.error || String(inside.stdout ?? '').trim() !== 'true') return { git: false, tracked: false, ignored: false };
  return { git: true, tracked: run('ls-files', '--error-unmatch', file).status === 0, ignored: run('check-ignore', '-q', file).status === 0 };
}

/**
 * Reads the local addresses file: `{ "main": "you@example.com", "allowed": ["you@example.com", "teammate@example.com"] }`.
 * `main` is always allowed. Any number of allowed addresses. Stops when the file is committed to git, so a public repo never carries them.
 */
export function loadRecipients(root, settings) {
  const path = join(root, settings.addressesFile);
  if (!existsSync(path)) throw new ConfigError(`Email is on but ${settings.addressesFile} is missing. Copy templates/review.email.example.json to ${settings.addressesFile}, fill in the addresses, and keep it out of git.`);
  const git = gitStatus(root, settings.addressesFile);
  if (git.tracked) throw new ConfigError(`${settings.addressesFile} is committed to git, so anyone who can read the repository sees the addresses. Run "git rm --cached ${settings.addressesFile}", add it to .gitignore, and commit that.`);
  let data;
  try {
    data = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    throw new ConfigError(`${settings.addressesFile} is not valid JSON: ${e.message}`);
  }
  const main = typeof data.main === 'string' ? data.main.trim() : '';
  if (!EMAIL.test(main)) throw new ConfigError(`${settings.addressesFile} needs "main": one email address that gets every report.`);
  const listed = Array.isArray(data.allowed) ? data.allowed : [];
  const bad = listed.filter((a) => typeof a !== 'string' || !EMAIL.test(a.trim()));
  if (bad.length) throw new ConfigError(`${settings.addressesFile} has entries in "allowed" that are not email addresses: ${bad.map(String).join(', ')}.`);
  const byKey = new Map();
  for (const a of [main, ...listed.map((x) => x.trim())]) if (!byKey.has(norm(a))) byKey.set(norm(a), a);
  const allowed = [...byKey.values()];
  return { main, allowed, warning: git.git && !git.ignored ? `${settings.addressesFile} is not in .gitignore yet. Add it so it can never be committed.` : null };
}

/**
 * Who gets this report. No ask: the main address. "all": every allowed address. Otherwise a comma-separated list,
 * each of which must be on the allowed list; any other address stops the run and nothing is sent.
 */
export function pickRecipients(recipients, ask) {
  if (!ask || norm(ask) === 'main') return [recipients.main];
  if (norm(ask) === 'all') return recipients.allowed;
  const byKey = new Map(recipients.allowed.map((a) => [norm(a), a]));
  const wanted = ask.split(',').map((a) => a.trim()).filter(Boolean);
  const refused = wanted.filter((a) => !byKey.has(norm(a)));
  if (refused.length) throw new ConfigError(`Not on the allowed list, so nothing was prepared: ${refused.join(', ')}. Add an address to the addresses file first if it should get reports.`);
  return [...new Set(wanted.map((a) => byKey.get(norm(a))))];
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const COLORS = { ready: '#1f7a4d', after: '#9a6700', incomplete: '#6e7781', not: '#b42318' };

/** Subject, plain body and HTML body from the summary's --json output. */
export function buildMessage(model, settings, { date = new Date().toISOString().slice(0, 10) } = {}) {
  const c = model.counts ?? {};
  const tally = ['Blocker', 'High', 'Medium', 'Low'].map((s) => `${c[s] ?? 0} ${s}`).join(', ');
  const subject = `${settings.subjectPrefix}: ${model.project} - ${model.verdict} (${date})`;
  const first = (model.fixFirst ?? []).slice(0, 5);
  const plain = [
    `${model.project}: ${model.verdict}`,
    model.verdictMeaning,
    '',
    `Findings: ${tally}${c.mustFix ? `. Must fix: ${c.mustFix}` : ''}.`,
    ...(first.length ? ['', 'Fix first:', ...first.map((r, i) => `${i + 1}. [${r.severity}] ${r.meaning} (${r.where.split(' | ')[0]})`)] : []),
    ...(model.notRun?.length ? ['', `Did not run: ${model.notRun.join(', ')}.`] : []),
    '',
    settings.attach.length ? `The full report is attached (${settings.attach.join(', ')}).` : '',
    `review-kit ${model.kitVersion}`,
  ].join('\n');
  const color = COLORS[model.verdictKey] ?? '#24292f';
  const html = `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#24292f;max-width:640px">
<p style="margin:0 0 4px;color:#6e7781;font-size:13px">${esc(settings.subjectPrefix)} · ${esc(date)}</p>
<h1 style="margin:0 0 8px;font-size:22px">${esc(model.project)}: <span style="color:${color}">${esc(model.verdict)}</span></h1>
<p style="margin:0 0 16px">${esc(model.verdictMeaning)}</p>
<p style="margin:0 0 16px"><b>Findings:</b> ${esc(tally)}${c.mustFix ? `. <b>Must fix: ${c.mustFix}</b>` : ''}.</p>
${first.length ? `<h2 style="font-size:16px;margin:0 0 8px">Fix first</h2><ol style="margin:0 0 16px;padding-left:20px">${first.map((r) => `<li style="margin-bottom:6px"><b>${esc(r.severity)}</b>: ${esc(r.meaning)}<br><span style="color:#6e7781;font-size:13px">${esc(r.where.split(' | ')[0])}</span></li>`).join('')}</ol>` : ''}
${model.notRun?.length ? `<p style="margin:0 0 16px"><b>Did not run:</b> ${esc(model.notRun.join(', '))}.</p>` : ''}
${settings.attach.length ? `<p style="margin:0 0 16px">The full report is attached.</p>` : ''}
<p style="margin:24px 0 0;color:#8c959f;font-size:12px">review-kit ${esc(model.kitVersion)}</p>
</div>`;
  return { subject, body: plain, htmlBody: html };
}

/** Files that must never leave the machine, whatever the attach list says: the addresses file and every .env file. */
const PRIVATE = (name, settings) => /^\.env(\..*)?$/i.test(name) || name === basename(settings.addressesFile) || name === DEFAULT_ADDRESSES_FILE;

/**
 * The attachments that exist, as absolute paths, and the ones that are missing. A path outside the project, the addresses file
 * or an .env file stops the run: a careless attach list must not mail a local secrets file.
 */
export function attachments(root, settings) {
  for (const f of settings.attach) {
    const rel = relative(resolve(root), resolve(root, f));
    if (rel.startsWith('..') || isAbsolute(rel)) throw new ConfigError(`email.attach: ${f} is outside the project. Attach only the report files the review writes (summary.html).`);
    if (PRIVATE(basename(f), settings)) throw new ConfigError(`email.attach: ${f} holds private settings or addresses and is never attached.`);
  }
  const all = settings.attach.map((f) => ({ name: f, path: resolve(root, f) }));
  return { found: all.filter((a) => existsSync(a.path)), missing: all.filter((a) => !existsSync(a.path)).map((a) => a.name) };
}
