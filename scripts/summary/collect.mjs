// Runs each script-based check the config asks for. Returns `[{ area, result }]`.
import { runAgents } from '../agents/index.mjs';
import { runRelease } from '../release/index.mjs';
import { runStructure } from '../structure/index.mjs';
import { runTestMap } from '../testmap/index.mjs';

const RUNNERS = { structure: runStructure, release: runRelease, tests: runTestMap, agents: runAgents };
const BLOCKS = { structure: 'structure', release: 'release', tests: 'tests', agents: 'agents' };

/** `areas` (a list) overrides the choice; otherwise every area whose block is in the config runs. */
export function collect(config, root, areas) {
  const chosen = areas?.length ? areas : Object.keys(RUNNERS).filter((a) => config[BLOCKS[a]]);
  return chosen.filter((a) => RUNNERS[a]).map((area) => ({ area, result: RUNNERS[area](config, root) }));
}
