// What every command-line script needs: arguments, the config file, and a consistent way to finish.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { basename, join } from 'node:path';
import { ConfigError } from './findings.mjs';
import { KIT_VERSION } from './version.mjs';

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
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    console.error(`${path} is not valid JSON: ${e.message}`);
    process.exit(2);
  }
}

/** Runs `fn`; a configuration mistake prints one clear line and exits 2 instead of a stack trace. */
export function guard(fn) {
  try {
    return fn();
  } catch (e) {
    if (!(e instanceof ConfigError)) throw e;
    console.error(`Config problem: ${e.message}`);
    process.exit(2);
  }
}

/** Prints or writes the report, then exits 1 when something failed (by default, when a gated finding exists). */
export function finish({ args, result, markdown, failed = result.findings.some((f) => f.gate) }) {
  if (args.json) console.log(JSON.stringify(result, null, 2));
  if (args.report) {
    writeFileSync(args.report, markdown);
    console.log(`Report written to ${args.report}`);
  } else if (!args.json) console.log(markdown);
  process.exit(failed ? 1 : 0);
}

export const projectName = (config, root) => config.name || basename(root);

/** The whole stand-alone command for one check area: read the config, run the check, write the report, set the exit code. */
export function runCli({ run, toMarkdown, optionalConfig = false }) {
  const root = process.cwd();
  const args = parseArgs();
  const config = loadConfig(root, args.configPath, { optional: optionalConfig });
  const result = guard(() => run(config, root));
  finish({ args, result, markdown: toMarkdown(projectName(config, root), KIT_VERSION, new Date().toISOString().slice(0, 10), result) });
}
