// What every command-line script needs: arguments, the config file, and a consistent way to finish.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { basename, join } from 'node:path';

/** Flags and the config path: `--report out.md`, `--json`, and an optional config path as the first plain argument. */
export function parseArgs(argv = process.argv.slice(2)) {
  const at = argv.indexOf('--report');
  const report = at >= 0 ? argv[at + 1] : undefined;
  const plain = argv.filter((a, i) => !a.startsWith('--') && !(at >= 0 && i === at + 1));
  return { report, json: argv.includes('--json'), configPath: plain[0] };
}

/** Reads review.config.json (or the path given); stops with exit code 2 and a hint when there is none. */
export function loadConfig(root, configPath) {
  const path = configPath || join(root, 'review.config.json');
  if (!existsSync(path)) {
    console.error(`No config at ${path}. Copy templates/review.config.json first.`);
    process.exit(2);
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** Prints or writes the report, then exits 1 when a gated finding exists. */
export function finish({ args, result, markdown }) {
  if (args.json) console.log(JSON.stringify(result, null, 2));
  if (args.report) {
    writeFileSync(args.report, markdown);
    console.log(`Report written to ${args.report}`);
  } else if (!args.json) console.log(markdown);
  process.exit(result.findings.some((f) => f.gate) ? 1 : 0);
}

export const projectName = (config, root) => config.name || basename(root);
