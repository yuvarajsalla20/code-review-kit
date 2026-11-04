---
name: structure-review
description: Check a project's structure - circular imports, layer rules, duplicated code, repeated lists and text, oversized files - then verify each finding and hand the owner one table to decide from. Use for "check for duplicates", "no repetition", "is it modular", "circular dependencies", or before a release.
---

# Structure review

The scripts count; you reason. Findings first, fixes only after the owner has filled in the decision column.

## Steps
1. **Config.** Read `review.config.json`. If it has no `structure` block, copy it from `templates/review.config.json`, adapt the `layers` to the project's real folders (ask the owner when unclear), and show it before going on.
2. **Run the scripts.** From the project root: `node <kit>/scripts/structure.mjs --report structure-report.md`. Exit code 1 means a gated check found something. Do not edit code.
3. **Verify every row.** Open the cited lines. Drop a row you cannot confirm, or mark it "unverified" and say what would confirm it.
   - *Duplicate code:* are the blocks really the same job? Two blocks that look alike but must change independently are not a finding; say so and drop them.
   - *Repeated lists and text:* can one copy import the other? If not (a rules file, a config in another language), the fix is a test that keeps them equal.
   - *Cycles and layers:* trace the import and say which direction is wrong.
   - *Size:* a long file that does one job is lower priority than a short one that does three.
4. **Sharpen the fix.** Replace the generic "Suggested fix" with the concrete one for this code (which file takes the shared part, what it is called). Keep the effort column honest.
5. **Deliver.** Use `templates/structure-report.md`: the summary, then one table per check, ranked by effort-to-benefit, with an empty **Your decision** column. Show it in the reply as tables and, if the owner will share it, publish it as a page too.
6. **Decide together.** The owner fills in the decision column (fix, accept, later). Fix only the "fix" rows, one pass, then re-run step 2. Gated checks must end at zero or be explicitly accepted by the owner in the config (`gate` list).

## Notes
- Judging modularity and "easy to plug in" is yours: for each planned feature in `design.next`, name the files that would change. One place per kind of change is the goal (a new reminder type, a new sound, a new screen).
- Do not edit the kit for one project. Layer maps and limits live in that project's `review.config.json`.
- Say plainly what the scripts cannot see: runtime wiring, code generated at build time, copies that differ by a word.
