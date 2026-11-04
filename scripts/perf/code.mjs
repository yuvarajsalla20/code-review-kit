// Patterns in the code that often cost speed or battery. Text matches, so every row is a candidate for the reviewer to open.
import { lineFinder } from '../lib/source.mjs';
import { row } from './row.mjs';

/** The text of the call whose "(" is at `open`, up to its matching ")" (at most 800 characters). */
const callText = (text, open) => {
  let depth = 0;
  for (let i = open; i < Math.min(text.length, open + 800); i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')' && --depth === 0) return text.slice(open, i + 1);
  }
  return text.slice(open, open + 800);
};

/** Every match of `regex` in every file, as `{ file, line, match, text, index }`, when `keep` says so. */
function* matches(texts, regex, keep = () => true) {
  for (const [file, text] of texts) {
    const lineOf = lineFinder(text);
    for (const match of text.matchAll(regex)) if (keep(text, match)) yield { file, text, match, index: match.index, line: lineOf(match.index) };
  }
}

/** True when the animation call has no `useNativeDriver`, or sets it to a literal false. Any other value (a variable, `Platform.OS !== 'web'`) is the author's choice. */
const missesNativeDriver = (text, m) => {
  const value = /useNativeDriver\s*:\s*([^,}\n]+)/.exec(callText(text, m.index + m[0].length - 1));
  return !value || /^false\b/.test(value[1].trim());
};

/** Animations that run on the JavaScript thread, so a busy app makes them stutter. */
export const findAnimations = (texts) =>
  [...matches(texts, /Animated\.(?:timing|spring|decay)\s*\(/g, missesNativeDriver)].map(({ file, line, match }) =>
    row({
      file,
      line,
      what: `${match[0].replace(/\s*\($/, '')} has no useNativeDriver, or sets it to false, so it runs on the JavaScript thread`,
      fix: 'Set useNativeDriver: true. If it animates layout (width, height, top, left) the native driver cannot be used: accept the row.',
    }),
  );

/** The ">" that ends the tag opened at `from`, skipping any ">" inside braces (such as "=>"), or -1. */
const tagEnd = (text, from) => {
  let depth = 0;
  for (let i = from; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') depth--;
    else if (text[i] === '>' && depth === 0) return i;
  }
  return -1;
};

/** True when the ScrollView opened at `from` has children and one of them is drawn with .map. A self-closing one has none. */
const mapsInScrollView = (text, from) => {
  const open = tagEnd(text, from);
  if (open === -1 || text[open - 1] === '/') return false;
  const close = text.indexOf('</ScrollView>', open);
  const next = text.indexOf('<ScrollView', open);
  const end = next !== -1 && (close === -1 || next < close) ? next : close;
  return end !== -1 && /\.map\s*\(/.test(text.slice(open, end));
};

/** Lists drawn with .map inside a ScrollView: every item is drawn at once. */
export const findScrollMaps = (texts) =>
  [...matches(texts, /<ScrollView\b/g, (text, m) => mapsInScrollView(text, m.index))].map(({ file, line }) =>
    row({
      file,
      line,
      what: 'A ScrollView draws a list with .map, so every item is drawn on the first frame and kept in memory',
      fix: 'If the list can grow past a few dozen rows, use FlatList or FlashList, which draw only what is on screen. If it is always short, accept the row.',
      effort: 'medium',
    }),
  );

/** Code that mounts and unmounts. A listener added outside it usually lives as long as the app, so it is not a leak. */
const LIFECYCLE = /\buse(?:Layout|Focus)?Effect\b|\bcomponentDidMount\b/;

/** Things that start work and need an owner to stop it: a start with no stop in the same file. `needs` limits a pair to files that match it. */
const PAIRS = [
  { start: /\bsetInterval\s*\(/g, stop: /\bclearInterval\s*\(/, what: 'A repeating timer is started and nothing in this file stops it', fix: 'Keep the id and call clearInterval in the effect cleanup: return () => clearInterval(id).' },
  { start: /\.(?:addEventListener|addListener)\s*\(/g, stop: /\.(?:removeEventListener|removeListener|remove|off)\s*\(/, needs: LIFECYCLE, what: 'A listener is added in code that mounts and unmounts, and nothing in this file removes it', fix: 'Keep what it returns and call .remove() in the effect cleanup, or call removeEventListener.' },
];
/** Live listeners whose stop function is thrown away, so they can never be stopped. */
const DISCARDED = /(?:^|[;{}])\s*(?:onSnapshot|onAuthStateChanged|onIdTokenChanged)\s*\(/gm;

/** The first hit in each file. */
const firstPerFile = (hits) => [...new Map([...hits].reverse().map((h) => [h.file, h]))].map(([, h]) => h);

export const findCleanupGaps = (texts) => [
  ...PAIRS.flatMap(({ start, stop, needs, what, fix }) => firstPerFile(matches(texts, start, (text) => (!needs || needs.test(text)) && !stop.test(text))).map(({ file, line }) => row({ file, line, what, fix }))),
  ...[...matches(texts, DISCARDED)].map(({ file, line }) =>
    row({ file, line, what: 'A live listener is started and its stop function is not kept, so it keeps running (and reading) after the screen is gone', fix: 'Keep the returned function and call it in the effect cleanup: const stop = onSnapshot(...); return stop;' }),
  ),
];
