// Turns script findings (and the owner's verified extras) into one ranked set of rows, a verdict and a glossary.
import { AREA_TITLES, COULD_NOT, GATED, PLAIN } from './plain.mjs';

const SEVERITY = ['Blocker', 'High', 'Medium', 'Low'];
const EFFORT = ['small', 'medium', 'large'];
/** One line for a reader: what it is, then what it costs. */
export const plainLine = (r) => [r.meaning, r.impact].filter(Boolean).join('. ').replace(/\.\.$/, '.');
export const keyOf = (area, check, where) => `${area}:${check}|${where}`;

const fromScript = ({ area, result }) =>
  result.findings.map((f) => {
    const p = PLAIN[area]?.[f.check] ?? { meaning: f.what, impact: '' };
    return { area, check: f.check, key: keyOf(area, f.check, f.where), severity: f.gate ? 'High' : 'Medium', mustFix: !!f.gate, meaning: p.meaning, impact: p.impact, where: f.where, technical: f.what, trigger: '', fix: f.fix, effort: f.effort ?? 'medium', term: p.term };
  });

/** `extra`: `{ drop: [keys], override: { key: {...fields} }, add: [{ area, severity, where, what, meaning, impact, fix, effort, trigger }], couldNot: [text] }`, written after the agents verified the rows. */
export function buildModel(collected, extra = {}, { now = new Date(), timeZone = 'UTC', project = '', kitVersion = '' } = {}) {
  const drop = new Set(extra.drop ?? []);
  const scripted = collected.flatMap(fromScript).filter((r) => !drop.has(r.key)).map((r) => ({ ...r, ...(extra.override?.[r.key] ?? {}) }));
  const added = (extra.add ?? []).map((a) => ({ check: 'agent', key: keyOf(a.area, 'agent', a.where), trigger: '', meaning: a.meaning ?? a.what, impact: a.impact ?? '', technical: a.what, effort: 'medium', ...a }));
  const rows = [...scripted, ...added]
    .map((r) => ({ ...r, mustFix: r.mustFix || r.severity === 'Blocker' }))
    .sort((a, b) => b.mustFix - a.mustFix || SEVERITY.indexOf(a.severity) - SEVERITY.indexOf(b.severity) || EFFORT.indexOf(a.effort) - EFFORT.indexOf(b.effort))
    .map((r, i) => ({ ...r, n: i + 1 }));

  const count = (s) => rows.filter((r) => r.severity === s).length;
  const mustFix = rows.filter((r) => r.mustFix).length;
  const verdictKey = mustFix ? 'not' : count('High') ? 'after' : 'ready';
  const verdict = { not: 'Not ready', after: 'Ready after fixes', ready: 'Ready' }[verdictKey];
  const terms = [...new Map([...(mustFix && rows.some((r) => r.mustFix && r.check !== 'agent') ? [GATED] : []), ...rows.map((r) => r.term).filter(Boolean)].map((x) => [x.term, x])).values()];
  const areas = [...new Set([...collected.map((c) => c.area), ...rows.map((r) => r.area)])];
  const meaning = { not: 'Fix or accept the must-fix items before releasing.', after: 'Nothing blocks the release, but the High items are worth fixing first.', ready: 'Nothing blocks the release.' }[verdictKey];
  const stamp = new Intl.DateTimeFormat('en-US', { timeZone, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(now);
  return {
    project, kitVersion, checked: collected.map((c) => c.area), verdict, verdictKey, verdictMeaning: meaning,
    counts: { mustFix, ...Object.fromEntries(SEVERITY.map((s) => [s, count(s)])) },
    rows, fixFirst: rows.slice(0, 5), terms,
    areas: areas.map((area) => ({ area, title: AREA_TITLES[area] ?? area, rows: rows.filter((r) => r.area === area) })),
    couldNot: [...areas.map((a) => COULD_NOT[a]).filter(Boolean), ...(extra.couldNot ?? [])],
    footer: `Version ${kitVersion} - ${stamp}`,
  };
}
