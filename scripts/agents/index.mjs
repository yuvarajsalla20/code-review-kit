// Checks the kit's own agents: front matter, required sections, shared rules, broken references.
import * as c from './checks.mjs';
import { loadAgents, loadSkills } from './load.mjs';
import { assemble } from '../lib/findings.mjs';

export const CHECKS = ['frontmatter', 'sections', 'references', 'shared', 'repeated', 'orphan', 'size'];
const DEFAULTS = { paths: ['agents'], skills: ['skills'], maxLines: 60, minAgents: 3, gate: ['frontmatter', 'references'] };

export function runAgents(config, root) {
  const s = { ...DEFAULTS, ...config.agents };
  const agents = loadAgents(root, s.paths);
  const skills = loadSkills(root, s.skills);
  const found = {
    frontmatter: c.frontmatter(agents, s),
    sections: c.sections(agents),
    references: c.references(agents, skills, root),
    shared: c.shared(agents),
    repeated: c.repeated(agents, s),
    orphan: c.orphan(agents, skills),
    size: c.size(agents, s),
  };
  const trusted = c.bashOnTrust(agents);
  const notes = trusted.length ? [`Bash is allowed on trust in ${trusted.length} of ${agents.length} reviewers (${trusted.join(', ')}): it can write, so the read-only rule rests on their wording. The skills compare the project before and after with scripts/untouched.mjs.`] : [];
  return { ...assemble(CHECKS, found, s.gate), agents: agents.length, skills: skills.length, notes, settings: s };
}
