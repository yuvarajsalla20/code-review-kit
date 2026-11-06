import { acceptedSection, couldNotVerify, decisionSections, header, summaryTable } from '../lib/table.mjs';

export const TITLES = { untested: 'Risky files no test reaches' };

export const toMarkdown = (project, kitVersion, date, result) =>
  [
    ...header('Test map', project, kitVersion, date, `   Source files: ${result.files}   Test files: ${result.tests}   Checked as risky: ${result.risky}`),
    ...summaryTable(TITLES, result),
    ...decisionSections(TITLES, result.findings),
    ...acceptedSection(result),
    ...couldNotVerify([
      'Reached means a test imports the file, not that the test checks what the file does. The reviewer must read the tests for the risky paths.',
      'Tests that mock a module (a stub) still count it as reached. Look for stubs that hide the behaviour under test.',
      'A file counts as reached when a test imports it, or writes its path or its (unique) file name in quotes to run it as a separate program. A test that runs a file some other way is not seen.',
      'Behaviour that only shows on a device (alerts firing, the keyboard, permissions) cannot be covered by these tests.',
    ]),
  ].join('\n');
