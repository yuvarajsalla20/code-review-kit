// Advisory mutation check: change the code a little, run the tests, and report the changes no test noticed.
// It works on a temporary COPY of the project, so the project itself is never edited. Slow, so it is not part of the default run.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ALWAYS_SKIP, listFiles, readText } from '../lib/files.mjs';
import { ConfigError, assemble } from '../lib/findings.mjs';
import { apply, mutantsOf, sample } from './operators.mjs';

export const CHECKS = ['survivors'];
const DEFAULTS = { files: [], run: 'npm test', maxMutants: 25, timeoutSec: 120, copyIgnore: [], gate: [] };

/** True when the command exits 0. Node's test-runner variable is removed so a `node --test` run here is a real run, even when this script was itself started by a test. */
const passes = (cmd, cwd, timeoutSec) => {
  const { NODE_TEST_CONTEXT, ...env } = process.env;
  return spawnSync(cmd, { cwd, env, shell: true, stdio: 'pipe', timeout: timeoutSec * 1000 }).status === 0;
};
const shorten = (s) => (s.length > 40 ? `${s.slice(0, 37)}...` : s);

export function runMutation(config, root) {
  const s = { ...DEFAULTS, ...config.mutation };
  if (!s.files.length) throw new ConfigError('mutation.files is empty. List the source files (or folders) whose logic the tests should protect.');
  const files = listFiles(root, s.files);
  if (!files.length) throw new ConfigError(`mutation.files matches no source file: ${s.files.join(', ')}. Check the spelling.`);

  const skip = new Set([...ALWAYS_SKIP, ...s.copyIgnore]);
  const copy = mkdtempSync(join(tmpdir(), 'review-mutation-'));
  try {
    cpSync(root, copy, { recursive: true, filter: (src) => !skip.has(src.split(/[\\/]/).at(-1)) });
    if (existsSync(join(root, 'node_modules'))) symlinkSync(join(root, 'node_modules'), join(copy, 'node_modules'), 'dir');
    if (!passes(s.run, copy, s.timeoutSec)) throw new ConfigError(`The tests (\`${s.run}\`) do not pass on an unchanged copy, so a changed copy proves nothing. Make them pass first.`);

    const all = files.flatMap((file) => mutantsOf(readText(root, file)).map((m) => ({ ...m, file })));
    const chosen = sample(all, s.maxMutants);
    const survivors = [];
    for (const m of chosen) {
      const path = join(copy, m.file);
      const original = readFileSync(path, 'utf8');
      writeFileSync(path, apply(original, m));
      const survived = passes(s.run, copy, s.timeoutSec);
      writeFileSync(path, original);
      if (survived) survivors.push(m);
    }
    const rows = survivors.map((m) => ({ where: `${m.file}:${m.line}`, what: `Changing \`${shorten(m.from.trim())}\` to \`${shorten(m.to.trim()) || 'nothing'}\` here breaks the code, yet every test still passes`, fix: 'Add a test that fails when this condition is wrong. If it cannot matter, accept the row with a reason.', effort: 'small', places: [{ file: m.file, from: m.line }] }));
    const stats = { total: all.length, tried: chosen.length, killed: chosen.length - survivors.length, survived: survivors.length };
    return { ...assemble(CHECKS, { survivors: rows }, s.gate), settings: s, stats };
  } finally {
    rmSync(copy, { recursive: true, force: true });
  }
}
