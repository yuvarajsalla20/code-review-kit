---
name: structure-review
description: Check a project's structure - circular imports, layer rules, duplicated code, repeated lists and text, oversized files - then verify each finding and hand the owner one table to decide from. Use for "check for duplicates", "no repetition", "is it modular", "circular dependencies", or before a release.
---

# Structure review

The scripts count; you reason. Findings first, fixes only after the owner has filled in the decision column.

## Steps
1. **Config.** Read `review.config.json`. If it has no `structure` block, copy it from `templates/review.config.json`, adapt the `layers` to the project's real folders (ask the owner when unclear), and show it before going on. Ask for `design.next` too if it is missing: the plug-in test needs it.
2. **Run the scripts.** From the project root: `node <kit>/scripts/structure.mjs --report structure-report.md`. Exit code 1 means a gated check found something. Do not edit code.
3. **Verify every row.** Start the `structure-reviewer` agent in a fresh context with the project path, the config, the kit path and the draft report, and none of your own opinions of the code. It opens the cited lines, drops what is not real, writes concrete fixes and runs the plug-in test. Then check its Highs yourself by reading the cited code. Its verification rules live in `agents/clean-code/structure-reviewer.md`.
4. **Merge.** Take the agent's verified rows and concrete fixes, keep the effort column honest, and drop any row you could not confirm.
5. **Deliver.** Use `templates/structure-report.md`: the summary, then one table per check, ranked by effort-to-benefit, with an empty **Your decision** column. Show it in the reply as tables and, if the owner will share it, publish it as a page too.
6. **Decide together.** The owner fills in the decision column (fix, accept, later). Fix only the "fix" rows, one pass, then re-run step 2. Gated checks must end at zero or be explicitly accepted by the owner in the config (`gate` list).

## Notes
- The agent runs the plug-in test (files that change per planned feature); read its table and challenge any row that lists more than one place without a reason.
- Do not edit the kit for one project. Layer maps and limits live in that project's `review.config.json`.
- Say plainly what the scripts cannot see: runtime wiring, code generated at build time, copies that differ by a word.
