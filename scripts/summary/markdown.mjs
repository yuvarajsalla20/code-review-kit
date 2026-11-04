// The summary as markdown. The tables come from tables.mjs.
import { VERDICT_NOTE, countRows, sections } from './tables.mjs';

const cell = (t) => String(t ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
const table = ({ head, rows, empty }) => (rows.length ? [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.map(cell).join(' | ')} |`), ''] : [empty, '']);

export function toMarkdown(m) {
  const s = sections(m);
  return [
    `# Review summary: ${m.project}`, '', `Kit: ${m.kitVersion}   Checks run: ${m.checked.join(', ') || 'none'}`, '',
    '## Verdict', '', `**${m.verdict}**: ${m.verdictMeaning}`, '',
    ...table({ head: ['', 'Count'], rows: countRows(m) }), VERDICT_NOTE, '',
    `## ${s.fixFirst.title}`, '', ...table(s.fixFirst),
    `## ${s.decisions.title}`, '', s.decisions.note, '', ...table(s.decisions),
    '## By area', '', ...s.areas.flatMap((a) => [`### ${a.title}`, '', ...table(a)]),
    `## ${s.terms.title}`, '', ...table(s.terms),
    '## What we could not check', '', ...m.couldNot.map((c) => `- ${c}`), '', '---', m.footer, '',
  ].join('\n');
}
