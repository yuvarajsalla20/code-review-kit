// Shared by the test files: write a small project to a temp folder.
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

export const project = (files) => {
  const root = mkdtempSync(join(tmpdir(), 'review-kit-'));
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, name)), { recursive: true });
    writeFileSync(join(root, name), typeof text === 'string' ? text : JSON.stringify(text));
  }
  return root;
};
