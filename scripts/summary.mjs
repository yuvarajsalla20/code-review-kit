#!/usr/bin/env node
// One plain-language summary of every check:
//   node path/to/review-kit/scripts/summary.mjs [review.config.json] [--areas structure,release,tests,agents]
//        [--extra verified.json,reviewer.json,...] [--previous last-summary.json] [--report summary.md] [--html summary.html] [--json]
// --extra takes one file or several, comma separated (each reviewer's findings file, plus results): their lists are joined.
// --previous is the --json output of an earlier run: rows are marked New or Still open, and rows that are gone are listed as fixed.
// Exit code: 0 Ready or Ready after fixes, 1 Not ready, 3 Incomplete, 2 a config or hand-off file problem.
// Runs each check whose block is in the config (or the areas you name), merges the agents' verified changes from --extra, and writes the tables and the page.
import { readFileSync, writeFileSync } from 'node:fs';
import { ConfigError } from './lib/findings.mjs';
import { finish, guard, loadConfig, parseArgs, projectName } from './lib/cli.mjs';
import { KIT_VERSION } from './lib/version.mjs';
import { collect } from './summary/collect.mjs';
import { toHtml } from './summary/html.mjs';
import { toMarkdown } from './summary/markdown.mjs';
import { buildModel, checkExtra, mergeExtras } from './summary/model.mjs';
import { coverage } from './areas.mjs';

const root = process.cwd();
const args = parseArgs();
const config = loadConfig(root, args.configPath, { optional: true });
const readExtra = (f) => {
  let data;
  try {
    data = JSON.parse(readFileSync(f, 'utf8'));
  } catch (e) {
    throw new ConfigError(`${f} could not be read as JSON: ${e.message}`);
  }
  return checkExtra(data, f);
};
// Each file is checked on its own, so a bad level or result names the file it is in.
const extra = guard(() => mergeExtras((args.extra ?? '').split(',').filter(Boolean).map(readExtra)));
const previous = args.previous ? JSON.parse(readFileSync(args.previous, 'utf8')) : null;
// Named areas are a deliberate partial run; otherwise every area that applies and has no block (and no skip reason) makes the verdict Incomplete.
const notRun = args.areas ? [] : coverage(config, root).notRun.map((a) => a.key);
const model = guard(() => buildModel(collect(config, root, args.areas?.split(',')), extra, { project: projectName(config, root), kitVersion: KIT_VERSION, timeZone: config.timezone, notRun, previous }));
if (args.html) {
  writeFileSync(args.html, toHtml(model));
  (args.json ? console.error : console.log)(`Page written to ${args.html}`); // keep --json output clean
}
// Exit 1 for Not ready and 3 for Incomplete, as check.mjs does, so a script that trusts the exit code never passes a partial review.
finish({ args, result: model, markdown: toMarkdown(model), code: { not: 1, incomplete: 3 }[model.verdictKey] ?? 0 });
