import { couldNotVerify, decisionSections, header, summaryTable } from '../lib/table.mjs';

export const TITLES = {
  assets: 'Large images, audio and video',
  heavy: 'Heavy packages',
  animation: 'Animations on the JavaScript thread',
  cleanup: 'Timers and listeners with no stop',
  lists: 'Long lists drawn all at once',
};

export const toMarkdown = (project, kitVersion, date, result) =>
  [
    ...header('Speed and cost candidates', project, kitVersion, date),
    ...summaryTable(TITLES, result),
    ...decisionSections(TITLES, result.findings),
    ...couldNotVerify([
      'Every row is a text match, so it can be wrong: a stop written in another file, a list that is always short, a layout animation that cannot use the native driver. `performance-reviewer` opens each row before it counts.',
      'Launch time, frame rate, memory and battery need a real, older phone: no script can measure them.',
      'How the data grows (what one change rewrites, how many reads a screen makes) is for the reviewer and `db-model-reviewer`: the script does not look at it.',
    ]),
  ].join('\n');
