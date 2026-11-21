# Changelog

## 1.15.0 - 2026-11-21
Fixes from the 2026-11-21 review of the kit, plus three asks from the owner.
- Secrets and banned patterns now reach the summary. `summary.mjs` runs the secrets scan and the `forbidden` rules itself (areas `secrets` and `forbidden`), and every hit is a must-fix row. Before, `check.mjs` failed on a leaked key while the summary said Ready. The review-summary skill now runs `check.mjs` first.
- The secrets scan reads more and guesses less. It reads every `.env*` file, shell scripts, `.pem`, `.p8`, `.key`, `.plist`, `.xml`, `.properties` and `.gradle` files, JSON keys (`"password": "..."`) and unquoted `.env` values, and knows Stripe live keys, GitHub tokens and Slack tokens by their format. Error codes (`auth/weak-password`), labels (`Password`), plain words, URLs and patterns are no longer flagged. The value is never printed. The review's own reports (`review-out/`, `summary.*`) are not read.
- A known false alarm can be accepted. `review.accepted.json` takes area `secrets` (the check is the kind of secret, `contains` the key name) and `forbidden` (the check is the rule's name). `skip` in `secrets` and in each forbidden rule takes paths such as `src/theme.ts` as well as names. Found on app-auth-kit (an error-code map and a label) and app-insights-kit (a CLI's own console output).
- Forbidden rules take `skip`, `comments: false` (code only) and `files`. Comments are still read by default, because TODO/FIXME rules only ever match there. A bad pattern, or a secrets block with no `paths`, is one Config problem line instead of a stack trace; `secrets.paths` defaults to the project and `secrets.skip` to the usual build folders. A path that does not exist now stops the run (exit 2) instead of counting as a hit.
- No check passes on nothing. A `roots` folder named in the config that does not exist, or roots with no source files, stop structure, tests, links and widgets. Before, roots `["src"]` on code in `lib/` passed a gated import loop. `check.mjs` prints how many files each area read.
- Hand-off files are checked. Levels and results are read whatever their case (`high`, `FAIL`, `failed`, `error`); any other value stops the summary with the file and the row. A result is never assumed to be a pass.
- `results` entries take `"kind": "probe"` for a reviewer's script that shows one bug. Probes are listed under "Bug checks by reviewers" and never count as a failed test run, so a probe that shows its bug no longer makes the verdict Not ready.
- Unconfirmed rows say so. A new proof, `unverified` (with `confirm`: what would confirm it), shows "Not confirmed: ...". A missing or unknown proof is unverified; before, it read "Read in the code".
- Dropped rows stay in the report under "Dropped by reviewers", with the reason from `dropReasons`. The code-review skill now drops only rows shown not real and marks the rest unverified.
- `decide.mjs` writes entries that match again: the first file of a row found in several places, and `contains` without counts (the repeated value, the function's name). Before, such entries came back stale after a one-line edit.
- Repeated text leaves out members of a string-literal union type; the typecheck already keeps those copies in step (`repeated.typedUnions: false` counts them again). Found on app-invite-kit.
- New structure check `owned`, off until configured: an app that imports what one of its kits owns, such as `expo-sharing` or file writes outside app-export-kit, or Google sign-in outside app-auth-kit. `structure.owned: [{ kit, modules, names, allowIn }]`. Advisory unless gated.
- Reviewers have Bash, which can write, so the read-only rule rests on trust. The agents check now says which reviewers have it, and the skills run the new `scripts/untouched.mjs` before and after the reviewers to show nothing in the project changed.
- `summary.mjs` exits 3 for Incomplete, as `check.mjs` does (it exited 0). Fix-first rows no longer show a double period. Email attachments outside the project, `.env` files and the addresses file are refused, and a missing git no longer crashes the email step.
- 26 new tests (154 in all).

## 1.14.0 - 2026-11-15
- `structure` repeated text: code between two short strings (`'row', alignItems: 'center'`, or `x="a" accessibilityLabel="b"`) is no longer read as text. Every string is now matched whole, short ones too, so a match can no longer start at a closing quote. Found on HringNring, where five of the sixteen repeated-text rows were style keys or JSX attribute names.
- `structure` repeated text: style and platform words (`space-between`, `flex-start`, `transparent`, Alert's `destructive` and the like) never count. They are the same everywhere by design.
- `review.accepted.json`: a row found in several files (repeated text) is accepted by an entry naming any one of those files, with `contains` for the value. Before, such a row could not be accepted at all.
- 3 new tests (128 in all).

## 1.13.0 - 2026-11-15
- Email the report: a new `email` block in `review.config.json` and `scripts/email.mjs`. After a review the assistant sends the verdict, counts and fix-first list, with `summary.html` attached, through the owner's mail connector. The kit never sends mail itself.
- Addresses live in a local `review.email.json` (`main` plus any number of `allowed`), never in the config. The script refuses any address not on the list, stops if the file is committed to git, and warns while it is not in `.gitignore`.
- `code-review` and `review-summary` end with the email step; `rules/review-rules.md` has "Emailing the report". New template `templates/review.email.example.json`.
- 8 new tests (125 in all).

## 1.12.1 - 2026-11-15
- `widgets` timeline check: a plan that ends on a refresh entry (`refresh: true`, `stale: true`) is no longer a row, and a call that only hands iOS a single entry or a plan built by a function is checked where the plan is built, not at the call. Found while fixing HringNring, where the fixed timeline was still flagged twice.
- `firestoreLoad.eraseOrder` (`ownerFirst` or `itemsFirst`): the order the app erases an account in. Only that order is tested, so an app that already deletes the owner document first no longer fails on the unsafe order it does not use. Without it, both orders run as before.
- 2 new tests (117 in all).

## 1.12.0 - 2026-11-15
- A run that skipped an area is Incomplete: `check.mjs` exits 3 and the summary verdict says Incomplete. `skipAreas` leaves an area out on purpose, with a reason; `upgrade.mjs` writes the library skips.
- New areas: `links` (parsing that can throw, link handlers that may drop unsaved input) and `widgets` (personal text on a locked phone, timelines that run out). New checklists `deep-links.md` and `widgets.md`.
- `release`: `permissionUse` (narrow permission text, wider use in code), `storeKeys` (gated: production key prefixes, or a build guard), `kitTests` (kit tested on other React/RN/Expo versions than the app). `kits` now reads git+https and github: pins; before, it silently found none.
- `firestore-load.mjs`: rules and load on the local emulator with the project's real rules, from a `firestoreLoad` block.
- `e2e.mjs`: test-ID coverage, and starter Maestro flows (with broken-link variants) from an `e2e` block.
- Summary: Test results table (`check.mjs --results`), a Proof column, Level in the decision table, New/Still open/Fixed with `--previous`, several `--extra` files joined. Reviewers end with a JSON hand-off block (`templates/findings.json`).
- `decide.mjs` reads the owner's marks back and adds accepted rows to `review.accepted.json` with `--write`.
- `speed.webRoots` (default `public`) keeps website media out of the app-weight check.
- 21 new tests (115 in all). Proven on HringNring: the new checks find the location prompt text, both widget issues, the crashing link decode and the lost-form link handler; the load run finds the account-erase race.

## 1.11.0 - 2026-11-06
- `review.accepted.json`: accept a finding once, with a reason and date. Accepted rows move to their own table and stop counting; entries that match nothing are reported as stale.
- `check.mjs` lists the areas that did not run, and `upgrade.mjs` previews (and with `--write` adds) the missing config blocks. Agents area is skipped when the project has no `agents/` folder.
- New advisory `kits` check in `release`: `kitVersions` against the commit-pinned kits, and optionally against the remote tags.
- The summary states who verified the rows (`verifiedBy`: agents, inline or none) instead of implying agents ran.
- New advisory mutation check (`mutate.mjs`, area `mutation`): works on a temporary copy, never edits the project, never gates, not in the default run.
- Speed check false positives fixed: listener-driven `useNativeDriver: false`, bounded lists, returned `onSnapshot`.
- `checklists/ux.md`: required steps, sideways scroll hints, consistent page style and risky-action drawing.
- New tests (94 in all); hand mutation checks of the new code, with the survivors closed or shown equivalent.

## 1.10.0 - 2026-11-04
- Speed review is part of a normal review now. `code-review` and `review-summary` start `performance-reviewer` by default; say "skip speed" to leave it out for a small change.
- `performance-reviewer` has a library mode. Set `design.kind` to `"library"` (default `"app"`) and it asks what a project pays per render, per install and per mount instead of launch path and users. `checklists/performance.md` has a matching Library section.
- New `scripts/perf.mjs` and a `speed` area in `check.mjs` and `summary.mjs` (works with no config). Five candidate checks: large images and media (`maxAssetKb`, default 300), heavy packages (moment, lodash, plus your own list), animations with no native driver (a variable or `Platform.OS !== 'web'` is accepted), timers and listeners with no stop (listeners only in code that mounts and unmounts), long lists drawn with `.map` inside a ScrollView. Nothing gates by default (`speed.gate`), and every row is a text match that the reviewer opens before it counts.
- `walk` and `listFiles` take `maxBytes`, so a check can look at files over 1 MB.
- 8 new tests, including self-closing and nested tags, files over 1 MB, a mistyped gate name, and no-config use. The kit's own layer map and risky areas include `scripts/perf/`.

## 1.9.3 - 2026-11-04
- README explains what happens when you run the kit: the flow, the files you get, how to read the verdict and the decision column, and how to try it. A sample report is in `examples/sample-report/`.

## 1.9.2 - 2026-11-04
- Fresh agent-reviewer pass applied (8 findings).
  - Owner table: field validation in rules is db-model-reviewer's (a gap that lets one user write another's data is also security-reviewer's), rollback and update path is release-reviewer's, a caught error that shows nothing is ux-reviewer's, a swallowed error path in logic is reviewer's.
  - Agent wording: `design.platforms` named, db-model Inputs uses "access files", architecture description says "operability risk", the tool allow-list is named in the agents checklist, findings state their impact.
  - Docs: README rows brought up to date; `code-review` skill re-runs steps 2 to 5; structure and decision templates have an Impact column; `.gitignore` covers every report file the skills write.

## 1.9.1 - 2026-11-04
- The table-cell helper is written once (`lib/table.mjs`) and used by the summary. The "Blocker means must fix" rule is written once in `summary/model.mjs`.
- New test: type-only import loops are ignored by default and found when `includeTypeOnlyCycles` is set.

## 1.9.0 - 2026-11-04
- First review of the kit's own code applied (18 findings).
  - The summary no longer says Ready when no check ran or an area name is mistyped; it stops with a clear message (exit 2).
  - A mistyped gate name, forbidden or secrets path, or `tests.risky` now stops the run instead of switching a check off. A config that is not valid JSON gives one clear line.
  - `check.mjs` runs every area in `scripts/areas.mjs` (structure, release, tests and agents), and the summary uses the same list.
  - Reviewer tools are checked against a read-only allow-list (`agents.allowedTools`), so Write, NotebookEdit or any new write tool is flagged.
  - The test map counts a file as reached when a test runs it as a separate program, so those false rows are gone.
  - Written once: findings and counts (`lib/findings.mjs`), the stand-alone command (`runCli`), and the summary tables (`summary/tables.mjs`) that both the page and the markdown use.
  - The summary's time zone defaults to UTC (set `timezone`). Plain wording no longer uses an example from one app.
- The kit has its own `review.config.json`, so it reviews itself with one command.
- 16 new tests, including: gated checks that could pass silently, all secret patterns, typo protection, the agents command, the version in code, manifest, README and CHANGELOG, plain wording for every check, and the page and markdown showing the same tables.

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
