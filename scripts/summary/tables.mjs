// What the summary says, once: the tables, notes and labels. markdown.mjs and html.mjs only format this.
import { plainLine } from './model.mjs';

export const COUNT_LABELS = [['Must fix before release', 'mustFix'], ['Blocker', 'Blocker'], ['High', 'High'], ['Medium', 'Medium'], ['Low', 'Low']];
export const VERDICT_NOTE = 'Not ready if any item must be fixed (a failed gated check or a Blocker). Ready after fixes if High items remain. Ready otherwise.';
export const DECISION_NOTE = 'Mark the last column and send it back; nothing is changed until you do.';
const EMPTY = { fixFirst: 'Nothing to fix.', decisions: 'None found.', area: 'None found.', terms: 'None.' };

export const countRows = (m) => COUNT_LABELS.map(([label, key]) => [label, m.counts[key]]);

/** Every table of the report, in order: `{ id, title, note?, head, rows, empty }`. Area tables follow the decisions. */
export function sections(m) {
  return {
    fixFirst: { title: 'Fix first', head: ['#', 'What could go wrong', 'Where', 'Effort'], rows: m.fixFirst.map((r) => [r.n, plainLine(r), r.where, r.effort]), empty: EMPTY.fixFirst },
    decisions: { title: 'Your decisions', note: DECISION_NOTE, head: ['#', 'What it means', 'Why it matters', 'Suggested fix', 'Effort', 'Area', 'Your decision'], rows: m.rows.map((r) => [r.n, `${r.meaning} (${r.where})`, r.impact, r.fix, r.effort, r.area, '']), empty: EMPTY.decisions },
    areas: m.areas.map((a) => ({ title: a.title, head: ['#', 'Where', 'What (technical)', 'Trigger'], rows: a.rows.map((r) => [r.n, r.where, r.technical, r.trigger || '-']), empty: EMPTY.area })),
    terms: { title: 'Terms used', head: ['Term', 'Meaning'], rows: m.terms.map((x) => [x.term, x.meaning]), empty: EMPTY.terms },
  };
}
