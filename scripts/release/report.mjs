import { couldNotVerify, decisionSections, header, summaryTable } from '../lib/table.mjs';

export const TITLES = {
  lockfile: 'Lock file and clean install',
  appConfig: 'App settings the store needs',
  permissions: 'Permission reason texts',
  tracked: 'Secret files in git',
  privacy: 'Privacy policy covers what the app uses',
};

export const toMarkdown = (project, kitVersion, date, result) =>
  [
    ...header('Release readiness report', project, kitVersion, date),
    ...summaryTable(TITLES, result),
    ...decisionSections(TITLES, result.findings),
    ...couldNotVerify([
      'The privacy check looks for a keyword per package. It cannot tell whether the policy describes the use correctly: the reviewer must read it.',
      'App Store Connect answers (privacy labels, age rating, screenshots, metadata) are not in the repository: list them for the owner to confirm.',
      'A real build and a real device (the EAS log, the TestFlight install) are the only proof that the build works.',
    ]),
  ].join('\n');
