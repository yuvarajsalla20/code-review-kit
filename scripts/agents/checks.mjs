// One function per check. Each takes the loaded agents (and skills) and returns findings without the gate flag.
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const SUPPORTED = ['name', 'description', 'model', 'effort', 'maxTurns', 'tools', 'disallowedTools', 'skills', 'memory', 'background', 'omitClaudeMd', 'isolation', 'color', 'experimental'];
const IGNORED = ['permissionMode', 'hooks', 'mcpServers', 'initialPrompt'];
const SHARED = /rules\/review-rules\.md/;
/** The tools a reviewer may have. Anything else (Edit, Write, NotebookEdit, MultiEdit, a new write-capable tool) is flagged. */
export const READ_ONLY_TOOLS = ['Read', 'Grep', 'Glob', 'Bash', 'LS', 'WebFetch', 'WebSearch'];

const row = (where, what, fix, effort = 'small', places = []) => ({ where, what, fix, effort, places });
/** One row for a problem several agents share, so the owner decides once. */
const grouped = (agents, what, fix, effort) => (agents.length ? [row(agents.map((a) => a.file).join(', '), what, fix, effort, agents.map((a) => ({ file: a.file, from: 1 })))] : []);
const has = (agent, re) => re.test(agent.body);

export function frontmatter(agents, { allowedTools = READ_ONLY_TOOLS } = {}) {
  return agents.flatMap((a) => {
    if (!a.front) return [row(a.file, 'No front matter, so the agent loads with every field ignored and takes its name from the file', 'Add the `---` block with name, description and tools.')];
    const f = a.front;
    const out = [];
    if (f.name !== a.stem) out.push(row(a.file, `\`name\` is ${f.name ? `"${f.name}"` : 'missing'} but the file is ${a.stem}.md`, 'Make the name match the file name.'));
    if (!f.description) out.push(row(a.file, 'No `description`, so nothing tells Claude when to use this agent', 'Add one line: what it judges and that it never edits.'));
    if (!a.tools.length) out.push(row(a.file, 'No `tools` line, so the agent inherits every tool, including Edit and Write', 'List the read-only tools: Read, Grep, Glob, Bash.'));
    const unsafe = a.tools.filter((t) => !allowedTools.includes(t));
    if (unsafe.length) out.push(row(a.file, `Tools include ${unsafe.join(', ')}, which ${unsafe.length > 1 ? 'are' : 'is'} not on the read-only list (${allowedTools.join(', ')}); reviewers must never edit`, 'Remove them, or add a tool to `agents.allowedTools` if it is read-only.'));
    const odd = Object.keys(f).filter((k) => IGNORED.includes(k) || !SUPPORTED.includes(k));
    if (odd.length) out.push(row(a.file, `Field${odd.length > 1 ? 's' : ''} ${odd.join(', ')} ${odd.length > 1 ? 'are' : 'is'} ignored or unknown in plugin agents`, 'Remove it.'));
    return out;
  });
}

const REQUIRED = [
  ['a Method section', /^##\s+.*method/im],
  ['a Rules section', /^##\s+.*rules/im],
  ['an Output section', /^##\s+.*output/im],
];
export const sections = (agents) =>
  agents.flatMap((a) => {
    const missing = REQUIRED.filter(([, re]) => !has(a, re)).map(([label]) => label);
    return missing.length ? [row(a.file, `Missing ${missing.join('; ')}`, 'Add what is missing, or point to the shared rules if one exists.')] : [];
  });

/** The conduct rules, severity scale and topic owners live in one file; an agent that does not point to it has its own copy or none. */
export const shared = (agents) =>
  grouped(
    agents.filter((a) => !has(a, SHARED)),
    'These agents do not point to `rules/review-rules.md`, so they may carry their own copy of the rules and scale, or lack the read-only, kit-path and "could not check" rules',
    'Add the pointer in Inputs and Severity, and delete the duplicated lines.',
    'medium',
  );

const norm = (l) => l.trim().replace(/^[-*\d.)\s]+/, '').replace(/\s+/g, ' ');
/** Lines of 40+ characters that appear word for word in `minAgents` or more agents, merged into runs. */
export function repeated(agents, { minAgents = 3 } = {}) {
  const seen = new Map();
  for (const a of agents) a.lines.forEach((l, i) => {
    const t = norm(l);
    if (t.length < 40 || l.startsWith('#') || SHARED.test(l)) return;
    const e = seen.get(t) ?? { files: new Set(), first: a.file, line: i + a.offset + 1 };
    e.files.add(a.file);
    seen.set(t, e);
  });
  const hits = [...seen.entries()].filter(([, e]) => e.files.size >= minAgents).map(([t, e]) => ({ t, ...e, key: [...e.files].sort().join() })).sort((x, y) => x.first.localeCompare(y.first) || x.line - y.line);
  const runs = [];
  for (const h of hits) {
    const last = runs.at(-1);
    if (last && last.key === h.key && last.first === h.first && h.line - last.end <= 2) { last.end = h.line; last.count++; } else runs.push({ ...h, end: h.line, count: 1 });
  }
  return runs.map((r) => row(`${r.first}:${r.line}`, `${r.count} line${r.count > 1 ? 's' : ''} repeated word for word in ${r.files.size} agents ("${r.t.slice(0, 60)}...")`, 'Move it to the shared rules file and point to it.', 'small', [...r.files].map((file) => ({ file, from: 1 }))));
}

const CANDIDATE = /`([\w.\-/<>]+\.(?:md|mjs|json))`/g;
const OPTIONAL = /if present|if any|optional/i;
const NAMES = /`((?:[a-z]+-)*reviewer)`/g;
const kitRel = (p) => p.replace(/^<kit>\//, '');
const OUTPUTS = /--report\s+\S+/;
/** Files named in backticks must exist, and a `*-reviewer` name must be an agent. */
export function references(agents, skills, root) {
  const names = new Set(agents.map((a) => a.front?.name ?? a.stem));
  // A path with a folder must exist. A bare name is checked only when it is a kit document (.md); project files such as app.json are not the kit's.
  const known = (p) => (p.includes('/') ? existsSync(join(root, kitRel(p))) : !p.endsWith('.md') || p === 'SKILL.md' || ['checklists', 'templates'].some((d) => existsSync(join(root, d, p))));
  const docs = [...agents.map((a) => ({ file: a.file, text: a.body, offset: a.offset })), ...skills.map((s) => ({ file: s.file, text: s.text, offset: 0 }))];
  return docs.flatMap((d) =>
    d.text.split('\n').flatMap((line, i) => {
      const where = `${d.file}:${i + d.offset + 1}`;
      const files = [...line.matchAll(CANDIDATE)].map((m) => m[1]).filter((p) => !/[<{*]/.test(p.replace(/^<kit>\//, '')) && !known(p) && !OPTIONAL.test(line) && !(OUTPUTS.test(line) && line.includes(p)));
      const bad = [...line.matchAll(NAMES)].map((m) => m[1]).filter((n) => !names.has(n));
      return [
        ...files.map((p) => row(where, `Names \`${p}\`, which does not exist`, 'Fix the path or remove the mention.')),
        ...bad.map((n) => row(where, `Names the agent \`${n}\`, which does not exist`, 'Use the real agent name.')),
      ];
    }),
  );
}

export const orphan = (agents, skills) => {
  const text = skills.map((s) => s.text).join('\n');
  return agents.filter((a) => !text.includes(`\`${a.front?.name ?? a.stem}\``)).map((a) => row(a.file, 'No skill starts this agent', 'Add it to a skill, or remove it.'));
};

export const size = (agents, { maxLines = 60 } = {}) => agents.filter((a) => a.lines.length > maxLines).map((a) => row(a.file, `${a.lines.length} lines; a long agent is read less carefully (limit ${maxLines})`, 'Move shared rules out, or split the agent.', 'medium'));
