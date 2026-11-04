// Writes the structure findings as markdown tables, one per check, ready to show the owner.
import { CHECKS } from './index.mjs';

const TITLES = {
  cycles: 'Circular imports',
  layers: 'Layer rules',
  restricted: 'Packages used outside their place',
  duplicates: 'Duplicate code',
  repeated: 'Repeated lists and text',
  size: 'Size',
};
const cell = (t) => String(t).replace(/\|/g, '\\|').replace(/\n/g, ' ');

export function toMarkdown(project, kitVersion, date, result) {
  const out = [`# Structure report: ${project}`, '', `Checked: ${date}   Kit: ${kitVersion}   Files read: ${result.files}`, ''];
  out.push('## Summary', '', '| Check | Found | Counts as |', '|---|---|---|');
  for (const c of CHECKS) out.push(`| ${TITLES[c]} | ${result.counts[c]} | ${result.gate.includes(c) ? 'Gate: must be fixed or accepted' : 'Review: you decide'} |`);
  out.push('');
  let n = 0;
  for (const c of CHECKS) {
    out.push(`## ${TITLES[c]}`, '');
    const rows = result.findings.filter((f) => f.check === c);
    if (!rows.length) {
      out.push('None found.', '');
      continue;
    }
    out.push('| # | Where | What | Suggested fix | Effort | Your decision |', '|---|---|---|---|---|---|');
    for (const f of rows) out.push(`| ${++n} | ${cell(f.where)} | ${cell(f.what)} | ${cell(f.fix)} | ${f.effort} | |`);
    out.push('');
  }
  out.push('## Could not verify', '', '- Duplicate and size checks are text-based: they cannot tell whether two matching blocks should really be one, so each row needs a person to decide.');
  out.push('- Function sizes are measured for top-level functions and classes only, by matching braces.');
  if (!result.layered) out.push('- No layer map is configured, so layer rules were not checked. Add `structure.layers` to review.config.json.');
  out.push('');
  return out.join('\n');
}
