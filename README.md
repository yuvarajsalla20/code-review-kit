# review-kit

Reusable pre-release review for any project. Findings first, fixes only after the owner chooses.

## Reviews by phase

| Phase | Skill | Use it when |
|---|---|---|
| Design | `architecture-review` | Before building (design-only mode) or any time the design changes |
| Design | `db-model-review` | When the data model or database rules are drafted or changing |
| Build and release | `structure-review` | Duplicates, circular imports, layer rules, size: scripts count, `structure-reviewer` verifies |
| Build and release | `code-review` | Before each release; includes the security reviewer and, by default, the speed reviewer (say "skip speed" to leave it out) |

Run them in that order. Earlier phases are cheaper to fix.

## What happens when you run it

```
 you ask            scripts count            agents verify            kit writes             you decide
 "review it"  -->   duplicates, loops,  -->  each row, in a fresh --> summary page and --> fix / accept / later
                    missing tests, secrets   context, read-only       per-area reports       on every row
```

Nothing in your code changes until you mark the decision column.

| You get | Who it is for | What is in it |
|---|---|---|
| `summary.md` and `summary.html` | Anyone, no technical background needed | The verdict, the five things to fix first, one decision table, a glossary, and what could not be checked |
| `structure-report.md`, `release-report.md`, `test-map.md`, `agent-report.md` | The developer | One table per check: where, what, impact, suggested fix, effort |
| `architecture-report.md`, `db-report.md` | The owner, at design time | Risks and options with trade-offs |
| `verified.json` | The kit | Which rows the agents dropped, corrected or added |

**Reading the verdict**

| Verdict | Meaning |
|---|---|
| Not ready | Something must be fixed: a failed gated check or a Blocker |
| Ready after fixes | No must-fix items, but High items remain |
| Ready | Nothing blocks the release |

A gate finding must be fixed or accepted. A review finding is your call. Each row in the decision table has a **Your decision** column: write `fix`, `accept` or `later` and send it back.

**Try it**

1. `node <kit>/scripts/summary.mjs --report summary.md --html summary.html` from your project root (needs `review.config.json`).
2. Open `summary.html`, or ask Claude to "run the review-summary skill" for the full flow with agent verification.
3. Mark the decisions. Claude fixes only the `fix` rows, then re-runs.

A finished example for a small demo project is in `examples/sample-report/` (`summary.md` and `summary.html`).

## Categories

Agents sit in one folder per question they answer. Claude Code names each one `<plugin>:<folder>:<name>`, for example `review-kit:safety:test-reviewer`. Checklists, templates and scripts stay in their own folders; this table is the map.

| Category | Question it answers | Agents (`agents/<category>/`) | Skills | Checklists | Scripts | Templates |
|---|---|---|---|---|---|---|
| `design` | Is the plan right? | `architecture-reviewer`, `db-model-reviewer` | `architecture-review`, `db-model-review` | architecture, db-firestore | none | architecture-intake, architecture-report, db-report |
| `clean-code` | Is the code tidy and modular? | `reviewer` (all-round), `structure-reviewer` | `structure-review`, `code-review` | general | `structure.mjs` | structure-report, report |
| `safety` | Can it be attacked, or break a promise? | `security-reviewer`, `test-reviewer` | `code-review`, `focused-review` | security, tests, failure-paths, money-dates | `testmap.mjs` | decision-report |
| `ship` | Will the build and the store accept it? | `release-reviewer` | `focused-review` | release, app-store | `release.mjs` | manual-test |
| `people` | Can everyone use it, and is it fast? | `ux-reviewer`, `performance-reviewer` | `focused-review` | ux, performance | `perf.mjs` | decision-report |
| `meta` | Are the reviewers themselves any good? | `agent-reviewer` | `agent-review` | agents | `agents.mjs` | decision-report |

Shared by all: `rules/review-rules.md` (conduct, severity scale, who owns which topic), `check.mjs`, `scripts/lib/`, `review.config.json` (template and example), the `code-review` skill that runs the sequence, the `review-summary` skill and `summary.mjs` that turn every check into one plain-language report, the `decision-report` template, and the `react-native-expo` and `firebase` checklists.

## What is inside

| Folder | Purpose |
|---|---|
| `agents/` | One folder per category, see **Categories** above. Every agent is read-only and runs in a fresh context. |
| `rules/` | `review-rules.md`: the conduct rules, the severity scale and the owner of each topic, written once. Every agent points to it. |
| `skills/` | `code-review` (full pre-release review), `structure-review` (duplicates, cycles, layers, size, with a decision table), `focused-review` (one area: release, tests, usability or performance), `agent-review` (the kit checks its own agents), `review-summary` (one plain-language report for the whole project), `architecture-review` (interviews you first, then reviews the design), `db-model-review` (Firestore model and cost). |
| `checklists/` | One file per area: general, money-dates, react-native-expo, firebase, security, app-store, architecture, db-firestore, failure-paths (negative cases; run on request or for risky changes), release, tests, ux, performance. Add more as you learn. |
| `scripts/check.mjs` | Dependency-free runner: your commands, forbidden patterns, secret scan, and every check area whose block is in the config (structure, release, tests, agents, speed; the list is `scripts/areas.mjs`). A mistyped path, gate name or area stops the run with a clear message instead of switching a check off. |
| `scripts/summary.mjs` | One plain-language summary of every check: verdict (Ready, Ready after fixes, Not ready), the five things to fix first, one decision table, terms explained, and what could not be checked. Writes markdown (`--report`) and a self-contained page (`--html`) with the version and date on a gray footer. Takes the agents' verified changes with `--extra`. Refuses to say Ready when no check ran. Time stamps use the `timezone` setting (default UTC). |
| `scripts/agents.mjs` | The kit checks its own agents: front matter, required sections, broken references, the pointer to the shared rules, the tool allow-list (`agents.allowedTools`), repeated lines, unused agents, length. Needs no config. Run from the kit root with `--report`. |
| `scripts/release.mjs`, `scripts/testmap.mjs` | Release readiness (lock file, app settings, permission texts, tracked secret files, privacy keywords) and risky files no test reaches. Both take `--report` and `--json`; settings are the `release` and `tests` blocks in `review.config.json`. |
| `scripts/perf.mjs` | Speed and cost candidates: large images and media, heavy packages, animations without the native driver, timers and listeners with no stop, long lists drawn with `.map` inside a ScrollView. Works with no config; the `speed` block changes the settings. Advisory: nothing gates unless `speed.gate` says so. Code lives in `scripts/perf/`. See **Speed checks**. |
| `scripts/structure.mjs` | The structure checks on their own, with `--report` to write the tables. Code lives in `scripts/structure/` (one file per check) and `scripts/lib/` (shared file, comment and import handling). |
| `tests/` | Offline tests for the scripts: `node --test tests/*.test.mjs`. |
| `templates/` | `review.config.json`, `report.md`, `architecture-report.md`, `structure-report.md`, `db-report.md`, `summary-report.md`, `decision-report.md`, `architecture-intake.md`, `manual-test.md`. |
| `examples/` | A neutral sample config and a sample summary report. Real project configs live in each project's own repo. |

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

## Speed checks

Added in 1.10.0. `node <kit>/scripts/perf.mjs --report speed-report.md` from the project root. No dependencies, text-based, works without a config. It finds **candidates**: each row is a text match, and `performance-reviewer` opens it and keeps it only if the code confirms it. Nothing gates by default.

| Check | Finds | How sure |
|---|---|---|
| `assets` | Images, audio, video and fonts over `maxAssetKb` (default 300), including files over 1 MB | High |
| `heavy` | Packages in `dependencies` that the list marks heavy (moment and lodash by default; add yours under `heavy` as `name: reason`) | High |
| `animation` | `Animated.timing`, `spring` or `decay` with no `useNativeDriver`, or `useNativeDriver: false`. A variable or `Platform.OS !== 'web'` is accepted. A layout animation (width, height, top) cannot use it: accept the row | High |
| `cleanup` | A `setInterval` in a file with no `clearInterval`; an `addListener` or `addEventListener` in a file with `useEffect` (or `componentDidMount`) and no remove; `onSnapshot` or `onAuthStateChanged` called with its stop function thrown away. Listeners outside mounting code are skipped: they live as long as the app | Medium (a stop in another file is missed) |
| `lists` | A `ScrollView` with children drawn by `.map`. Right for short lists, wrong for ones that grow | Medium |

| `speed` key | Meaning | Default |
|---|---|---|
| `roots` | Source folders or files to read | `["src", "App.tsx"]` |
| `assetRoots` | Where to look for large files | `["assets", "public", "src"]` |
| `ignore` | Paths to leave out | `["tests"]` |
| `maxAssetKb` | Size limit for one file | `300` |
| `heavy` | Extra packages to flag, `{ "name": "why" }` | moment, lodash |
| `gate` | Checks that fail the run | `[]` |

Launch time, frame rate, memory and battery need a real, older phone and are never scripted. For a library (a kit, not an app) set `design.kind` to `"library"` in the config: `performance-reviewer` then asks what a project pays per render, per install and per mount, and skips launch path and stored data.

## Added in 1.11.0

| What | How |
|---|---|
| Accept a row once, with a reason | A `review.accepted.json` next to the config: a list of `{ "area", "check", "file", "reason", "date" }` (optional `"contains"` narrows it to one row of that file). Matching rows move to an "Accepted earlier" table and stop counting. An entry that matches nothing is reported as stale. The kit never writes this file; you do. |
| Know what did not run | `check.mjs` ends with a "Not run" list of areas with no config block, and its last line says how many areas did not run. `node <kit>/scripts/upgrade.mjs` shows the starter blocks that are missing; add `--write` to put them in `review.config.json` (the only thing the kit ever writes, config only, nothing gated). |
| Fewer speed false positives | A `useNativeDriver: false` next to an `.addListener(` is accepted; a list over an ALL_CAPS constant or a written-out array is skipped; an `onSnapshot` that is returned is not "thrown away". |
| Kit version labels (`kits`, in `release`, advisory) | Compares `kitVersions` in `package.json` with the kits pinned by commit (`codeload.github.com/<owner>/<repo>/tar.gz/<sha>`). Always: a pinned kit with no label, or a label with no pin. With `release.kitsOnline: true`: a label whose tag is missing or points to another commit, and a newer tag. `release.kitsRemote` changes the remote URL (`{owner}`, `{repo}`). An unreachable remote is a row, not a crash. |
| Who verified the rows | `verified.json` takes `verifiedBy`: `"agents"`, `"inline"` or nothing. The summary shows "Agent verification:" and says self-review when the assistant read the rows itself, or not run when nobody did. |
| Mutation check (advisory) | `node <kit>/scripts/mutate.mjs --report mutation.md`, or `summary.mjs --areas mutation`. Needs a `mutation` block. It copies the project to a temporary folder, makes small wrong changes (`===`/`!==`, `>`/`>=`, `&&`/`||`, `true`/`false`, `!`), runs the tests for each, and lists the changes no test noticed. The project is never edited, nothing gates, and it is not part of `check.mjs` or the default summary. |

| `mutation` key | Meaning | Default |
|---|---|---|
| `files` | Source files or folders to change (required) | none |
| `run` | Test command, run in the copy | `npm test` |
| `maxMutants` | Most changes to try (an even, repeatable sample) | `25` |
| `timeoutSec` | Limit for one test run | `120` |
| `copyIgnore` | Extra folders not to copy | `[]` |
| `gate` | Checks that fail the run | `[]` |

## The kit reviews itself

The kit has its own `review.config.json`. From the kit root, `node scripts/check.mjs` runs its tests and checks, and `node scripts/summary.mjs --report summary.md --html summary.html` writes the plain-language report. Test fixtures that look like secrets live under `tests/`, which the secret scan skips.

## Install as a Claude Code plugin

Add this repository as a plugin marketplace source, or clone it and point Claude Code at the folder. The plugin manifest is `.claude-plugin/plugin.json`.

## Rules the kit follows

- Reviewers never edit code.
- Only traced, reproducible problems are reported; uncertain ones are marked unverified.
- Anything that cannot be checked (real device, live backend) is listed, not guessed.
- Project-specific facts live only in `review.config.json`. To cover a new stack, add a checklist.

---
Version 1.11.0 - 2026-11-06 8:25 AM CT
