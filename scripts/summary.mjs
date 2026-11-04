#!/usr/bin/env node
// One plain-language summary of every check:
//   node path/to/review-kit/scripts/summary.mjs [review.config.json] [--areas structure,release,tests,agents]
//        [--extra verified.json] [--report summary.md] [--html summary.html] [--json]
// Runs each check whose block is in the config (or the areas you name), merges the agents' verified changes from --extra, and writes the tables and the page.
import { readFileSync, writeFileSync } from 'node:fs';
import { finish, guard, loadConfig, parseArgs, projectName } from './lib/cli.mjs';
import { KIT_VERSION } from './lib/version.mjs';
import { collect } from './summary/collect.mjs';
import { toHtml } from './summary/html.mjs';
import { toMarkdown } from './summary/markdown.mjs';
import { buildModel } from './summary/model.mjs';

const root = process.cwd();
const args = parseArgs();
const config = loadConfig(root, args.configPath, { optional: true });
const extra = args.extra ? JSON.parse(readFileSync(args.extra, 'utf8')) : {};
const model = buildModel(guard(() => collect(config, root, args.areas?.split(','))), extra, { project: projectName(config, root), kitVersion: KIT_VERSION, timeZone: config.timezone });
if (args.html) {
  writeFileSync(args.html, toHtml(model));
  console.log(`Page written to ${args.html}`);
}
finish({ args, result: model, markdown: toMarkdown(model), failed: model.counts.mustFix > 0 });
