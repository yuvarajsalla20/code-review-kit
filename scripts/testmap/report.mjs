import { couldNotVerify, decisionSections, header, summaryTable } from '../lib/table.mjs';

export const TITLES = { untested: 'Risky files no test reaches' };

export const toMarkdown = (project, kitVersion, date, result) =>
  [
    ...header('Test map', project, kitVersion, date, `   Source files: ${result.files}   Test files: ${result.tests}   Checked as risky: ${result.risky}`),
    ...summaryTable(TITLES, result),
    ...decisionSections(TITLES, result.findings),
    ...couldNotVerify([
      'Reached means a test imports the file, not that the test checks what the file does. The reviewer must read the tests for the risky paths.',
      'Tests that mock a module (a stub) still count it as reached. Look for stubs that hide the behaviour under test.',
      'Files that tests run as a separate program (a subprocess) are not seen as reached, so they may be listed here although a test covers them.',
      'Behaviour that only shows on a device (alerts firing, the keyboard, permissions) cannot be covered by these tests.',
    ]),
  ].join('\n');
