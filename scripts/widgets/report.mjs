import { acceptedSection, couldNotVerify, decisionSections, header, summaryTable } from '../lib/table.mjs';

export const TITLES = { lockscreen: 'Personal text shown on a locked phone', timeline: 'Widget timelines that can run out' };

export const toMarkdown = (project, kitVersion, date, result) =>
  [
    ...header('Widgets and Lock Screen report', project, kitVersion, date, `   Files read: ${result.files}`),
    ...summaryTable(TITLES, result),
    ...decisionSections(TITLES, result.findings),
    ...acceptedSection(result),
    ...couldNotVerify([
      'How iOS draws a widget, StandBy and the Dynamic Island, and when it refreshes a timeline, can only be seen on a device.',
      'Whether two Live Activities can start at once, and whether a dismissed one comes back, needs a device test.',
      'The full list is in checklists/widgets.md: the reviewer walks it for every app with widgets.',
    ]),
  ].join('\n');
