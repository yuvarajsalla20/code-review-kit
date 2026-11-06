#!/usr/bin/env node
// Shows which check areas a project's review.config.json does not have a block for, and adds starter blocks:
//   node path/to/review-kit/scripts/upgrade.mjs [review.config.json] [--write]
// Without --write it only prints what would be added. Starter blocks use folders that exist and gate nothing, so a run that was green stays green.
// This is the one script that writes to the project, and only the config file, only with --write.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AREAS } from './areas.mjs';
import { loadConfig, parseArgs } from './lib/cli.mjs';
import { STARTERS, STARTER_NOTES } from './lib/starter.mjs';

const root = process.cwd();
const args = parseArgs();
const write = process.argv.includes('--write');
const config = loadConfig(root, args.configPath);
const missing = AREAS.filter((a) => !a.slow && !config[a.key] && (a.applies?.(root) ?? true) && STARTERS[a.key]);

if (!missing.length) {
  console.log('Every check area already has a block in review.config.json.');
  process.exit(0);
}
const blocks = Object.fromEntries(missing.map((a) => [a.key, STARTERS[a.key](root)]));
for (const a of missing) {
  console.log(`${write ? 'Adding' : 'Would add'} "${a.key}": ${JSON.stringify(blocks[a.key])}`);
  if (STARTER_NOTES[a.key]) console.log(`  next: ${STARTER_NOTES[a.key]}`);
}
if (write) {
  const path = args.configPath || join(root, 'review.config.json');
  writeFileSync(path, `${JSON.stringify({ ...JSON.parse(readFileSync(path, 'utf8')), ...blocks }, null, 2)}\n`);
  console.log(`\nWrote ${path}. Run check.mjs to see the new rows.`);
} else console.log('\nNothing written. Run again with --write to add them.');
