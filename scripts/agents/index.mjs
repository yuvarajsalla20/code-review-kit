// Checks the kit's own agents: front matter, required sections, shared rules, broken references.
import * as c from './checks.mjs';
import { loadAgents, loadSkills } from './load.mjs';

export const CHECKS = ['frontmatter', 'sections', 'references', 'shared', 'repeated', 'orphan', 'size'];
const DEFAULTS = { paths: ['agents'], skills: ['skills'], maxLines: 60, minAgents: 3, gate: ['frontmatter', 'references'] };

export function runAgents(config, root) {
  const s = { ...DEFAULTS, ...config.agents };
  const agents = loadAgents(root, s.paths);
  const skills = loadSkills(root, s.skills);
  const found = {
    frontmatter: c.frontmatter(agents),
    sections: c.sections(agents),
    references: c.references(agents, skills, root),
    shared: c.shared(agents),
    repeated: c.repeated(agents, s),
    orphan: c.orphan(agents, skills),
    size: c.size(agents, s),
  };
  const findings = CHECKS.flatMap((check) => found[check].map((f) => ({ check, gate: s.gate.includes(check), ...f })));
  return { findings, counts: Object.fromEntries(CHECKS.map((k) => [k, found[k].length])), gate: s.gate, agents: agents.length, skills: skills.length, settings: s };
}
