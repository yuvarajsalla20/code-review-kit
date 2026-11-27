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
import { runLinks, CHECKS as LINK_CHECKS } from './links/index.mjs';
import { runIntegrity, CHECKS as INTEGRITY_CHECKS } from './integrity/index.mjs';
import { runWidgets, CHECKS as WIDGET_CHECKS, usesWidgets } from './widgets/index.mjs';
import { SECRET_CHECKS, forbiddenChecks, runForbidden, runSecrets } from './scan/index.mjs';

/**
 * `key` is also the name of the area's block in review.config.json. `always`: runs with or without its block (the secrets scan,
 * and the owner's `forbidden` rules, which find nothing when there are none), so it never makes a run Incomplete.
 */
const RAW = [
  { key: 'secrets', title: 'Secrets', run: runSecrets, checks: SECRET_CHECKS, always: true },
  { key: 'forbidden', title: 'Forbidden patterns', run: runForbidden, checks: [], always: true },
  { key: 'structure', title: 'Structure', run: runStructure, checks: STRUCTURE_CHECKS, script: 'structure.mjs' },
  { key: 'release', title: 'Release', run: runRelease, checks: RELEASE_CHECKS, script: 'release.mjs' },
  { key: 'tests', title: 'Tests', run: runTestMap, checks: TEST_CHECKS, script: 'testmap.mjs' },
  { key: 'agents', title: 'Agents', run: runAgents, checks: AGENT_CHECKS, script: 'agents.mjs', applies: (root) => existsSync(join(root, 'agents')) },
  { key: 'speed', title: 'Speed and cost', run: runPerf, checks: PERF_CHECKS, script: 'perf.mjs' },
  { key: 'links', title: 'Links and parsing', run: runLinks, checks: LINK_CHECKS, script: 'links.mjs', applies: (root) => existsSync(join(root, 'src')) || existsSync(join(root, 'App.tsx')) },
  { key: 'integrity', title: 'Data integrity', run: runIntegrity, checks: INTEGRITY_CHECKS, script: 'integrity.mjs', applies: (root) => existsSync(join(root, 'src')) || existsSync(join(root, 'App.tsx')) },
  { key: 'widgets', title: 'Widgets and Lock Screen', run: runWidgets, checks: WIDGET_CHECKS, script: 'widgets.mjs', applies: usesWidgets },
  // Slow: never part of the default run; only `--areas mutation` or mutate.mjs start it.
  { key: 'mutation', title: 'Mutation (advisory)', run: runMutation, checks: MUTATION_CHECKS, script: 'mutate.mjs', slow: true },
];

/** The checks of every area by area name, so the accepted file can be checked for typos. The forbidden area's checks are the config's rule names. */
export const KNOWN_CHECKS = Object.fromEntries(RAW.map((a) => [a.key, a.checks]));
export const knownChecks = (config) => ({ ...KNOWN_CHECKS, forbidden: forbiddenChecks(config) });

/** Every area, with its `run` also applying `review.accepted.json`. */
export const AREAS = RAW.map((a) => ({ ...a, run: withAccepted(a.key, a.run, knownChecks) }));

/** The wrapped run function of one area, for the stand-alone scripts. */
export const areaRun = (key) => AREAS.find((a) => a.key === key).run;

/**
 * Which areas apply to this project, which have no config block (not run), and which the owner skipped on purpose with a reason
 * (`skipAreas`). A skip without a reason counts as not run: "skipped" must say why.
 */
export function coverage(config, root) {
  const applicable = AREAS.filter((a) => !a.slow && !a.always && (a.applies?.(root) ?? true));
  const reasons = config.skipAreas ?? {};
  const missing = applicable.filter((a) => !config[a.key]);
  const skipped = missing.filter((a) => typeof reasons[a.key] === 'string' && reasons[a.key].trim());
  return { applicable, skipped, notRun: missing.filter((a) => !skipped.includes(a)) };
}
