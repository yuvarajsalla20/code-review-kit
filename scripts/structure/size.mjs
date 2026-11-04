// Size: files and functions too big to read and change easily.

/** Top-level function-like declarations, found by their first line and measured by matching braces. */
const START = /^(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function\*?\s+(\w+)|(?:const|let)\s+(\w+)\s*(?::[^=]+)?=\s*(?:async\s+)?(?:\([^)]*\)|\w+)\s*(?::[^=]+)?=>|class\s+(\w+))/;

/** Replaces the inside of strings with spaces so braces in text are not counted. */
const withoutStrings = (line) => line.replace(/(['"`])(?:\\.|(?!\1).)*\1/g, (m) => `${m[0]}${' '.repeat(m.length - 2)}${m[0]}`);

export function measureFunctions(clean) {
  const lines = clean.split('\n');
  const found = [];
  for (let i = 0; i < lines.length; i++) {
    const m = START.exec(lines[i]);
    if (!m) continue;
    let depth = 0;
    let opened = false;
    let end = i;
    for (let j = i; j < lines.length; j++) {
      for (const c of withoutStrings(lines[j])) {
        if (c === '{') {
          depth++;
          opened = true;
        } else if (c === '}') depth--;
      }
      end = j;
      if (opened && depth <= 0) break;
      // A one-line arrow function such as `const f = (x) => x + 1;` has no braces.
      if (!opened && j === i && /;\s*$/.test(lines[j])) break;
    }
    found.push({ name: m[1] ?? m[2] ?? m[3], from: i + 1, to: end + 1, lines: end - i + 1 });
    i = end;
  }
  return found;
}

/** Files over `maxFileLines` and top-level functions over `maxFunctionLines`. */
export function findOversize(texts, { maxFileLines = 300, maxFunctionLines = 80 } = {}) {
  const files = [];
  const functions = [];
  for (const [file, clean] of texts) {
    const total = clean.split('\n').length;
    if (total > maxFileLines) files.push({ file, lines: total, limit: maxFileLines });
    for (const f of measureFunctions(clean)) if (f.lines > maxFunctionLines) functions.push({ file, ...f, limit: maxFunctionLines });
  }
  return { files: files.sort((a, b) => b.lines - a.lines), functions: functions.sort((a, b) => b.lines - a.lines) };
}
