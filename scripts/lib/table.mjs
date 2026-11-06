// Markdown pieces shared by every report: the summary table and the decision tables.
/** Text for one table cell: pipes escaped, line breaks flattened, empty values blank. */
export const cell = (t) => String(t ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');

export const header = (title, project, kitVersion, date, extra = '') => [`# ${title}: ${project}`, '', `Checked: ${date}   Kit: ${kitVersion}${extra}`, ''];

/** `titles` maps a check name to its heading; `result.counts` and `result.gate` say how many and which ones fail the run. */
export function summaryTable(titles, result) {
  const rows = Object.entries(titles).map(([c, t]) => `| ${t} | ${result.counts[c] ?? 0} | ${result.gate.includes(c) ? 'Gate: must be fixed or accepted' : 'Review: you decide'} |`);
  return ['## Summary', '', '| Check | Found | Counts as |', '|---|---|---|', ...rows, ''];
}

/** One section per check: a numbered decision table, or "None found." Numbers continue across sections. */
export function decisionSections(titles, findings) {
  const out = [];
  let n = 0;
  for (const [check, title] of Object.entries(titles)) {
    out.push(`## ${title}`, '');
    const rows = findings.filter((f) => f.check === check);
    if (!rows.length) {
      out.push('None found.', '');
      continue;
    }
    out.push('| # | Where | What | Suggested fix | Effort | Your decision |', '|---|---|---|---|---|---|');
    for (const f of rows) out.push(`| ${++n} | ${cell(f.where)} | ${cell(f.what)} | ${cell(f.fix)} | ${f.effort} | |`);
    out.push('');
  }
  return out;
}

/** Rows the owner already accepted (they no longer count), and accepted-file entries that match nothing now. Empty when there are none. */
export function acceptedSection(result) {
  const out = [];
  if (result.accepted?.length) out.push('## Accepted earlier', '', 'These rows were accepted in `review.accepted.json`. They do not count, and stay listed so nothing is hidden.', '', '| Where | What | Reason | Accepted on |', '|---|---|---|---|', ...result.accepted.map((f) => `| ${cell(f.where)} | ${cell(f.what)} | ${cell(f.reason)} | ${cell(f.date)} |`), '');
  if (result.stale?.length) out.push('## Accepted entries that match nothing', '', 'The code changed, so these entries cover no row now. Remove them from `review.accepted.json`.', '', '| Check | File | Reason |', '|---|---|---|', ...result.stale.map((e) => `| ${cell(e.check)} | ${cell(e.file)} | ${cell(e.reason)} |`), '');
  return out;
}

export const couldNotVerify = (lines) => ['## Could not verify', '', ...lines.map((l) => `- ${l}`), ''];
