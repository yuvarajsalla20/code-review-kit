import { couldNotVerify, decisionSections, header, summaryTable } from '../lib/table.mjs';

export const TITLES = {
  frontmatter: 'Front matter',
  sections: 'Required sections',
  references: 'Broken references',
  shared: 'Not pointing to the shared rules',
  repeated: 'Lines repeated across agents',
  orphan: 'Agents no skill starts',
  size: 'Length',
};

export const toMarkdown = (project, kitVersion, date, result) =>
  [
    ...header('Agent review', project, kitVersion, date, `   Agents: ${result.agents}   Skills read: ${result.skills}`),
    ...summaryTable(TITLES, result),
    ...decisionSections(TITLES, result.findings),
    ...couldNotVerify([
      'The scripts read structure and wording. They cannot tell whether an agent finds real problems: that needs the reviewer agent and a trial on a project with planted defects.',
      'Overlap in scope (two agents owning the same finding) and vague rules need a reader, not a script.',
      'Repeated lines are exact matches. Near copies that differ by a word are not seen.',
      'Whether an installed plugin resolves kit paths for its agents can only be seen on a real install. Overlap between agents is judged against the owner table in `rules/review-rules.md`.',
    ]),
  ].join('\n');
