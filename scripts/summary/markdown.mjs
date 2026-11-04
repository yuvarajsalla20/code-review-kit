// The summary as markdown: the same sections as templates/summary-report.md.
const cell = (t) => String(t ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const table = (head, rows) => [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`), ''];

import { plainLine } from './model.mjs';

export function toMarkdown(m) {
  const spot = (r) => `${r.meaning} (${r.where})`;
  return [
    `# Review summary: ${m.project}`, '', `Kit: ${m.kitVersion}   Checks run: ${m.checked.join(', ') || 'none'}`, '',
    '## Verdict', '', `**${m.verdict}**: ${m.verdictMeaning}`, '',
    ...table(['', 'Count'], [['Must fix before release', m.counts.mustFix], ['Blocker', m.counts.Blocker], ['High', m.counts.High], ['Medium', m.counts.Medium], ['Low', m.counts.Low]]),
    'Not ready if any item must be fixed (a failed gated check or a Blocker); Ready after fixes if High items remain; Ready otherwise.', '',
    '## Fix first', '', ...(m.fixFirst.length ? table(['#', 'What could go wrong', 'Where', 'Effort'], m.fixFirst.map((r) => [r.n, plainLine(r), r.where, r.effort])) : ['Nothing to fix.', '']),
    '## Your decisions', '', 'Mark the last column and send it back; nothing is changed until you do.', '',
    ...(m.rows.length ? table(['#', 'What it means', 'Why it matters', 'Suggested fix', 'Effort', 'Area', 'Your decision'], m.rows.map((r) => [r.n, spot(r), r.impact, r.fix, r.effort, r.area, ''])) : ['None found.', '']),
    '## By area', '',
    ...m.areas.flatMap((a) => [`### ${a.title}`, '', ...(a.rows.length ? table(['#', 'Where', 'What (technical)', 'Trigger'], a.rows.map((r) => [r.n, r.where, r.technical, r.trigger || '-'])) : ['None found.', ''])]),
    '## Terms used', '', ...(m.terms.length ? table(['Term', 'Meaning'], m.terms.map((x) => [x.term, x.meaning])) : ['None.', '']),
    '## What we could not check', '', ...m.couldNot.map((c) => `- ${c}`), '', '---', m.footer, '',
  ].join('\n');
}
