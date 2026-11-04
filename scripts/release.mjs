#!/usr/bin/env node
// Release readiness on its own:
//   node path/to/review-kit/scripts/release.mjs [review.config.json] [--report out.md] [--json]
// Exit code 1 when a gated check finds something. Run from the project root.
import { finish, loadConfig, parseArgs, projectName } from './lib/cli.mjs';
import { KIT_VERSION } from './lib/version.mjs';
import { runRelease } from './release/index.mjs';
import { toMarkdown } from './release/report.mjs';

const root = process.cwd();
const args = parseArgs();
const config = loadConfig(root, args.configPath);
const result = runRelease(config, root);
finish({ args, result, markdown: toMarkdown(projectName(config, root), KIT_VERSION, new Date().toISOString().slice(0, 10), result) });
