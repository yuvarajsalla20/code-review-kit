// Data integrity: code patterns that can lose data or show a wrong number without any error. Learned from a full review of a
// shipping Firebase app, where every other script passed while these four mistakes were real. Text matches, so every row is a
// candidate the reviewer opens before it counts.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { SOURCE, checkedFiles, readText } from '../lib/files.mjs';
import { assemble } from '../lib/findings.mjs';
import { lineFinder, stripComments } from '../lib/source.mjs';

export const CHECKS = ['cachedSnapshot', 'uploadRetry', 'storagePaths', 'decimalComma'];
const DEFAULTS = { roots: ['src', 'App.tsx', 'app'], ignore: ['tests'], storageRules: 'storage.rules', gate: [] };

/** A live Firestore listener from the web SDK. */
const SNAPSHOT = /\bonSnapshot\s*\(/g;
/** Signs that a cached first answer is handled: the code reads fromCache, or Firestore keeps a disk cache, or the native SDK (which persists by default) is used. */
const CACHE_AWARE = /\bfromCache\b|\bpersistentLocalCache\b|\benable(?:MultiTab)?IndexedDbPersistence\b|@react-native-firebase\/firestore/;
/** A Firebase Storage upload. */
const UPLOAD = /\b(?:uploadBytes|uploadBytesResumable|uploadString)\s*\(|\.putFile\s*\(/g;
/** A shorter retry limit, set on the Storage instance or by a timeout of the app's own around the upload. */
const RETRY_LIMIT = /\bmaxUploadRetryTime\b|\bsetMaxUploadRetryTime\b/;
/** A `replace` whose pattern removes every comma, written as a character class or a bare comma, with the global flag. */
const STRIP_COMMA = /\.replace(?:All)?\s*\(\s*\/(?:\[[^\]\n]*,[^\]\n]*\]|,)[^/\n]*\/[a-z]*g[a-z]*\s*,\s*(['"`])\1\s*\)/g;
/** The text right after the strip turns it into a number. */
const TO_NUMBER = /\b(?:Number|parseFloat|parseInt)\s*\(/;

const at = (text, index) => lineFinder(text)(index);
const row = (file, line, what, fix, effort = 'small') => ({ where: `${file}:${line}`, what, fix, effort, places: [{ file, from: line }] });

/** The first hit of `regex` in each file whose text passes `keep`, as `{ file, text, index }`. */
const firstHits = (texts, regex, keep = () => true) =>
  [...texts].flatMap(([file, text]) => {
    if (!keep(text)) return [];
    const m = new RegExp(regex.source, regex.flags).exec(text);
    return m ? [{ file, text, index: m.index }] : [];
  });

/** Every listener file, when nothing in the project handles a cached first answer. With a memory-only cache, a listener opened offline gets an empty, cached answer first. */
const findCachedSnapshots = (texts) => {
  if ([...texts.values()].some((t) => CACHE_AWARE.test(t))) return [];
  return firstHits(texts, SNAPSHOT).map(({ file, text, index }) =>
    row(file, at(text, index), 'A live listener takes the first answer as the truth, and nothing in the project reads snap.metadata.fromCache or keeps a disk cache. Opened offline with a memory-only cache, Firestore answers at once from that cache, which is empty: no items, or a document that seems missing', 'Ignore answers with metadata.fromCache true (and empty) until the first answer from the server arrives (onSnapshot with { includeMetadataChanges: true }). Never overwrite a saved copy, or treat an item as gone, from a cached answer. Add a test that feeds an empty cached answer.'),
  );
};

/** Upload calls, when nothing in the project shortens Firebase Storage's retry limit, which is 10 minutes by default. */
const findUploadRetry = (texts) => {
  if ([...texts.values()].some((t) => RETRY_LIMIT.test(t))) return [];
  return firstHits(texts, UPLOAD).map(({ file, text, index }) =>
    row(file, at(text, index), 'A Firebase Storage upload runs with the default retry limit of 10 minutes, and nothing in the project sets a shorter one. Offline or on a weak network, the save waits up to 10 minutes before it fails', 'Set storage.maxUploadRetryTime (and maxOperationRetryTime) to about 20-30 seconds where the Storage instance is made, or race the upload with a timeout, and tell the person when it runs out.'),
  );
};

/** Storage rules that let a user write any file at any depth under their folder: no tie to an item, no limit on how many. */
const findStoragePaths = (root, s) => {
  const file = s.storageRules;
  if (!file || !existsSync(join(root, file))) return [];
  const text = stripComments(readText(root, file));
  const rows = [];
  // A path made of plain segments and {name} segments, ending in a {name=**} wildcard.
  for (const m of text.matchAll(/match\s+\/(?:[^{}\s]|\{\w+\})*\{\s*\w+\s*=\s*\*\*\s*\}\s*\{/g)) {
    const rest = text.slice(m.index + m[0].length);
    const next = rest.search(/\bmatch\s+\//);
    const body = next === -1 ? rest.slice(0, 600) : rest.slice(0, next);
    // A write or create that is not simply `if false` (the usual deny-everything-else rule).
    const writes = [...body.matchAll(/\ballow\s+([\w\s,]*?)\s*(?::\s*if\s+([^;]*))?;/g)].filter((a) => /\b(?:write|create)\b/.test(a[1]));
    if (writes.some((a) => (a[2] ?? 'true').trim() !== 'false')) rows.push(row(file, at(text, m.index), 'A recursive wildcard ({path=**}) lets a signed-in user write files at any depth under this path, with no link to an item they own and no limit on how many', 'Match the exact file path the app writes (for example /users/{uid}/items/{itemId}/{file} with a name pattern), require the item to exist (firestore.exists in Storage rules), and set a budget alert.'));
  }
  return rows;
};

/** A number parser that removes every comma: on a phone whose region types a decimal comma, "2,5" is read as 25. */
const findDecimalComma = (texts) =>
  [...texts].flatMap(([file, text]) =>
    [...text.matchAll(STRIP_COMMA)]
      .filter((m) => TO_NUMBER.test(text.slice(Math.max(0, m.index - 80), m.index + m[0].length + 200)))
      .map((m) => row(file, at(text, m.index), 'A typed number has every comma removed before it is read, so a decimal comma ("2,5" on a phone set to a European region) becomes 25, and "1,5.0" becomes 15', 'Accept commas only as digit-group separators (1,23,456 or 123,456), read a single comma followed by one to three digits at the end as the decimal point, and refuse anything else. Add parse tests for "2,5" and "1,5.0".')),
  );

export function runIntegrity(config, root) {
  const s = { ...DEFAULTS, ...config.integrity };
  const files = checkedFiles(root, s.roots, { label: 'integrity.roots', configured: config.integrity?.roots !== undefined, ignore: s.ignore, match: SOURCE });
  const texts = new Map(files.map((f) => [f, stripComments(readText(root, f))]));
  const found = { cachedSnapshot: findCachedSnapshots(texts), uploadRetry: findUploadRetry(texts), storagePaths: findStoragePaths(root, s), decimalComma: findDecimalComma(texts) };
  return { ...assemble(CHECKS, found, s.gate), files: files.length, settings: s };
}
