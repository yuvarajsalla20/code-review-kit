---
name: focused-review
description: Run one focused review - release readiness, test quality, usability or performance - with its script (where there is one), its reviewer agent in a fresh context, and one decision table. Use for "is this ready for the store", "do the tests protect the important paths", "check accessibility", "will it be slow", or when only one area needs a look.
---

# Focused review

One area, one independent reviewer, one table. Findings first, fixes only after the owner decides. Never edit code.

## Pick the area

| Owner asks | Script | Agent | Checklists |
|---|---|---|---|
| Ready for the store or a build | `scripts/release.mjs` | `release-reviewer` | `release.md`, `app-store.md`, `react-native-expo.md` |
| Do the tests protect what matters | `scripts/testmap.mjs` | `test-reviewer` | `tests.md`, `failure-paths.md` |
| Usability and accessibility | none | `ux-reviewer` | `ux.md`, `react-native-expo.md` |
| Speed, battery, data growth, cost | none | `performance-reviewer` | `performance.md`, `react-native-expo.md`, `firebase.md` |

## Steps
1. **Config.** Read `review.config.json`. If the area needs a block it lacks (`release`, `tests`) or `design.scale`, copy it from `templates/review.config.json`, fill it from the project and show it before going on.
2. **Script.** Where the table has one, run it from the project root with `--report <area>-report.md`. A gated check that finds something exits 1. Do not edit code.
3. **Agent.** Start the area's agent in a fresh context with the project path, the config, the script's draft report and none of your own opinions. The agent's rules live in its file in `agents/`.
4. **Check the Highs yourself** by reading the cited code. Drop anything you cannot confirm.
5. **Deliver** with `templates/decision-report.md` (and `templates/report.md` for findings the scripts did not raise): the summary, a table per check with an empty **Your decision** column, the checklist walk, and what needs a device. Show the tables in the reply and publish a page if the owner will share it.
6. **Decide together.** Fix only the rows marked "fix", in one pass, then run step 2 again.

## Notes
- Say plainly what could not be checked (the signed build, the live store listing, a real device).
- Do not edit the kit for one project; project facts live in its `review.config.json`.
