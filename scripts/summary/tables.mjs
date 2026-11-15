// What the summary says, once: the tables, notes and labels. markdown.mjs and html.mjs only format this.
import { PROOF, plainLine } from './model.mjs';

export const COUNT_LABELS = [['Must fix before release', 'mustFix'], ['Failed test runs', 'failedRuns'], ['Blocker', 'Blocker'], ['High', 'High'], ['Medium', 'Medium'], ['Low', 'Low']];
export const VERDICT_NOTE = 'Not ready if any item must be fixed (a failed gated check or a Blocker) or a test run failed. Incomplete if a check area did not run. Ready after fixes if High items remain. Ready otherwise.';
export const DECISION_NOTE = 'Mark the last column and send it back; nothing is changed until you do.';
const EMPTY = { fixFirst: 'Nothing to fix.', decisions: 'None found.', area: 'None found.', terms: 'None.' };

export const countRows = (m) => COUNT_LABELS.map(([label, key]) => [label, m.counts[key]]);

/** Every table of the report, in order: `{ id, title, note?, head, rows, empty }`. Area tables follow the decisions. */
export function sections(m) {
  return {
    fixFirst: { title: 'Fix first', head: ['#', 'What could go wrong', 'Where', 'Effort'], rows: m.fixFirst.map((r) => [r.n, plainLine(r), r.where, r.effort]), empty: EMPTY.fixFirst },
    decisions: { title: 'Your decisions', note: DECISION_NOTE, head: ['#', 'Level', 'What it means', 'Why it matters', 'Suggested fix', 'Effort', 'Proof', ...(m.compared ? ['Since last run'] : []), 'Your decision'], rows: m.rows.map((r) => [r.n, r.severity, `${r.meaning} (${r.where})`, r.impact, r.fix, r.effort, PROOF[r.proof], ...(m.compared ? [r.status] : []), '']), empty: EMPTY.decisions },
    results: { title: 'Test results', note: 'The test runs behind this review. A pass here means the run passed, not that the code has no bugs.', head: ['Run', 'Result', 'Detail'], rows: m.results.map((r) => [r.name, r.result === 'fail' ? 'Fail' : 'Pass', r.detail]), empty: 'No test runs were recorded. Pass them with --extra (results).' },
    fixed: { title: 'Fixed since last run', note: 'In the previous summary, gone now.', head: ['Area', 'Where', 'What it was'], rows: m.fixed.map((f) => [f.area, f.where, f.meaning]), empty: '' },
    areas: m.areas.map((a) => ({ title: a.title, head: ['#', 'Where', 'What (technical)', 'Trigger'], rows: a.rows.map((r) => [r.n, r.where, r.technical, r.trigger || '-']), empty: EMPTY.area })),
    accepted: { title: 'Accepted earlier', note: 'Accepted in review.accepted.json. They do not count, and stay listed so nothing is hidden.', head: ['Area', 'Where', 'What', 'Reason', 'Accepted on'], rows: m.accepted.map((a) => [a.area, a.where, a.what, a.reason, a.date]), empty: '' },
    stale: { title: 'Accepted entries that match nothing', note: 'The code changed, so these cover no row now. Remove them from review.accepted.json.', head: ['Area', 'Check', 'File', 'Reason'], rows: m.stale.map((e) => [e.area, e.check, e.file, e.reason]), empty: '' },
    terms: { title: 'Terms used', head: ['Term', 'Meaning'], rows: m.terms.map((x) => [x.term, x.meaning]), empty: EMPTY.terms },
  };
}
