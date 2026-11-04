// Speed and cost candidates: the few things a script can count. Every row is a candidate until `performance-reviewer` opens it and the code confirms it.
// Findings have the same shape as the other checks: { check, gate, where, what, fix, effort, places }. No check gates by default.
import { SOURCE, listFiles, readText } from '../lib/files.mjs';
import { assemble } from '../lib/findings.mjs';
import { stripComments } from '../lib/source.mjs';
import { findAnimations, findCleanupGaps, findScrollMaps } from './code.mjs';
import { findHeavy, findLargeAssets } from './weight.mjs';

export const CHECKS = ['assets', 'heavy', 'animation', 'cleanup', 'lists'];
const DEFAULTS = {
  roots: ['src', 'App.tsx'],
  assetRoots: ['assets', 'public', 'src'],
  ignore: ['tests'],
  maxAssetKb: 300,
  heavy: {
    moment: 'It is large and cannot drop the parts you do not use; dayjs or date-fns are far smaller.',
    lodash: 'Importing it whole adds all of it to the app; use per-function imports (lodash-es) or built-in methods.',
  },
  gate: [],
};

export const settingsFor = (config) => ({ ...DEFAULTS, ...config.speed, heavy: { ...DEFAULTS.heavy, ...config.speed?.heavy } });

export function runPerf(config, root) {
  const s = settingsFor(config);
  const texts = new Map(listFiles(root, s.roots, { ignore: s.ignore, match: SOURCE }).map((f) => [f, stripComments(readText(root, f))]));
  const found = { assets: findLargeAssets(root, s), heavy: findHeavy(root, s.heavy), animation: findAnimations(texts), cleanup: findCleanupGaps(texts), lists: findScrollMaps(texts) };
  return { ...assemble(CHECKS, found, s.gate), files: texts.size, settings: s };
}
