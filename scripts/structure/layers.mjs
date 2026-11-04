// Layer rules: which parts of the project may import which, and which packages may be used where.
import { inside } from '../lib/files.mjs';

/** The layer a file belongs to: the one with the longest matching path, or null. */
export function layerOf(file, layers) {
  let best = null;
  let bestLength = -1;
  for (const layer of layers) {
    for (const p of layer.paths) {
      if (inside(file, p) && p.length > bestLength) {
        best = layer;
        bestLength = p.length;
      }
    }
  }
  return best;
}

/** Imports that go from a layer to one it may not use. A layer may always import itself. */
export function checkLayers(edges, layers = []) {
  const byName = new Map(layers.map((l) => [l.name, l]));
  const problems = [];
  for (const [file, list] of edges) {
    const from = layerOf(file, layers);
    if (!from) continue;
    for (const { to, line } of list) {
      const target = layerOf(to, layers);
      if (!target || target.name === from.name) continue;
      if (!(from.mayImport ?? []).includes(target.name)) problems.push({ file, line, to, fromLayer: from.name, toLayer: target.name, known: byName.has(target.name) });
    }
  }
  return problems;
}

/** A package that may only be imported from certain places (for example "firebase" only inside src/data). */
export function checkRestricted(externals, restricted = []) {
  const problems = [];
  for (const [file, list] of externals) {
    for (const { spec, line } of list) {
      for (const rule of restricted) {
        const hit = spec === rule.module || spec.startsWith(`${rule.module}/`);
        if (hit && !rule.onlyIn.some((p) => inside(file, p))) problems.push({ file, line, module: rule.module, onlyIn: rule.onlyIn });
      }
    }
  }
  return problems;
}
