// The owner's marks in the "Your decision" column, read back. Pure: no files.
import { fileOf } from '../lib/accepted.mjs';

const cells = (line) => line.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((c) => c.trim());

/** Rows of the "Your decisions" table as { n, decision }, read by the header names, so extra columns do not matter. */
export function readMarks(markdown) {
  const lines = markdown.split('\n');
  const start = lines.findIndex((l) => /^##\s+Your decisions/.test(l));
  if (start === -1) return [];
  const head = lines.slice(start).findIndex((l) => l.startsWith('|'));
  if (head === -1) return [];
  const header = cells(lines[start + head]);
  const nAt = header.indexOf('#');
  const dAt = header.indexOf('Your decision');
  const marks = [];
  for (const line of lines.slice(start + head + 2)) {
    if (!line.startsWith('|')) break;
    const c = cells(line);
    if (c[dAt]) marks.push({ n: Number(c[nAt]), decision: c[dAt] });
  }
  return marks;
}

/** Splits the marks into fix, later and accepted, and builds the accepted-file entries. A mark that is not understood is a problem, never a guess. */
export function decide(markdown, model, date) {
  const byN = new Map((model.rows ?? []).map((r) => [r.n, r]));
  const out = { fix: [], later: [], acceptedByAgent: [], entries: [], problems: [] };
  for (const { n, decision } of readMarks(markdown)) {
    const row = byN.get(n);
    if (!row) { out.problems.push(`#${n}: no such row in the summary JSON (was it from the same run?)`); continue; }
    const m = /^(fix|later|accept)\b\s*:?\s*(.*)$/i.exec(decision);
    if (!m) { out.problems.push(`#${n}: "${decision}" is not fix, later or "accept: <reason>"`); continue; }
    const kind = m[1].toLowerCase();
    if (kind !== 'accept') { out[kind].push(row); continue; }
    if (!m[2].trim()) { out.problems.push(`#${n}: an accept needs a reason ("accept: only wiring, nothing to test")`); continue; }
    if (row.check === 'agent') { out.acceptedByAgent.push(row); continue; }
    out.entries.push({ area: row.area, check: row.check, file: fileOf(row.where), reason: m[2].trim(), date, ...(row.technical ? { contains: row.technical.slice(0, 60) } : {}) });
  }
  return out;
}
