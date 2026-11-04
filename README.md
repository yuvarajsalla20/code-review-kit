# review-kit

Reusable pre-release review for any project. Findings first, fixes only after the owner chooses.

## Reviews by phase

| Phase | Skill | Use it when |
|---|---|---|
| Design | `architecture-review` | Before building (design-only mode) or any time the design changes |
| Design | `db-model-review` | When the data model or database rules are drafted or changing |
| Build and release | `structure-review` | Duplicates, circular imports, layer rules, size: scripts count, `structure-reviewer` verifies |
| Build and release | `code-review` | Before each release; includes the security reviewer |

Run them in that order. Earlier phases are cheaper to fix.

## Categories

Agents sit in one folder per question they answer. Claude Code names each one `<plugin>:<folder>:<name>`, for example `review-kit:safety:test-reviewer`. Checklists, templates and scripts stay in their own folders; this table is the map.

| Category | Question it answers | Agents (`agents/<category>/`) | Skills | Checklists | Scripts | Templates |
|---|---|---|---|---|---|---|
| `design` | Is the plan right? | `architecture-reviewer`, `db-model-reviewer` | `architecture-review`, `db-model-review` | architecture, db-firestore | none | architecture-intake, architecture-report, db-report |
| `clean-code` | Is the code tidy and modular? | `reviewer` (all-round), `structure-reviewer` | `structure-review`, `code-review` | general | `structure.mjs` | structure-report, report |
| `safety` | Can it be attacked, or break a promise? | `security-reviewer`, `test-reviewer` | `code-review`, `focused-review` | security, tests, failure-paths, money-dates | `testmap.mjs` | decision-report |
| `ship` | Will the build and the store accept it? | `release-reviewer` | `focused-review` | release, app-store | `release.mjs` | manual-test |
| `people` | Can everyone use it, and is it fast? | `ux-reviewer`, `performance-reviewer` | `focused-review` | ux, performance | none | decision-report |

Shared by all: `check.mjs`, `scripts/lib/`, `review.config.json` (template and example), the `code-review` skill that runs the sequence, the `decision-report` template, and the `react-native-expo` and `firebase` checklists.

## What is inside

| Folder | Purpose |
|---|---|
| `agents/` | One folder per category, see **Categories** below. Every agent is read-only and runs in a fresh context. |
| `skills/` | `code-review` (full pre-release review), `structure-review` (duplicates, cycles, layers, size, with a decision table), `focused-review` (one area: release, tests, usability or performance), `architecture-review` (interviews you first, then reviews the design), `db-model-review` (Firestore model and cost). |
| `checklists/` | One file per area: general, money-dates, react-native-expo, firebase, security, app-store, architecture, db-firestore, failure-paths (negative cases; run on request or for risky changes), release, tests, ux, performance. Add more as you learn. |
| `scripts/check.mjs` | Dependency-free runner: your commands, forbidden patterns, secret scan, and the structure checks. |
| `scripts/release.mjs`, `scripts/testmap.mjs` | Release readiness (lock file, app settings, permission texts, tracked secret files, privacy keywords) and risky files no test reaches. Both take `--report` and `--json`; settings are the `release` and `tests` blocks in `review.config.json`. |
| `scripts/structure.mjs` | The structure checks on their own, with `--report` to write the tables. Code lives in `scripts/structure/` (one file per check) and `scripts/lib/` (shared file, comment and import handling). |
| `tests/` | Offline tests for the scripts: `node --test tests/*.test.mjs`. |
| `templates/` | `review.config.json`, `report.md`, `architecture-report.md`, `structure-report.md`, `db-report.md`, `architecture-intake.md`, `manual-test.md`. |
| `examples/` | A neutral sample config. Real project configs live in each project's own repo. |

## Use it in a project

1. Copy `templates/review.config.json` to the project root as `review.config.json` and fill it in (stack, checklists, risky areas, commands). The `design` block (goal, scale, budget, next features) feeds the architecture and database reviews. See `examples/` for a sample.
2. Run the automated layer:
   ```
   node /path/to/review-kit/scripts/check.mjs
   ```
   For the duplicate, cycle, layer and size tables on their own: `node /path/to/review-kit/scripts/structure.mjs --report structure-report.md`.
3. Ask Claude Code: "run the code-review skill" (or "architecture-review", or "db-model-review"). It starts the reviewers in a fresh context, merges the results, and shows a ranked list before touching code.

## Structure checks

Added in 1.4.0. Set up with a `structure` block in `review.config.json` (a ready one is in `templates/`). No dependencies, text-based, offline.

| Check | Finds | Counts as |
|---|---|---|
| `cycles` | Files that import each other in a loop (type-only imports are ignored unless `includeTypeOnlyCycles` is true) | Gate |
| `layers` | An import from one layer into a layer it may not use, per your `layers` map (`mayImport`) | Gate |
| `restricted` | A package imported outside its allowed place, e.g. `firebase` only inside `src/data` | Gate |
| `duplicates` | `minLines` or more meaningful lines (and `minChars` characters) repeated in two or more places; imports and bracket-only lines do not count | Review |
| `repeated` | The same list of four or more numbers or words written twice or more, or the same text of ten or more characters in `minFiles` files. `extra` adds files such as `firestore.rules` | Review |
| `size` | Files over `maxFileLines`, top-level functions over `maxFunctionLines` | Review |

**Gate** means the run exits 1 and the owner must fix it or accept it by removing the check from the `gate` list. **Review** items are listed in the table and the owner decides. Change which checks gate with `gate`.

| `structure` key | Meaning | Default |
|---|---|---|
| `roots` | Folders or files to read | `["src"]` |
| `ignore` | Paths to leave out | `["tests"]` |
| `extra` | Other files whose lists and text count as "repeated" (not imports) | `[]` |
| `aliases` | Import prefixes, e.g. `{"@/": "src/"}` | `{}` |
| `layers` | `[{ name, paths, mayImport }]`; the longest matching path wins; files in no layer are skipped | none, so layer rules are not checked |
| `restricted` | `[{ module, onlyIn }]` | none |
| `gate` | Checks that fail the run | `["cycles","layers","restricted"]` |

The scripts count; the `structure-review` skill starts the `structure-reviewer` agent, which opens every row, drops what is not real, writes the concrete fix and hands over one table with a **Your decision** column. Fix only after that.

## Install as a Claude Code plugin

Add this repository as a plugin marketplace source, or clone it and point Claude Code at the folder. The plugin manifest is `.claude-plugin/plugin.json`.

## Rules the kit follows

- Reviewers never edit code.
- Only traced, reproducible problems are reported; uncertain ones are marked unverified.
- Anything that cannot be checked (real device, live backend) is listed, not guessed.
- Project-specific facts live only in `review.config.json`. To cover a new stack, add a checklist.

---
Version 1.6.0 - 2026-11-04 3:05 PM CT
