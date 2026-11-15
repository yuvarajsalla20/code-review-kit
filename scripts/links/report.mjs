import { acceptedSection, couldNotVerify, decisionSections, header, summaryTable } from '../lib/table.mjs';

export const TITLES = { unguarded: 'Parsing that can throw on bad input', handlers: 'Link handlers that may drop unsaved input' };

export const toMarkdown = (project, kitVersion, date, result) =>
  [
    ...header('Links and parsing report', project, kitVersion, date, `   Files read: ${result.files}`),
    ...summaryTable(TITLES, result),
    ...decisionSections(TITLES, result.findings),
    ...acceptedSection(result),
    ...couldNotVerify([
      'A text match: a parse guarded by a check before it (a regex test, a known-good source) is still listed. The reviewer opens each row.',
      'A link handler in another file than the form is checked by words only (discard, unsaved, dirty, confirm). Whether the guard really runs needs a person or a device test.',
      'What iOS does with a link while the app is closed (getInitialURL) needs a device.',
    ]),
  ].join('\n');
