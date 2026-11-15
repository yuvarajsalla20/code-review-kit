// The firestoreLoad block of review.config.json, checked and filled with defaults. Pure: no files, no network.
import { ConfigError } from '../lib/findings.mjs';

const DEFAULTS = { rules: 'firestore.rules', projectId: 'demo-review-kit', port: 8080, users: 300, perUser: 20, heavy: 2000, invalid: [], ownerRequired: false };

export function loadPlan(config) {
  const block = config.firestoreLoad;
  if (!block) throw new ConfigError('No "firestoreLoad" block in review.config.json. See the README section "Firestore load and rules test".');
  const plan = { ...DEFAULTS, ...block };
  for (const key of ['owner', 'items']) if (typeof plan[key] !== 'string' || !plan[key].includes('{uid}')) throw new ConfigError(`firestoreLoad.${key} must be a path with {uid} in it, e.g. "users/{uid}"${key === 'items' ? '/items' : ''}.`);
  if (!plan.item || typeof plan.item !== 'object') throw new ConfigError('firestoreLoad.item must be one valid item, as the app writes it.');
  if (!plan.profile || typeof plan.profile !== 'object') plan.profile = {};
  if (!plan.projectId.startsWith('demo-')) throw new ConfigError('firestoreLoad.projectId must start with "demo-", so the emulator can never reach a real project.');
  for (const key of ['users', 'perUser', 'heavy']) if (!(Number.isInteger(plan[key]) && plan[key] > 0)) throw new ConfigError(`firestoreLoad.${key} must be a whole number above 0.`);
  plan.labelField ??= Object.keys(plan.item).find((k) => typeof plan.item[k] === 'string' && k !== plan.idField && k !== plan.newerField);
  if (plan.newerField && !plan.labelField) throw new ConfigError('firestoreLoad.labelField: name one string field the race test can write into.');
  return plan;
}

/** The runner's JSON lines as rows, and whether every test passed. */
export function readRun(stdout) {
  const rows = stdout.split('\n').filter((l) => l.startsWith('{"kind"')).map((l) => JSON.parse(l));
  return { rows, ok: rows.length > 0 && rows.every((r) => r.ok) };
}
