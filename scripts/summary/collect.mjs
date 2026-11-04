// Runs each check area the config asks for (or the areas named). Returns `[{ area, result }]`.
import { AREAS } from '../areas.mjs';
import { ConfigError } from '../lib/findings.mjs';

/** A request that would run nothing is an error: a summary that says Ready after checking nothing is worse than no summary. */
export function collect(config, root, areas) {
  const known = AREAS.map((a) => a.key);
  const unknown = (areas ?? []).filter((a) => !known.includes(a));
  if (unknown.length) throw new ConfigError(`Unknown area${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}. The areas are: ${known.join(', ')}.`);
  const chosen = AREAS.filter((a) => (areas?.length ? areas.includes(a.key) : config[a.key]));
  if (!chosen.length) throw new ConfigError(`No checks to run. Add a ${known.join(', ')} block to review.config.json, or pass --areas.`);
  return chosen.map((a) => ({ area: a.key, result: a.run(config, root) }));
}
