// The config block a project gets for each check area when it has none: only folders that exist, and nothing that gates, so adding a block never turns a green run red.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { storageRulesFile } from './firebase.mjs';

const existing = (root, paths) => paths.filter((p) => existsSync(join(root, p)));
const first = (root, paths, fallback) => existing(root, paths).slice(0, 1).concat(existing(root, paths).length ? [] : fallback);

export const STARTERS = {
  structure: (root) => ({ roots: existing(root, ['src', 'App.tsx', 'lib']).length ? existing(root, ['src', 'App.tsx', 'lib']) : ['.'], ignore: ['tests'], gate: [] }),
  release: (root) => ({ appConfig: first(root, ['app.json', 'app.config.js', 'app.config.ts'], ['app.json'])[0], ...(existing(root, ['public/privacy.html', 'privacy.html'])[0] ? { privacyFile: existing(root, ['public/privacy.html', 'privacy.html'])[0] } : {}), gate: [] }),
  tests: (root) => ({ paths: first(root, ['tests', '__tests__', 'test'], ['tests']), risky: existing(root, ['src/data', 'src/notify', 'src/store', 'src/auth']), gate: [] }),
  speed: (root) => ({ roots: existing(root, ['src', 'App.tsx']), assetRoots: existing(root, ['assets']), maxAssetKb: 300, gate: [] }),
  links: (root) => ({ roots: existing(root, ['src', 'App.tsx', 'app']), ignore: ['tests'], gate: [] }),
  integrity: (root) => ({ roots: existing(root, ['src', 'App.tsx', 'app']), ignore: ['tests'], ...(storageRulesFile(root) ? { storageRules: storageRulesFile(root) } : {}), gate: [] }),
  widgets: (root) => ({ roots: existing(root, ['src', 'App.tsx', 'widgets', 'targets']), ignore: ['tests'], gate: [] }),
  agents: () => ({ paths: ['agents'], skills: ['skills'] }),
};

/** What to tell the owner after a starter block is added: the settings only they can supply. */
export const STARTER_NOTES = {
  structure: 'add structure.layers (which folders may import which) so layer rules are checked, and restricted packages if you want them',
  release: 'set release.gate once you have read the rows',
  tests: 'list the files that must never break in tests.risky',
  speed: 'nothing gates; set speed.gate when you want it to. Website files (public/) are left out: they are not in the app download',
  links: 'nothing gates; set links.gate to ["unguarded"] once the rows are fixed or accepted',
  integrity: 'nothing gates; walk the new lines in checklists/firebase.md, money-dates.md and failure-paths.md too',
  widgets: 'walk checklists/widgets.md too; nothing gates',
};
