// Turns source text into something safe to analyse. Line numbers never change: removed text becomes spaces.

/** Replaces comments with spaces, leaving strings, template text and every newline where they were. */
export function stripComments(text) {
  let out = '';
  let i = 0;
  let quote = null;
  while (i < text.length) {
    const c = text[i];
    const next = text[i + 1];
    if (quote) {
      out += c;
      if (c === '\\') {
        out += next ?? '';
        i += 2;
        continue;
      }
      if (c === quote || (c === '\n' && quote !== '`')) quote = null;
      i++;
    } else if (c === '/' && next === '/') {
      while (i < text.length && text[i] !== '\n') {
        out += ' ';
        i++;
      }
    } else if (c === '/' && next === '*') {
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) {
        out += text[i] === '\n' ? '\n' : ' ';
        i++;
      }
      out += '  ';
      i += 2;
    } else {
      if (c === '"' || c === "'" || c === '`') quote = c;
      out += c;
      i++;
    }
  }
  return out;
}

/** Replaces matched text with spaces, keeping its newlines. */
const blank = (match) => match.replace(/[^\n]/g, ' ');

/** Import and re-export statements, blanked out: a list of imported names is not "duplicated code". */
export const withoutImports = (clean) =>
  clean
    .replace(/(^|\n)([ \t]*)(import|export)\s+(?:type\s+)?(?:[^'";]*?\s+from\s+)?(['"])[^'"\n]+\4[ \t]*;?/g, (m, a, b) => a + blank(m.slice(a.length)))
    .replace(/(^|\n)([ \t]*)import\s+(['"])[^'"\n]+\3[ \t]*;?/g, (m, a) => a + blank(m.slice(a.length)));

/** Returns a function that turns a character position into a 1-based line number (fast, for many lookups in one file). */
export const lineFinder = (text) => {
  const starts = [0];
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) starts.push(i + 1);
  return (index) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= index) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };
};
