import { acceptedSection, couldNotVerify, decisionSections, header, summaryTable } from '../lib/table.mjs';

export const TITLES = {
  cachedSnapshot: 'Listeners that trust an empty cached answer',
  uploadRetry: 'Uploads that can hang for 10 minutes',
  storagePaths: 'Storage rules that accept any file at any depth',
  decimalComma: 'Number parsers that drop a decimal comma',
};

export const toMarkdown = (project, kitVersion, date, result) =>
  [
    ...header('Data integrity report', project, kitVersion, date, `   Files read: ${result.files}`),
    ...summaryTable(TITLES, result),
    ...decisionSections(TITLES, result.findings),
    ...acceptedSection(result),
    ...couldNotVerify([
      'A text match: a cached answer handled in a wrapper the script does not read, or a timeout written another way, is still listed. The reviewer opens each row.',
      'How quickly an offline listener answers, and which key the number pad shows in each phone region, need a device.',
      'Whether the deployed Storage rules match the file needs the live project.',
    ]),
  ].join('\n');
