// Turns script findings (and the owner's verified extras) into one ranked set of rows, a verdict and a glossary.
import { AREA_TITLES, COULD_NOT, GATED, PLAIN } from './plain.mjs';

const SEVERITY = ['Blocker', 'High', 'Medium', 'Low'];
const EFFORT = ['small', 'medium', 'large'];
/** One line for a reader: what it is, then what it costs. */
export const plainLine = (r) => [r.meaning, r.impact].filter(Boolean).join('. ').replace(/\.\.$/, '.');
export const keyOf = (area, check, where) => `${area}:${check}|${where}`;
/** The same row across runs: line numbers move when code above changes, so they are left out. */
export const stableKey = (key) => String(key).replace(/:\d+(-\d+)?$/, '');

/** How a row was shown to be real. Script rows are text matches until a reviewer opens them. */
export const PROOF = {
  script: 'Script match, not yet opened',
  code: 'Read in the code',
  test: 'Shown by a test',
  device: 'Needs a device to confirm',
};
const proofOf = (p) => (PROOF[p] ? p : 'code');

const fromScript = ({ area, result }) =>
  result.findings.map((f) => {
    const p = PLAIN[area]?.[f.check] ?? { meaning: f.what, impact: '' };
    return { area, check: f.check, key: keyOf(area, f.check, f.where), severity: f.gate ? 'High' : p.level ?? 'Medium', mustFix: !!f.gate, proof: 'script', meaning: p.meaning, impact: p.impact, where: f.where, technical: f.what, trigger: '', fix: f.fix, effort: f.effort ?? 'medium', term: p.term };
  });

/** `extra`: `{ drop: [keys], override: { key: {...fields} }, add: [{ area, severity, where, what, meaning, impact, fix, effort, trigger }], couldNot: [text] }`, written after the agents verified the rows. */
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
 * `extra.results`: `[{ name, result: 'pass'|'fail', detail }]`, the test runs behind the review (unit, integration, load).
 */
export function buildModel(collected, extra = {}, { now = new Date(), timeZone = 'UTC', project = '', kitVersion = '', notRun = [], previous = null } = {}) {
  const drop = new Set(extra.drop ?? []);
  const scripted = collected.flatMap(fromScript).filter((r) => !drop.has(r.key)).map((r) => ({ ...r, ...(extra.override?.[r.key] ?? {}) }));
  const added = (extra.add ?? []).map((a) => ({ check: 'agent', key: keyOf(a.area, 'agent', a.where), trigger: '', meaning: a.meaning ?? a.what, impact: a.impact ?? '', technical: a.what, effort: 'medium', ...a, proof: proofOf(a.proof) }));
  const before = new Set((previous?.rows ?? []).map((r) => stableKey(r.key)));
  const rows = [...scripted, ...added]
    .map((r) => ({ ...r, mustFix: r.mustFix || r.severity === 'Blocker', proof: PROOF[r.proof] ? r.proof : 'script', status: previous ? (before.has(stableKey(r.key)) ? 'Still open' : 'New') : '' }))
    .sort((a, b) => b.mustFix - a.mustFix || SEVERITY.indexOf(a.severity) - SEVERITY.indexOf(b.severity) || EFFORT.indexOf(a.effort) - EFFORT.indexOf(b.effort))
    .map((r, i) => ({ ...r, n: i + 1 }));

  const count = (s) => rows.filter((r) => r.severity === s).length;
  const mustFix = rows.filter((r) => r.mustFix).length;
  const results = (extra.results ?? []).map((r) => ({ name: String(r.name ?? ''), result: r.result === 'fail' ? 'fail' : 'pass', detail: String(r.detail ?? '') }));
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
    rows, fixFirst: rows.slice(0, 5), terms, accepted, stale, notRun, fixed, results, compared: !!previous,
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
