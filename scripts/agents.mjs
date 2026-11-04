#!/usr/bin/env node
// Checks the kit's own agents:
//   node path/to/review-kit/scripts/agents.mjs [review.config.json] [--report out.md] [--json]
// Run from the kit root. A config is optional; the `agents` block sets paths, limits and the gate.
import { finish, loadConfig, parseArgs, projectName } from './lib/cli.mjs';
import { KIT_VERSION } from './lib/version.mjs';
import { runAgents } from './agents/index.mjs';
import { toMarkdown } from './agents/report.mjs';

const root = process.cwd();
const args = parseArgs();
const config = loadConfig(root, args.configPath, { optional: true });
const result = runAgents(config, root);
finish({ args, result, markdown: toMarkdown(projectName(config, root), KIT_VERSION, new Date().toISOString().slice(0, 10), result) });
