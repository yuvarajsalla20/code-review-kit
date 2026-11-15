#!/usr/bin/env node
// End-to-end starters:
//   node path/to/review-kit/scripts/e2e.mjs [review.config.json] [--out folder]
// Always reports test-ID coverage. With --out (a folder you choose, created if missing; never inside the kit) it writes starter Maestro
// flows from the config's `e2e` block. It writes nothing else.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig, parseArgs } from './lib/cli.mjs';
import { SOURCE, listFiles, readText } from './lib/files.mjs';
import { README, maestroFlows, testIdCoverage } from './e2e/index.mjs';

const root = process.cwd();
const args = parseArgs();
const config = loadConfig(root, args.configPath, { optional: true });
const roots = config.structure?.roots ?? ['src', 'App.tsx', 'app'];
const files = listFiles(root, roots, { match: SOURCE, ignore: ['tests'] });
const { withIds, interactive } = testIdCoverage(new Map(files.map((f) => [f, readText(root, f)])));
console.log(`Test IDs: ${withIds} of ${interactive} files with buttons or inputs set a testID.`);
if (interactive && withIds === 0) console.log('No testIDs at all: end-to-end flows can only tap visible words, which break when the wording changes. Add testID to the main buttons and fields first.');
if (!args.out) process.exit(0);
if (!config.e2e?.appId || !config.e2e?.firstScreen) {
  console.error('Add an "e2e" block to review.config.json with at least appId and firstScreen (see the README).');
  process.exit(2);
}
const flows = maestroFlows(config.e2e);
mkdirSync(args.out, { recursive: true });
for (const [name, text] of Object.entries(flows)) writeFileSync(join(args.out, name), text);
writeFileSync(join(args.out, 'README.md'), README(Object.keys(flows).length));
console.log(`Wrote ${Object.keys(flows).length} flows to ${args.out}.`);
