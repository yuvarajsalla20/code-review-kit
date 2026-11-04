// Runs every structure check for one project and returns one list of findings.
// A finding: { check, gate, where, what, fix, effort, places } (effort: small, medium or large).
import { SOURCE, TEXT, listFiles, readText } from '../lib/files.mjs';
import { buildGraph } from '../lib/imports.mjs';
import { stripComments } from '../lib/source.mjs';
import { findCycles } from './cycles.mjs';
import { checkLayers, checkRestricted } from './layers.mjs';
import { findDuplicateBlocks, findRepeatedValues } from './dupes.mjs';
import { findOversize } from './size.mjs';
import * as describe from './describe.mjs';
import { assemble } from '../lib/findings.mjs';

export const CHECKS = ['cycles', 'layers', 'restricted', 'duplicates', 'repeated', 'size'];
const DEFAULTS = {
  roots: ['src'],
  extra: [],
  ignore: ['tests'],
  aliases: {},
  layers: [],
  restricted: [],
  gate: ['cycles', 'layers', 'restricted'],
  includeTypeOnlyCycles: false,
  duplicates: { minLines: 6, minChars: 120 },
  repeated: { minFiles: 3, ignore: [] },
  size: { maxFileLines: 300, maxFunctionLines: 80 },
};

export const settingsFor = (config) => {
  const s = config.structure ?? {};
  return { ...DEFAULTS, ...s, duplicates: { ...DEFAULTS.duplicates, ...s.duplicates }, repeated: { ...DEFAULTS.repeated, ...s.repeated }, size: { ...DEFAULTS.size, ...s.size } };
};

export function runStructure(config, root) {
  const s = settingsFor(config);
  const sourceFiles = listFiles(root, s.roots, { ignore: s.ignore, match: SOURCE });
  const texts = new Map(sourceFiles.map((f) => [f, stripComments(readText(root, f))]));
  const valueTexts = new Map(texts);
  for (const f of listFiles(root, s.extra, { ignore: s.ignore, match: TEXT })) if (!valueTexts.has(f)) valueTexts.set(f, stripComments(readText(root, f)));

  const { edges, externals } = buildGraph(texts, s.aliases);

  const big = findOversize(texts, s.size);
  const found = [
    ['cycles', findCycles(edges, { includeTypeOnly: s.includeTypeOnlyCycles }), describe.cycle],
    ['layers', checkLayers(edges, s.layers), describe.layer],
    ['restricted', checkRestricted(externals, s.restricted), describe.restricted],
    ['duplicates', findDuplicateBlocks(texts, s.duplicates), describe.duplicate],
    ['repeated', findRepeatedValues(valueTexts, s.repeated), describe.repeated],
    ['size', big.files, describe.bigFile],
    ['size', big.functions, describe.bigFunction],
  ];
  const rows = Object.fromEntries(CHECKS.map((c) => [c, []]));
  for (const [check, items, say] of found) rows[check].push(...items.map(say));
  return { ...assemble(CHECKS, rows, s.gate), files: sourceFiles.length, layered: s.layers.length, settings: s };
}
