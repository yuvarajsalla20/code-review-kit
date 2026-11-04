---
name: agent-review
description: Review the review kit's own agents - run the agent checks, have the agent-reviewer verify each row, and hand the owner one decision table. Use for "review the review agents", "is the kit consistent", or after adding or changing an agent or skill.
---

# Agent review

The kit reviews itself the way it reviews a project: scripts count, an independent agent verifies, the owner decides.

## Steps
1. **Run the script** from the kit root: `node scripts/agents.mjs --report agent-report.md`. Exit code 1 means a gated check (front matter, broken references) found something. Do not edit anything.
2. **Verify.** Start the `agent-reviewer` agent in a fresh context with the kit path, the draft report and none of your own opinions. Its method and rules live in `agents/meta/agent-reviewer.md`.
3. **Check its Highs yourself** by reading the cited lines. Drop anything you cannot confirm.
4. **Deliver** with `templates/decision-report.md`: summary, a table per check with an empty **Your decision** column, the checklist walk. Show the tables in the reply.
5. **Trial run (optional, owner decides).** Ask whether to try an agent on a scratch project with planted defects. Never plant defects in a real project.
6. **Fix only the rows marked "fix"**, in one pass, then run step 1 again. After a fix, check that the README category table and the tests still agree.

## Notes
- Do not change an agent to suit one project; project facts live in that project's `review.config.json`.
- Say plainly what the scripts cannot see: whether an agent finds real problems, overlap in scope, and whether an installed plugin resolves kit paths.
