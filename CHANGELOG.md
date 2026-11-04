# Changelog

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
