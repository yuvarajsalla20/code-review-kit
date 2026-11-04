// Markdown pieces shared by every report: the summary table and the decision tables.
const cell = (t) => String(t).replace(/\|/g, '\\|').replace(/\n/g, ' ');

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

export const couldNotVerify = (lines) => ['## Could not verify', '', ...lines.map((l) => `- ${l}`), ''];
