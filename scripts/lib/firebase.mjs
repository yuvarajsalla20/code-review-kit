// Where a Firebase project keeps its files, read once for every check that needs them.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ConfigError } from './findings.mjs';

/** The Storage rules file: the configured one (which must exist), else firebase.json's `storage.rules`, else `storage.rules`. */
export const storageRulesFile = (root, configured) => {
  if (configured !== undefined) {
    if (!existsSync(join(root, configured))) throw new ConfigError(`integrity.storageRules names ${configured}, which does not exist.`);
    return configured;
  }
  try {
    const storage = JSON.parse(readFileSync(join(root, 'firebase.json'), 'utf8')).storage;
    const named = [storage].flat().map((s) => s?.rules).find((r) => typeof r === 'string' && existsSync(join(root, r)));
    if (named) return named;
  } catch {
    // No firebase.json, or one that is not valid JSON: fall back to the usual name.
  }
  return existsSync(join(root, 'storage.rules')) ? 'storage.rules' : undefined;
};
