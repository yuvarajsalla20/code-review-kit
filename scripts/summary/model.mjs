// Turns script findings (and the owner's verified extras) into one ranked set of rows, a verdict and a glossary.
import { ConfigError } from '../lib/findings.mjs';
import { AREA_TITLES, COULD_NOT, GATED, PLAIN } from './plain.mjs';

const SEVERITY = ['Blocker', 'High', 'Medium', 'Low'];
const EFFORT = ['small', 'medium', 'large'];
/** One line for a reader: what it is, then what it costs. Each part's own closing period is dropped first, so no part ends in "..". */
export const plainLine = (r) => {
  const parts = [r.meaning, r.impact].map((s) => String(s ?? '').trim().replace(/\.+$/, '')).filter(Boolean);
  return parts.length ? `${parts.join('. ')}.` : '';
};
export const keyOf = (area, check, where) => `${area}:${check}|${where}`;
/** The same row across runs: line numbers move when code above changes, so they are left out. */
export const stableKey = (key) => String(key).replace(/:\d+(-\d+)?$/, '');

/** How a row was shown to be real. Script rows are text matches until a reviewer opens them. */
export const PROOF = {
  script: 'Script match, not yet opened',
  code: 'Read in the code',
  test: 'Shown by a test',
  device: 'Needs a device to confirm',
  unverified: 'Not confirmed',
};
/** A row nobody confirmed says so, never "Read in the code": a missing or unknown proof is unverified. */
const proofOf = (p) => (PROOF[String(p ?? '').toLowerCase()] ? String(p).toLowerCase() : 'unverified');
/** The Proof cell: an unverified row also says what would confirm it (`confirm`), when the reviewer gave it. */
export const proofText = (r) => (r.proof === 'unverified' ? `${PROOF.unverified}: ${r.confirm || 'no one has checked it yet'}` : PROOF[r.proof]);

const SEVERITY_OF = Object.fromEntries(SEVERITY.map((s) => [s.toLowerCase(), s]));
const RESULT_OF = { pass: 'pass', passed: 'pass', fail: 'fail', failed: 'fail', error: 'fail' };
/** `run`: a test run behind the review (unit, integration, load); a failure blocks. `probe`: a reviewer's check for one bug; it never counts as a failed run. */
export const RESULT_KINDS = ['run', 'probe'];

/**
 * Checks and tidies one hand-off file (`name` says which, for the message). Levels and results are read whatever their case;
 * anything else stops the summary with the file and the row, because a typo must never turn a failing review into Ready.
 */
export function checkExtra(extra, name = 'the hand-off file') {
  if (!extra || typeof extra !== 'object' || Array.isArray(extra)) throw new ConfigError(`${name}: must be one JSON object ({ "add": [...], "results": [...] }).`);
  const level = (value, at, required) => {
    if (value === undefined && !required) return undefined;
    const s = SEVERITY_OF[String(value ?? '').trim().toLowerCase()];
    if (!s) throw new ConfigError(`${name}, ${at}: severity ${value === undefined ? 'is missing' : `"${value}" is not a level`}. Use ${SEVERITY.join(', ')}.`);
    return s;
  };
  for (const key of ['add', 'results', 'drop', 'couldNot']) if (extra[key] !== undefined && !Array.isArray(extra[key])) throw new ConfigError(`${name}: "${key}" must be a list.`);
  const add = extra.add?.map((a, i) => {
    const at = `add row ${i + 1}${a?.where ? ` (${a.where})` : ''}`;
    if (!a || typeof a !== 'object') throw new ConfigError(`${name}, ${at}: must be an object.`);
    for (const k of ['area', 'where']) if (typeof a[k] !== 'string' || !a[k].trim()) throw new ConfigError(`${name}, ${at}: "${k}" is required.`);
    return { ...a, severity: level(a.severity, at, true), proof: proofOf(a.proof) };
  });
  const override = extra.override && Object.fromEntries(Object.entries(extra.override).map(([key, o]) => [key, { ...o, ...(o?.severity !== undefined ? { severity: level(o.severity, `override "${key}"`) } : {}), ...(o?.proof !== undefined ? { proof: proofOf(o.proof) } : {}) }]));
  const results = extra.results?.map((r, i) => {
    const at = `results entry ${i + 1}${r?.name ? ` ("${r.name}")` : ''}`;
    const result = RESULT_OF[String(r?.result ?? '').trim().toLowerCase()];
    if (!result) throw new ConfigError(`${name}, ${at}: result ${r?.result === undefined ? 'is missing' : `"${r.result}" is not pass or fail`}. Use "pass" or "fail".`);
    const kind = String(r.kind ?? 'run').trim().toLowerCase();
    if (!RESULT_KINDS.includes(kind)) throw new ConfigError(`${name}, ${at}: kind "${r.kind}" is not ${RESULT_KINDS.join(' or ')}.`);
    return { ...r, result, kind };
  });
  return { ...extra, ...(add ? { add } : {}), ...(override ? { override } : {}), ...(results ? { results } : {}) };
}

const fromScript = ({ area, result }) =>
  result.findings.map((f) => {
    const p = PLAIN[area]?.[f.check] ?? PLAIN[area]?.['*'] ?? { meaning: f.what, impact: '' };
    const technical = PLAIN[area]?.[f.check] || !PLAIN[area]?.['*'] ? f.what : `${f.check}: ${f.what}`;
    return { area, check: f.check, key: keyOf(area, f.check, f.where), severity: f.gate ? 'High' : p.level ?? 'Medium', mustFix: !!f.gate, proof: 'script', meaning: p.meaning, impact: p.impact, where: f.where, technical, subject: f.subject, trigger: '', fix: f.fix, effort: f.effort ?? 'medium', term: p.term };
  });

/**
 * `extra`: `{ drop: [keys], dropReasons: { key: why }, override: { key: {...fields} }, add: [{ area, severity, where, what, meaning, impact, fix, effort, trigger, proof, confirm }], couldNot: [text] }`,
 * written after the agents verified the rows. `drop` is only for rows shown not real; a row nobody could confirm gets `proof: "unverified"`.
 */
/** Who verified the rows: `extra.verifiedBy` is 'agents' (separate reviewer agents), 'inline' (the assistant read them itself) or absent. */
export const VERIFIED_TEXT = {
  agents: 'Verified by separate reviewer agents.',
  inline: 'Self-review: the same assistant that ran the checks read the rows; no separate reviewer agent did.',
  none: 'Not run: these are script findings only. No agent has read the code.',
};
export const verification = (extra) => VERIFIED_TEXT[extra?.verifiedBy] ? extra.verifiedBy : 'none';

/**
 * `notRun`: areas that apply but have no config block, so the verdict cannot be Ready. `previous`: the `--json` output of an
 * earlier summary, so each row says New or Still open and rows that are gone are listed as fixed.
 * `extra.results`: `[{ name, result: 'pass'|'fail', kind: 'run'|'probe', detail }]`: the test runs behind the review (unit, integration, load),
 * and reviewers' probes (a script that shows one bug), which are listed apart and never count as failed runs.
 */
export function buildModel(collected, extraIn = {}, { now = new Date(), timeZone = 'UTC', project = '', kitVersion = '', notRun = [], previous = null } = {}) {
  const extra = checkExtra(extraIn, 'the --extra files');
  const drop = new Set(extra.drop ?? []);
  const all = collected.flatMap(fromScript);
  // A dropped row leaves the tables but not the report: it is listed with the reviewer's reason, so a gated row cannot vanish unseen.
  const dropped = all.filter((r) => drop.has(r.key)).map((r) => ({ key: r.key, area: r.area, where: r.where, meaning: r.meaning, mustFix: r.mustFix, reason: String(extra.dropReasons?.[r.key] ?? '').trim() || 'No reason given' }));
  const scripted = all.filter((r) => !drop.has(r.key)).map((r) => ({ ...r, ...(extra.override?.[r.key] ?? {}) }));
  const added = (extra.add ?? []).map((a) => ({ check: 'agent', key: keyOf(a.area, 'agent', a.where), trigger: '', meaning: a.meaning ?? a.what, impact: a.impact ?? '', technical: a.what ?? a.meaning ?? '', effort: 'medium', ...a }));
  const before = new Set((previous?.rows ?? []).map((r) => stableKey(r.key)));
  const rows = [...scripted, ...added]
    .map((r) => ({ ...r, mustFix: r.mustFix || r.severity === 'Blocker', proof: PROOF[r.proof] ? r.proof : r.check === 'agent' ? 'unverified' : 'script', status: previous ? (before.has(stableKey(r.key)) ? 'Still open' : 'New') : '' }))
    .sort((a, b) => b.mustFix - a.mustFix || SEVERITY.indexOf(a.severity) - SEVERITY.indexOf(b.severity) || EFFORT.indexOf(a.effort) - EFFORT.indexOf(b.effort))
    .map((r, i) => ({ ...r, n: i + 1 }));

  const count = (s) => rows.filter((r) => r.severity === s).length;
  const mustFix = rows.filter((r) => r.mustFix).length;
  const checkedResults = (extra.results ?? []).map((r) => ({ name: String(r.name ?? ''), result: r.result, kind: r.kind, detail: String(r.detail ?? '') }));
  const results = checkedResults.filter((r) => r.kind === 'run');
  const probes = checkedResults.filter((r) => r.kind === 'probe');
  const failedRuns = results.filter((r) => r.result === 'fail').length;
  const verdictKey = mustFix || failedRuns ? 'not' : notRun.length ? 'incomplete' : count('High') ? 'after' : 'ready';
  const verdict = { not: 'Not ready', incomplete: 'Incomplete', after: 'Ready after fixes', ready: 'Ready' }[verdictKey];
  const now_ = new Set(rows.map((r) => stableKey(r.key)));
  const fixed = (previous?.rows ?? []).filter((r) => !now_.has(stableKey(r.key))).map((r) => ({ area: r.area, where: r.where, meaning: r.meaning }));

  const terms = [...new Map([...(mustFix && rows.some((r) => r.mustFix && r.check !== 'agent') ? [GATED] : []), ...rows.map((r) => r.term).filter(Boolean)].map((x) => [x.term, x])).values()];
  const accepted = collected.flatMap((c) => (c.result.accepted ?? []).map((f) => ({ area: c.area, where: f.where, what: f.what, reason: f.reason, date: f.date })));
  const stale = collected.flatMap((c) => (c.result.stale ?? []).map((e) => ({ area: c.area, check: e.check, file: e.file, reason: e.reason })));
  const areas = [...new Set([...collected.map((c) => c.area), ...rows.map((r) => r.area)])];
  const meaning = { not: failedRuns && !mustFix ? `${failedRuns} test run${failedRuns > 1 ? 's' : ''} failed (see Test results). Fix ${failedRuns > 1 ? 'them' : 'it'} before releasing.` : 'Fix or accept the must-fix items before releasing.', incomplete: `Some checks did not run (${notRun.join(', ')}), so this is not a pass. Add their blocks, or skip them on purpose with a reason.`, after: 'Nothing blocks the release, but the High items are worth fixing first.', ready: 'Nothing blocks the release.' }[verdictKey];
  const stamp = new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(now);
  return {
    verifiedBy: verification(extra), verification: VERIFIED_TEXT[verification(extra)],
    project, kitVersion, checked: collected.map((c) => c.area), verdict, verdictKey, verdictMeaning: meaning,
    counts: { mustFix, failedRuns, ...Object.fromEntries(SEVERITY.map((s) => [s, count(s)])) },
    rows, fixFirst: rows.slice(0, 5), terms, accepted, stale, notRun, fixed, results, probes, dropped, compared: !!previous,
    areas: areas.map((area) => ({ area, title: AREA_TITLES[area] ?? area, rows: rows.filter((r) => r.area === area) })),
    couldNot: [...areas.map((a) => COULD_NOT[a]).filter(Boolean), ...(extra.couldNot ?? [])],
    footer: `Version ${kitVersion} - ${stamp}`,
  };
}

/** Several --extra files as one: lists are joined, `override` maps merged, the first `verifiedBy` wins. */
export function mergeExtras(extras) {
  const out = {};
  for (const e of extras) {
    for (const [k, v] of Object.entries(e)) {
      if (Array.isArray(v)) out[k] = [...(out[k] ?? []), ...v];
      else if (v && typeof v === 'object') out[k] = { ...(out[k] ?? {}), ...v };
      else out[k] ??= v;
    }
  }
  return out;
}
