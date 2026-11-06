import { acceptedSection, couldNotVerify, decisionSections, header, summaryTable } from '../lib/table.mjs';

export const TITLES = { survivors: 'Changes no test noticed' };

export const toMarkdown = (project, kitVersion, date, result) =>
  [
    ...header('Mutation check (advisory)', project, kitVersion, date),
    `Tried ${result.stats.tried} of ${result.stats.total} possible changes: tests caught ${result.stats.killed}, missed ${result.stats.survived}.`,
    '',
    ...summaryTable(TITLES, result),
    ...decisionSections(TITLES, result.findings),
    ...acceptedSection(result),
    ...couldNotVerify([
      'This is a sample, not every change: raise `mutation.maxMutants` to try more. The same run gives the same sample.',
      'A change can survive because it makes no difference (for example a swap in a log line). The reviewer opens each row before it counts.',
      'Only simple swaps are tried (comparisons, and/or, true/false, not). Logic that is wrong in another way is not covered.',
    ]),
  ].join('\n');
