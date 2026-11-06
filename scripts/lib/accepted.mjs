// Rows the owner has looked at and accepted, kept in review.accepted.json so a re-run shows only what is new.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ConfigError } from './findings.mjs';

export const ACCEPTED_FILE = 'review.accepted.json';
const REQUIRED = ['area', 'check', 'file', 'reason', 'date'];

/** The entries in the file, checked: each has an area, check, file, reason and date, and names an area and check that exist. `known` maps each area to its checks. */
export function loadAccepted(root, config, known) {
  const name = config.acceptedFile ?? ACCEPTED_FILE;
  const path = join(root, name);
  if (!existsSync(path)) return [];
  let list;
  try {
    list = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    throw new ConfigError(`${name} is not valid JSON: ${e.message}`);
  }
  if (!Array.isArray(list)) throw new ConfigError(`${name} must be a list of entries.`);
  list.forEach((entry, i) => {
    const at = `${name}, entry ${i + 1}`;
    for (const key of REQUIRED) if (typeof entry?.[key] !== 'string' || !entry[key].trim()) throw new ConfigError(`${at}: "${key}" is required. Each entry needs ${REQUIRED.join(', ')}.`);
    if (!known[entry.area]) throw new ConfigError(`${at}: unknown area "${entry.area}". The areas are: ${Object.keys(known).join(', ')}.`);
    if (!known[entry.area].includes(entry.check)) throw new ConfigError(`${at}: "${entry.check}" is not a check in ${entry.area}. The checks are: ${known[entry.area].join(', ')}.`);
  });
  return list;
}

/** `src/a.ts:12-30` is in `src/a.ts`: line numbers drift, so an entry names the file. */
export const fileOf = (where) => where.replace(/:[\d-]+$/, '');
const covers = (entry, f) => entry.check === f.check && entry.file === fileOf(f.where) && (!entry.contains || f.what.includes(entry.contains));

/**
 * Moves the rows an entry covers out of `findings` into `accepted` (with the reason and date), and lists entries that cover nothing as `stale`.
 * Counts are recomputed, so an accepted gated row no longer fails the run, but it stays visible in every report.
 */
export function applyAccepted(result, entries, area) {
  const mine = entries.filter((e) => e.area === area);
  const used = new Set();
  const findings = [];
  const accepted = [];
  for (const f of result.findings) {
    const i = mine.findIndex((e) => covers(e, f));
    if (i === -1) findings.push(f);
    else {
      used.add(i);
      accepted.push({ ...f, reason: mine[i].reason, date: mine[i].date });
    }
  }
  const counts = Object.fromEntries(Object.keys(result.counts).map((c) => [c, findings.filter((f) => f.check === c).length]));
  return { ...result, findings, counts, accepted, stale: mine.filter((_, i) => !used.has(i)) };
}

/** An area's run function that also applies the accepted file. */
export const withAccepted = (area, run, known) => (config, root) => applyAccepted(run(config, root), loadAccepted(root, config, known), area);
