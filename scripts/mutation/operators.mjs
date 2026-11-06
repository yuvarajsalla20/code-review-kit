// Small, text-level changes that should break a program's behaviour. Each one is a place where a test ought to notice.
import { stripComments } from '../lib/source.mjs';

/** Operators in the order they are tried at one position (longest first). `>` and `<` count only with spaces around them, so arrows and generics are left alone. */
const TOKEN = /===|!==|>=|<=|&&|\|\||\btrue\b|\bfalse\b| > | < |!(?=[A-Za-z_(])/g;
const SWAP = { '===': '!==', '!==': '===', '>=': '>', '<=': '<', '&&': '||', '||': '&&', true: 'false', false: 'true', ' > ': ' >= ', ' < ': ' <= ', '!': '' };

/** The text with comments and the inside of strings and templates replaced by spaces (same length, same lines). */
export function codeOnly(text) {
  const clean = stripComments(text);
  let out = '';
  let quote = null;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (quote) {
      if (c === '\\') { out += '  '; i++; continue; }
      if (c === quote || (c === '\n' && quote !== '`')) { quote = null; out += c; } else out += c === '\n' ? c : ' ';
    } else {
      if (c === '"' || c === "'" || c === '`') quote = c;
      out += c;
    }
  }
  return out;
}

/** Every possible change in a file: `{ index, from, to, line }`, where `index` is the character position in the real text. */
export function mutantsOf(text) {
  const code = codeOnly(text);
  return [...code.matchAll(TOKEN)].map((m) => ({ index: m.index, from: m[0], to: SWAP[m[0]], line: code.slice(0, m.index).split('\n').length }));
}

export const apply = (text, m) => text.slice(0, m.index) + m.to + text.slice(m.index + m.from.length);

/** At most `max` mutants, spread evenly over the list so the same run gives the same sample. */
export function sample(list, max) {
  if (list.length <= max) return list;
  return Array.from({ length: max }, (_, i) => list[Math.floor((i * list.length) / max)]);
}
