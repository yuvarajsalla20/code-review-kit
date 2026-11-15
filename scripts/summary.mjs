#!/usr/bin/env node
// One plain-language summary of every check:
//   node path/to/review-kit/scripts/summary.mjs [review.config.json] [--areas structure,release,tests,agents]
//        [--extra verified.json,reviewer.json,...] [--previous last-summary.json] [--report summary.md] [--html summary.html] [--json]
// --extra takes one file or several, comma separated (each reviewer's findings file, plus results): their lists are joined.
// --previous is the --json output of an earlier run: rows are marked New or Still open, and rows that are gone are listed as fixed.
// Runs each check whose block is in the config (or the areas you name), merges the agents' verified changes from --extra, and writes the tables and the page.
import { readFileSync, writeFileSync } from 'node:fs';
import { finish, guard, loadConfig, parseArgs, projectName } from './lib/cli.mjs';
import { KIT_VERSION } from './lib/version.mjs';
import { collect } from './summary/collect.mjs';
import { toHtml } from './summary/html.mjs';
import { toMarkdown } from './summary/markdown.mjs';
import { buildModel, mergeExtras } from './summary/model.mjs';
import { coverage } from './areas.mjs';

const root = process.cwd();
const args = parseArgs();
const config = loadConfig(root, args.configPath, { optional: true });
const extra = mergeExtras((args.extra ?? '').split(',').filter(Boolean).map((f) => JSON.parse(readFileSync(f, 'utf8'))));
const previous = args.previous ? JSON.parse(readFileSync(args.previous, 'utf8')) : null;
// Named areas are a deliberate partial run; otherwise every area that applies and has no block (and no skip reason) makes the verdict Incomplete.
const notRun = args.areas ? [] : coverage(config, root).notRun.map((a) => a.key);
const model = buildModel(guard(() => collect(config, root, args.areas?.split(','))), extra, { project: projectName(config, root), kitVersion: KIT_VERSION, timeZone: config.timezone, notRun, previous });
if (args.html) {
  writeFileSync(args.html, toHtml(model));
  (args.json ? console.error : console.log)(`Page written to ${args.html}`); // keep --json output clean
}
finish({ args, result: model, markdown: toMarkdown(model), failed: model.verdictKey === 'not' });
