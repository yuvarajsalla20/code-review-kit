// The check areas, listed once: check.mjs runs them in this order and summary.mjs collects them.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { withAccepted } from './lib/accepted.mjs';
import { runAgents, CHECKS as AGENT_CHECKS } from './agents/index.mjs';
import { runMutation, CHECKS as MUTATION_CHECKS } from './mutation/index.mjs';
import { runPerf, CHECKS as PERF_CHECKS } from './perf/index.mjs';
import { runRelease, CHECKS as RELEASE_CHECKS } from './release/index.mjs';
import { runStructure, CHECKS as STRUCTURE_CHECKS } from './structure/index.mjs';
import { runTestMap, CHECKS as TEST_CHECKS } from './testmap/index.mjs';

/** `key` is also the name of the area's block in review.config.json. */
const RAW = [
  { key: 'structure', title: 'Structure', run: runStructure, checks: STRUCTURE_CHECKS, script: 'structure.mjs' },
  { key: 'release', title: 'Release', run: runRelease, checks: RELEASE_CHECKS, script: 'release.mjs' },
  { key: 'tests', title: 'Tests', run: runTestMap, checks: TEST_CHECKS, script: 'testmap.mjs' },
  { key: 'agents', title: 'Agents', run: runAgents, checks: AGENT_CHECKS, script: 'agents.mjs', applies: (root) => existsSync(join(root, 'agents')) },
  { key: 'speed', title: 'Speed and cost', run: runPerf, checks: PERF_CHECKS, script: 'perf.mjs' },
  // Slow: never part of the default run; only `--areas mutation` or mutate.mjs start it.
  { key: 'mutation', title: 'Mutation (advisory)', run: runMutation, checks: MUTATION_CHECKS, script: 'mutate.mjs', slow: true },
];

/** The checks of every area by area name, so the accepted file can be checked for typos. */
export const KNOWN_CHECKS = Object.fromEntries(RAW.map((a) => [a.key, a.checks]));

/** Every area, with its `run` also applying `review.accepted.json`. */
export const AREAS = RAW.map((a) => ({ ...a, run: withAccepted(a.key, a.run, KNOWN_CHECKS) }));

/** The wrapped run function of one area, for the stand-alone scripts. */
export const areaRun = (key) => AREAS.find((a) => a.key === key).run;
