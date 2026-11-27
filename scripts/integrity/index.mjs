// Data integrity: code patterns that can lose data or show a wrong number without any error. Learned from a full review of a
// shipping Firebase app, where every other script passed while these four mistakes were real. Text matches, so every row is a
// candidate the reviewer opens before it counts.
import { SOURCE, checkedFiles, readText } from '../lib/files.mjs';
import { assemble } from '../lib/findings.mjs';
import { storageRulesFile } from '../lib/firebase.mjs';
import { lineFinder, stripComments } from '../lib/source.mjs';

export const CHECKS = ['cachedSnapshot', 'uploadRetry', 'storagePaths', 'decimalComma'];
const DEFAULTS = { roots: ['src', 'App.tsx', 'app'], ignore: ['tests'], gate: [] };

/** A Firestore listener: a method call (`ref.onSnapshot(`), or a bare call in a file that imports Firestore (mobx-state-tree has its own onSnapshot). */
const SNAPSHOT_METHOD = /\.onSnapshot\s*\(/g;
const SNAPSHOT_BARE = /(?<![.\w])onSnapshot\s*\(/g;
const IMPORTS_FIRESTORE = /from\s+['"](?:firebase\/(?:firestore|compat\/[\w/]*)|@firebase\/firestore)['"]|require\(\s*['"]firebase\/(?:firestore|compat)/;
/** Signs that a cached first answer is handled: the code reads fromCache, Firestore keeps a disk cache, or the native SDK (which persists by default) is used. */
const CACHE_AWARE = /\bfromCache\b|\bpersistentLocalCache\b|\benable(?:MultiTab)?IndexedDbPersistence\b|\benablePersistence\b|@react-native-firebase\/firestore/;
/** A Firebase Storage upload. */
const UPLOAD = /\b(?:uploadBytes|uploadBytesResumable|uploadString)\s*\(|\.putFile\s*\(/g;
/** A shorter retry limit set on the Storage instance. A timeout written around the upload is not seen: the reviewer accepts that row. */
const RETRY_LIMIT = /\bmaxUploadRetryTime\b|\bsetMaxUploadRetryTime\b/;
/** Ways to remove every comma from a string: a global regex replace, `replaceAll(',', '')`, or `split(',').join('')`. */
const REGEX_REPLACE = /\.replace(?:All)?\s*\(\s*\/((?:\\.|\[(?:\\.|[^\]\\\n])*\]|[^/\\\n[])+)\/([a-z]*)\s*,\s*(['"`])\3\s*\)/g;
const STRING_STRIP = /\.replaceAll\s*\(\s*(['"`]),\1\s*,\s*(['"`])\2\s*\)|\.split\s*\(\s*(['"`]),\3\s*\)\s*\.join\s*\(\s*(['"`])\4\s*\)/g;
const TO_NUMBER = /\b(?:Number|parseFloat|parseInt)\s*\(/;

const at = (text, index) => lineFinder(text)(index);
const row = (file, line, what, fix, effort = 'small') => ({ where: `${file}:${line}`, what, fix, effort, places: [{ file, from: line }] });

/** The first listener in each file that is a Firestore listener. */
const firstListener = (text) => {
  const method = new RegExp(SNAPSHOT_METHOD.source).exec(text);
  const bare = IMPORTS_FIRESTORE.test(text) ? new RegExp(SNAPSHOT_BARE.source).exec(text) : null;
  const hits = [method, bare].filter(Boolean).map((m) => m.index);
  return hits.length ? Math.min(...hits) : -1;
};

/** Every listener file, when nothing in the project handles a cached first answer. With a memory-only cache, a listener opened offline gets an empty, cached answer first. */
const findCachedSnapshots = (texts) => {
  if ([...texts.values()].some((t) => CACHE_AWARE.test(t))) return [];
  return [...texts].flatMap(([file, text]) => {
    const index = firstListener(text);
    return index === -1 ? [] : [row(file, at(text, index), 'A live listener takes the first answer as the truth, and nothing in the project reads snap.metadata.fromCache or keeps a disk cache. Opened offline with a memory-only cache, Firestore answers at once from that cache, which is empty: no items, or a document that seems missing', 'Ignore answers with metadata.fromCache true (and empty) until the first answer from the server arrives (onSnapshot with { includeMetadataChanges: true }). Never overwrite a saved copy, or treat an item as gone, from a cached answer. Add a test that feeds an empty cached answer.')];
  });
};

/** Upload calls, when nothing in the project shortens Firebase Storage's retry limit, which is 10 minutes by default. */
const findUploadRetry = (texts) => {
  if ([...texts.values()].some((t) => RETRY_LIMIT.test(t))) return [];
  return [...texts].flatMap(([file, text]) => {
    const m = new RegExp(UPLOAD.source).exec(text);
    return m ? [row(file, at(text, m.index), 'A Firebase Storage upload runs with the default retry limit of 10 minutes, and nothing in the project sets a shorter one. Offline or on a weak network, the save waits up to 10 minutes before it fails', 'Set storage.maxUploadRetryTime (and maxOperationRetryTime) to about 20 to 30 seconds where the Storage instance is made, and tell the person when it runs out. A timeout written around the upload also works: accept the row then.')] : [];
  });
};

/** The text inside the block whose `{` is at `open`, up to its matching `}`. */
const blockBody = (text, open) => {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) return text.slice(open + 1, i);
  }
  return text.slice(open + 1);
};

/** Storage rules that let a user write any file at any depth under their folder: no tie to an item, no limit on how many. */
const findStoragePaths = (root, file) => {
  if (!file) return [];
  const text = stripComments(readText(root, file));
  const rows = [];
  // A path made of plain segments and {name} segments, ending in a {name=**} wildcard.
  for (const m of text.matchAll(/match\s+\/(?:[^{}\s]|\{\w+\})*\{\s*\w+\s*=\s*\*\*\s*\}\s*\{/g)) {
    const body = blockBody(text, m.index + m[0].length - 1);
    // A write or create that is not simply `if false` (the usual deny-everything-else rule). A semicolon is optional.
    const writes = [...body.matchAll(/\ballow\s+([\w\s,]*?)\s*(?::\s*if\s+([^;{}]*?))?\s*(?:;|(?=\ballow\b|\bmatch\b|\}|$))/g)].filter((a) => /\b(?:write|create)\b/.test(a[1]));
    if (writes.some((a) => (a[2] ?? 'true').trim() !== 'false')) rows.push(row(file, at(text, m.index), 'A recursive wildcard ({path=**}) lets a signed-in user write files at any depth under this path, with no link to an item they own and no limit on how many', 'Match the exact file path the app writes (for example /users/{uid}/items/{itemId}/{file} with a name pattern), require the item to exist (firestore.exists in Storage rules), and set a budget alert.'));
  }
  return rows;
};

/** True when a regex pattern removes commas: a bare comma, a class that lists one, or a negated class that does not (such as [^0-9.]), or \D. */
const patternStripsComma = (pattern) => {
  if (/^\\?,$/.test(pattern) || pattern === '\\D') return true;
  const cls = /^\[(\^?)((?:\\.|[^\]\\])*)\]\+?$/.exec(pattern);
  if (!cls) return false;
  const listsComma = /(?:^|[^\\]),|\\,/.test(cls[2]);
  return cls[1] ? !listsComma : listsComma;
};

/** A number parser that removes every comma: on a phone whose region types a decimal comma, "2,5" is read as 25. */
const findDecimalComma = (texts) =>
  [...texts].flatMap(([file, text]) => {
    const strips = [
      ...[...text.matchAll(REGEX_REPLACE)].filter((m) => (m[2].includes('g') || m[0].startsWith('.replaceAll')) && patternStripsComma(m[1])),
      ...text.matchAll(STRING_STRIP),
    ];
    return strips
      .filter((m) => TO_NUMBER.test(text.slice(Math.max(0, m.index - 80), m.index + m[0].length + 200)))
      .sort((a, b) => a.index - b.index)
      .map((m) => row(file, at(text, m.index), 'A typed number has every comma removed before it is read, so a decimal comma ("2,5" on a phone set to a European region) becomes 25, and "1,5.0" becomes 15', 'Accept commas only as digit-group separators (1,23,456 or 123,456), read a single comma followed by one to three digits at the end as the decimal point, and refuse anything else. Add parse tests for "2,5" and "1,5.0".'));
  });

export function runIntegrity(config, root) {
  const s = { ...DEFAULTS, ...config.integrity };
  const files = checkedFiles(root, s.roots, { label: 'integrity.roots', configured: config.integrity?.roots !== undefined, ignore: s.ignore, match: SOURCE });
  const texts = new Map(files.map((f) => [f, stripComments(readText(root, f))]));
  const rules = storageRulesFile(root, config.integrity?.storageRules);
  const found = { cachedSnapshot: findCachedSnapshots(texts), uploadRetry: findUploadRetry(texts), storagePaths: findStoragePaths(root, rules), decimalComma: findDecimalComma(texts) };
  return { ...assemble(CHECKS, found, s.gate), files: files.length, rulesFile: rules, settings: s };
}
