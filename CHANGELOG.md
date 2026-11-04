# Changelog

## 1.8.0 - 2026-11-04
- Plain-language summary for a whole project: `scripts/summary.mjs`, the `review-summary` skill and `templates/summary-report.md`.
  - Verdict (Ready, Ready after fixes, Not ready), the five items to fix first, one decision table across all checks, technical detail by area, a glossary, and what could not be checked.
  - Writes markdown and a self-contained, phone-friendly page with light and dark themes and the version and date on a gray footer.
  - Script findings come with plain wording (`scripts/summary/plain.mjs`). The agents' verified changes (drop, override, add) are merged with `--extra`.
- Every finding now carries a one-sentence impact (`rules/review-rules.md`, `templates/report.md`).
- `parseArgs` accepts `--html`, `--extra` and `--areas`.

## 1.7.1 - 2026-11-04
- Second self-review applied. The owner table now settles the remaining overlaps: cross-user access and secrets in source are `security-reviewer`'s, tracked secret files are `release-reviewer`'s, Firestore read counts are `db-model-reviewer`'s, structure rows are evidence only for `reviewer`.
- `architecture-review` runs `structure-review` and passes its verified report. `security-reviewer` has an Inputs list. The `agents` checklist and `agent-reviewer` check overlap against the owner table.

## 1.7.0 - 2026-11-04
- The kit reviews its own agents: `agent-reviewer` agent (new `meta/` category), `agent-review` skill, `agents` checklist and `scripts/agents.mjs`.
  - Checks front matter, required sections, broken file and agent references, the pointer to the shared rules, repeated lines, unused agents and length.
  - Front matter and broken references gate the run; the rest go to the owner as a decision table.
- First self-review applied: the conduct rules, severity scale and a topic-owner table moved into `rules/review-rules.md`, so each topic has one owning agent and the rules are written once. Every agent points to it; skills pass the kit path; shell use is read-only or on a scratch copy.
- Skill hand-offs fixed: `code-review` runs `release.mjs` and drops the missing `play-store.md`, `architecture-review` runs `structure.mjs`, `focused-review` turns `ux` and `performance` findings into table rows, `structure-review` asks for `design.next`.
- `loadConfig` accepts an optional config. `tests/agents.test.mjs` covers the checks and runs them on the kit's own agents.

## 1.6.0 - 2026-11-04
- Agents are grouped by the question they answer: `design/`, `clean-code/`, `safety/`, `ship/`, `people/`. Claude Code now names them `<plugin>:<folder>:<name>`, for example `review-kit:safety:test-reviewer`. The `name:` line in each file is unchanged.
- README has a **Categories** table mapping every agent, skill, checklist, script and template to a category.
- Plugin icon (`assets/icon.png`, 1024 px).
- A test checks that each agent sits in a category folder and has a `name` and a `description`.

## 1.5.0 - 2026-11-04
- Four new agents, each read-only and independent: `release-reviewer`, `test-reviewer`, `ux-reviewer`, `performance-reviewer`.
- Two new scripts, dependency-free: `scripts/release.mjs` (lock file, app settings, permission texts, tracked secret files, privacy keywords) and `scripts/testmap.mjs` (risky files no test reaches). Both are also sections 5 and 6 of `check.mjs`.
- Checklists `release`, `tests`, `ux`, `performance`. The accessibility and layout lines moved from `general.md` to `ux.md` so nothing is listed twice.
- `focused-review` skill and `templates/decision-report.md`. `code-review` now hands store compliance to `release-reviewer` and can run the optional passes.
- Shared helpers in `scripts/lib/` (`cli`, `table`, `section`) used by all report scripts; `release` and `tests` blocks in the config template and example.

## 1.4.1 - 2026-11-04
- `structure-reviewer` agent: verifies the structure tables in a fresh context, writes concrete fixes and runs the plug-in test. The `structure-review` skill starts it.

## 1.4.0 - 2026-11-04
- Structure checks, dependency-free: `scripts/structure.mjs` and the `structure` section of `check.mjs`.
  - Circular imports, layer rules and restricted packages (gate), duplicate code, repeated lists and text, and size (review).
  - `--report` writes the findings as tables with a "Your decision" column.
- `structure-review` skill and `templates/structure-report.md`.
- `check.mjs` now shares its file walking with the new scripts (`scripts/lib/files.mjs`) instead of keeping its own copy.
- Offline tests in `tests/`.
- Architecture and general checklists, reviewer and architecture-reviewer agents, and `code-review` skill now use the structure output.

## 1.3.0 - 2026-11-03
- `failure-paths` checklist and an opt-in "review with negative cases" pass in `code-review`.

## 1.2.0 and earlier
- Architecture and database-model reviews by phase, security reviewer, stack checklists, and the `check.mjs` runner (commands, forbidden patterns, secrets).
