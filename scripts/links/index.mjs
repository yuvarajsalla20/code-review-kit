// Incoming links and text parsing that can throw: a link any website or message can send must never crash the app or wipe what the person was typing.
// Text matches, so every row is a candidate the reviewer opens before it counts.
import { SOURCE, checkedFiles, readText } from '../lib/files.mjs';
import { assemble } from '../lib/findings.mjs';
import { lineFinder, stripComments } from '../lib/source.mjs';

export const CHECKS = ['unguarded', 'handlers'];
const DEFAULTS = { roots: ['src', 'App.tsx', 'app'], ignore: ['tests'], gate: [] };

/** Calls that throw on bad input: a broken % escape, bad JSON, a malformed URL. */
const THROWS = /\b(decodeURIComponent|decodeURI|JSON\.parse|new URL)\s*\(/g;
/** Code that receives an incoming link. */
const RECEIVES = /\b(Linking\.(addEventListener|getInitialURL)|useURL|useLinkingURL|addUrlListener)\s*\(/;
/** Signs that the handler thinks about unsaved input before it moves the person elsewhere. */
const GUARDS = /discard|unsaved|dirty|hasChanges|beforeRemove|confirm/i;

/** The [start, end] of every `try { ... }` block, by matching braces. */
const tryBlocks = (text) => {
  const blocks = [];
  for (const m of text.matchAll(/\btry\s*\{/g)) {
    let depth = 0;
    for (let i = m.index + m[0].length - 1; i < text.length; i++) {
      if (text[i] === '{') depth++;
      else if (text[i] === '}' && --depth === 0) { blocks.push([m.index, i]); break; }
    }
  }
  return blocks;
};

export function runLinks(config, root) {
  const s = { ...DEFAULTS, ...config.links };
  const files = checkedFiles(root, s.roots, { label: 'links.roots', configured: config.links?.roots !== undefined, ignore: s.ignore, match: SOURCE });
  const unguarded = [];
  const handlers = [];
  for (const file of files) {
    const text = stripComments(readText(root, file));
    const at = lineFinder(text);
    const blocks = tryBlocks(text);
    for (const m of text.matchAll(THROWS)) {
      if (blocks.some(([a, b]) => m.index > a && m.index < b)) continue;
      // `.catch(` on the same statement handles a promise-wrapped parse.
      if (/^[^;\n]*\.catch\s*\(/.test(text.slice(m.index, m.index + 200))) continue;
      const line = at(m.index);
      unguarded.push({ where: `${file}:${line}`, what: `${m[1]}(...) is not inside a try block: bad input (a link with a stray %, broken JSON) throws`, fix: 'Wrap it in try/catch and fall back to a safe value (for a link, the home screen). If this code runs while rendering, a throw there takes down the whole app.', effort: 'small', places: [{ file, from: line }] });
    }
    const receive = RECEIVES.exec(text);
    if (receive && !GUARDS.test(text)) {
      const line = at(receive.index);
      handlers.push({ where: `${file}:${line}`, what: 'This code receives incoming links (widgets, notifications, other apps) and moves to a new screen, with no sign it checks for unsaved input first', fix: 'When a form has unsaved changes, hold the link and ask first (the same Discard prompt as Back), or open it only once the form is saved or empty.', effort: 'small', places: [{ file, from: line }] });
    }
  }
  return { ...assemble(CHECKS, { unguarded, handlers }, s.gate), files: files.length, settings: s };
}
