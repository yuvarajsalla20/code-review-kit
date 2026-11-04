// Circular imports: groups of files that import each other in a loop.

/** Strongly connected groups of 2+ files (or a file importing itself), each with one example loop. */
export function findCycles(edges, { includeTypeOnly = false } = {}) {
  const next = (f) => (edges.get(f) ?? []).filter((e) => includeTypeOnly || !e.typeOnly).map((e) => e.to);
  const index = new Map();
  const low = new Map();
  const onStack = new Set();
  const stack = [];
  const groups = [];
  let counter = 0;

  const visit = (v) => {
    index.set(v, counter);
    low.set(v, counter);
    counter++;
    stack.push(v);
    onStack.add(v);
    for (const w of next(v)) {
      if (!index.has(w)) {
        visit(w);
        low.set(v, Math.min(low.get(v), low.get(w)));
      } else if (onStack.has(w)) low.set(v, Math.min(low.get(v), index.get(w)));
    }
    if (low.get(v) === index.get(v)) {
      const group = [];
      let w;
      do {
        w = stack.pop();
        onStack.delete(w);
        group.push(w);
      } while (w !== v);
      if (group.length > 1 || next(v).includes(v)) groups.push(group.sort());
    }
  };
  for (const f of [...edges.keys()].sort()) if (!index.has(f)) visit(f);

  return groups.sort((a, b) => a[0].localeCompare(b[0])).map((files) => ({ files, loop: exampleLoop(files, next) }));
}

/** The shortest loop that starts and ends at the first file of the group. */
function exampleLoop(files, next) {
  const inGroup = new Set(files);
  const start = files[0];
  const parent = new Map();
  const queue = [start];
  while (queue.length) {
    const v = queue.shift();
    for (const w of next(v)) {
      if (!inGroup.has(w)) continue;
      if (w === start) {
        const path = [v];
        while (path[0] !== start) path.unshift(parent.get(path[0]));
        return [...path, start];
      }
      if (!parent.has(w)) {
        parent.set(w, v);
        queue.push(w);
      }
    }
  }
  return [start, start];
}
