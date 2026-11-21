// Kit-owned packages: an app that imports what one of its shared kits owns does the kit's job itself, and the two drift apart.
// Off unless `structure.owned` lists rules:
//   { "kit": "app-export-kit", "modules": ["expo-sharing", "expo-file-system"], "names": ["writeAsStringAsync"], "allowIn": ["src/export"] }
// `names` (optional) narrows a rule to those exports, such as the file system's write calls, so reading a file stays allowed.
// `allowIn` (optional) lists the app's own files or folders that may still use them (an adapter that hands the module to the kit).
import { inside } from '../lib/files.mjs';
import { ConfigError } from '../lib/findings.mjs';
import { lineFinder } from '../lib/source.mjs';

const IMPORT = /(?:^|\n)[ \t]*(?:import|export)\s+(type\s+)?([^'";]*?)\s+from\s+(['"])([^'"\n]+)\3/g;
const BARE = /(?:^|\n)[ \t]*import\s+(['"])([^'"\n]+)\1/g;
const REQUIRE = /(?:\b(?:const|let|var)\s+([^=;]+?)\s*=\s*)?\b(?:require|import)\(\s*(['"])([^'"\n]+)\2\s*\)/g;

const matches = (spec, module) => spec === module || spec.startsWith(`${module}/`);
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The names an import clause brings in: `named` (by their exported name) and `whole` (a default or namespace binding, used as `X.name`). */
function bindings(clause) {
  const named = [];
  const whole = [];
  const braces = /\{([^}]*)\}/.exec(clause);
  if (braces) for (const part of braces[1].split(',')) {
    const name = part.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim();
    if (name && !/^type\s/.test(part.trim())) named.push(name);
  }
  const rest = clause.replace(/\{[^}]*\}/, '').split(',').map((s) => s.trim()).filter(Boolean);
  for (const r of rest) {
    const ns = /^\*\s+as\s+([\w$]+)$/.exec(r);
    if (ns) whole.push(ns[1]);
    else if (/^[\w$]+$/.test(r)) whole.push(r);
  }
  return { named, whole };
}

/** Every use of a module in one file: `{ module, line, names }`, where `names` are the exports it uses (empty when unknown). */
function uses(clean, modules) {
  const at = lineFinder(clean);
  const out = [];
  const add = (spec, index, clause) => {
    const module = modules.find((m) => matches(spec, m));
    if (!module) return;
    const { named, whole } = clause === undefined ? { named: [], whole: [] } : bindings(clause);
    const used = [...named, ...whole.flatMap((w) => [...clean.matchAll(new RegExp(`\\b${escape(w)}\\s*\\.\\s*([\\w$]+)`, 'g'))].map((m) => m[1]))];
    out.push({ module, line: at(index), names: used, whole: clause === undefined || (whole.length > 0 && !used.length) });
  };
  for (const m of clean.matchAll(IMPORT)) if (!m[1]) add(m[4], m.index + m[0].indexOf(m[3]), m[2]);
  for (const m of clean.matchAll(BARE)) add(m[2], m.index + m[0].indexOf(m[1]));
  for (const m of clean.matchAll(REQUIRE)) add(m[3], m.index, m[1]?.trim().startsWith('{') ? m[1] : m[1] ? m[1].trim() : undefined);
  return out;
}

/** The checked rules: each names its kit and at least one module. */
export function ownedRules(owned = []) {
  if (!Array.isArray(owned)) throw new ConfigError('structure.owned must be a list of { "kit", "modules", "names", "allowIn" } rules.');
  return owned.map((r, i) => {
    const at = `structure.owned rule ${i + 1}`;
    if (typeof r?.kit !== 'string' || !r.kit.trim()) throw new ConfigError(`${at}: "kit" (the kit that owns the modules) is required.`);
    if (!Array.isArray(r.modules) || !r.modules.length || !r.modules.every((m) => typeof m === 'string' && m)) throw new ConfigError(`${at} (${r.kit}): "modules" must list at least one package name.`);
    for (const k of ['names', 'allowIn']) if (r[k] !== undefined && (!Array.isArray(r[k]) || !r[k].every((x) => typeof x === 'string'))) throw new ConfigError(`${at} (${r.kit}): "${k}" must be a list of strings.`);
    return { kit: r.kit, modules: r.modules, names: r.names ?? [], allowIn: r.allowIn ?? [] };
  });
}

/**
 * Imports of a kit-owned module outside `allowIn`. With `names`, only uses of those exports count: a named import of one,
 * or `X.name` on a default or namespace import. A use whose names cannot be told (a bare import, `X` passed on whole) counts.
 */
export function checkOwned(texts, owned = []) {
  const rules = ownedRules(owned);
  const problems = [];
  if (!rules.length) return problems;
  for (const [file, clean] of texts) {
    for (const rule of rules) {
      if (rule.allowIn.some((p) => inside(file, p))) continue;
      for (const u of uses(clean, rule.modules)) {
        const hit = rule.names.length ? u.names.filter((n) => rule.names.includes(n)) : u.names;
        if (rule.names.length && !hit.length && !u.whole) continue;
        problems.push({ file, line: u.line, module: u.module, kit: rule.kit, names: [...new Set(hit)] });
      }
    }
  }
  return problems;
}
