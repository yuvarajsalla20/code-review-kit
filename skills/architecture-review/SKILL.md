---
name: architecture-review
description: Review a project's architecture against its goals, scale and budget. Interviews the owner first, then runs the architecture-reviewer agent and presents risks with options. Use for "review the architecture", "is this design sound", "will this scale", before a launch.
---

# Architecture review

Findings and options first; change nothing until the owner chooses.

## Modes
- **Design-only** (no code yet): the input is a written plan, a sketch, or the owner's answers to `templates/architecture-intake.md`. Review the plan against goals, scale and budget, and skip file references. Mark every finding "inferred from plan". Use this before building.
- **Existing code**: the steps below.

## Steps
1. **Config.** Read `review.config.json`. If it has no `design` block, interview the owner with `templates/architecture-intake.md` (ask in one short batch, offer sensible defaults) and write the answers into the config. If the owner is away, use stated assumptions and list them.
2. **Run the agent.** If the config has a `structure` block, run the `structure-review` skill first and keep its verified report. Start `architecture-reviewer` in a fresh context with the project path, config, kit path and that verified report. Give it no opinions about the code.
3. **Verify.** Check every Blocker and High against the code yourself. Drop what you cannot confirm; mark inferred items.
4. **Report.** Use `templates/architecture-report.md`. Split findings into "fix before launch" and "fix as it grows". Put the owner's open questions at the end.
5. **Decide together.** Present the options table for each finding and ask which to take. Only then change code.

## Notes
- Judge the design against the stated goals and scale, not against an ideal system.
- Pair with `db-model-review` when the project has a database, and `code-review` before release.
