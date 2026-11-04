// One way for every check area to turn its rows into findings and counts.
export class ConfigError extends Error {}

/**
 * `found` maps each check name to its rows; `gate` lists the checks that fail the run.
 * Every finding gets `check`, `gate` and `places` (empty unless the row has its own). A gate name that is not a check stops the run, so a typo cannot switch a check off.
 */
export function assemble(checks, found, gate) {
  const unknown = gate.filter((g) => !checks.includes(g));
  if (unknown.length) throw new ConfigError(`Unknown gate name${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}. The checks are: ${checks.join(', ')}.`);
  const gated = new Set(gate);
  const findings = checks.flatMap((check) => (found[check] ?? []).map((row) => ({ check, gate: gated.has(check), places: [], ...row })));
  return { findings, counts: Object.fromEntries(checks.map((c) => [c, (found[c] ?? []).length])), gate };
}
