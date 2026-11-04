#!/usr/bin/env node
// Which risky files no test reaches:
//   node path/to/review-kit/scripts/testmap.mjs [review.config.json] [--report out.md] [--json]
// Set `tests.risky` (folders that must never fail) in review.config.json. Run from the project root.
import { finish, loadConfig, parseArgs, projectName } from './lib/cli.mjs';
import { KIT_VERSION } from './lib/version.mjs';
import { runTestMap } from './testmap/index.mjs';
import { toMarkdown } from './testmap/report.mjs';

const root = process.cwd();
const args = parseArgs();
const config = loadConfig(root, args.configPath);
const result = runTestMap(config, root);
finish({ args, result, markdown: toMarkdown(projectName(config, root), KIT_VERSION, new Date().toISOString().slice(0, 10), result) });
