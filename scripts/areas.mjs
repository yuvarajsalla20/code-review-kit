// The check areas, listed once: check.mjs runs them in this order and summary.mjs collects them.
import { runAgents, CHECKS as AGENT_CHECKS } from './agents/index.mjs';
import { runPerf, CHECKS as PERF_CHECKS } from './perf/index.mjs';
import { runRelease, CHECKS as RELEASE_CHECKS } from './release/index.mjs';
import { runStructure, CHECKS as STRUCTURE_CHECKS } from './structure/index.mjs';
import { runTestMap, CHECKS as TEST_CHECKS } from './testmap/index.mjs';

/** `key` is also the name of the area's block in review.config.json. */
export const AREAS = [
  { key: 'structure', title: 'Structure', run: runStructure, checks: STRUCTURE_CHECKS, script: 'structure.mjs' },
  { key: 'release', title: 'Release', run: runRelease, checks: RELEASE_CHECKS, script: 'release.mjs' },
  { key: 'tests', title: 'Tests', run: runTestMap, checks: TEST_CHECKS, script: 'testmap.mjs' },
  { key: 'agents', title: 'Agents', run: runAgents, checks: AGENT_CHECKS, script: 'agents.mjs' },
  { key: 'speed', title: 'Speed and cost', run: runPerf, checks: PERF_CHECKS, script: 'perf.mjs' },
];
