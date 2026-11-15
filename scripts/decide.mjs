#!/usr/bin/env node
// Reads the owner's marks in a summary and acts on them:
//   node path/to/review-kit/scripts/decide.mjs --report summary.md --previous summary.json [--write]
// summary.md is the summary with the "Your decision" column filled in (fix, later, or "accept: <reason>");
// summary.json is the --json output of the same run, which says what each row number is.
// Prints the fix list and the later list. Accepted script rows become entries for review.accepted.json, with the reason and today's date:
// shown by default, added to the file only with --write. Rows a reviewer agent found cannot be accepted in the file (the scripts never
// produce them again); they are listed so the owner can tell the reviewer next time.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig, parseArgs } from './lib/cli.mjs';
import { decide } from './summary/decide.mjs';

const root = process.cwd();
const args = parseArgs();
if (!args.report || !args.previous) {
  console.error('Usage: decide.mjs --report summary.md --previous summary.json [--write]');
  process.exit(2);
}
const config = loadConfig(root, args.configPath, { optional: true });
const write = process.argv.includes('--write');
const result = decide(readFileSync(args.report, 'utf8'), JSON.parse(readFileSync(args.previous, 'utf8')), new Date().toISOString().slice(0, 10));
const show = (title, rows) => rows.length && console.log(`\n${title}\n${rows.map((r) => `  #${r.n} ${r.where}: ${r.meaning}`).join('\n')}`);
show('Fix:', result.fix);
show('Later:', result.later);
show('Accepted, found by a reviewer (tell the reviewer next time; the file only holds script rows):', result.acceptedByAgent);
for (const p of result.problems) console.log(`\nNot taken: ${p}`);
if (result.entries.length) {
  const path = join(root, config.acceptedFile ?? 'review.accepted.json');
  const list = existsSync(path) ? JSON.parse(readFileSync(path, 'utf8')) : [];
  console.log(`\n${write ? 'Adding' : 'Would add'} to ${path}:\n${result.entries.map((e) => `  ${JSON.stringify(e)}`).join('\n')}`);
  if (write) writeFileSync(path, `${JSON.stringify([...list, ...result.entries], null, 2)}\n`);
  else console.log('\nNothing written. Run again with --write to add them.');
}
process.exit(result.problems.length ? 1 : 0);
