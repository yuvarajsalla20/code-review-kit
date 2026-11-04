#!/usr/bin/env node
// Structure checks on their own, with a report you can hand to the owner:
//   node path/to/review-kit/scripts/structure.mjs [review.config.json] [--report out.md] [--json]
// Exit code 1 when a gated check finds something. Run from the project root.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { runStructure } from './structure/index.mjs';
import { toMarkdown } from './structure/report.mjs';
import { KIT_VERSION } from './lib/version.mjs';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name) => (flag(name) ? args[args.indexOf(name) + 1] : undefined);
const positional = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--report');

const root = process.cwd();
const configPath = positional[0] || join(root, 'review.config.json');
if (!existsSync(configPath)) {
  console.error(`No config at ${configPath}. Copy templates/review.config.json first.`);
  process.exit(2);
}
const config = JSON.parse(readFileSync(configPath, 'utf8'));
const result = runStructure(config, root);

if (flag('--json')) console.log(JSON.stringify(result, null, 2));
const report = toMarkdown(config.name || basename(root), KIT_VERSION, new Date().toISOString().slice(0, 10), result);
if (value('--report')) {
  writeFileSync(value('--report'), report);
  console.log(`Report written to ${value('--report')}`);
} else if (!flag('--json')) console.log(report);

process.exit(result.findings.some((f) => f.gate) ? 1 : 0);
