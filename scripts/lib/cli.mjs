// What every command-line script needs: arguments, the config file, and a consistent way to finish.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { basename, join } from 'node:path';

const VALUE_FLAGS = ['report', 'html', 'extra', 'areas'];

/** Flags and the config path: `--report out.md`, `--html out.html`, `--extra file.json`, `--areas a,b`, `--json`, and an optional config path as the first plain argument. */
export function parseArgs(argv = process.argv.slice(2)) {
  const values = Object.fromEntries(VALUE_FLAGS.map((f) => [f, argv[argv.indexOf(`--${f}`) + 1]]).filter(([f]) => argv.includes(`--${f}`)));
  const plain = argv.filter((a, i) => !a.startsWith('--') && !VALUE_FLAGS.some((f) => argv[i - 1] === `--${f}`));
  return { ...values, json: argv.includes('--json'), configPath: plain[0] };
}

/** Reads review.config.json (or the path given); stops with exit code 2 and a hint when there is none, unless `optional` (then it returns `{}`). */
export function loadConfig(root, configPath, { optional = false } = {}) {
  const path = configPath || join(root, 'review.config.json');
  if (!existsSync(path) && optional) return {};
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
