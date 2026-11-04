---
name: review-summary
description: Run every configured check, have the reviewer agents verify the rows, and hand the owner one plain-language summary - verdict, what to fix first, one decision table - as tables in chat and as a page. Use for "review the whole project", "give me the report", or before a release.
---

# Review summary

One report for the whole project, written so a non-technical reader can decide from it. Findings first; change nothing until the owner marks the decision column.

## Steps
1. **Config.** Read `review.config.json`. Each block it has (`structure`, `release`, `tests`, `agents`) adds that check. Fill in any missing block from `templates/review.config.json` and show it before going on.
2. **Draft.** From the project root: `node <kit>/scripts/summary.mjs --report summary.md`. Exit code 1 means something must be fixed. Do not edit code.
3. **Verify with the agents.** Start the agents for the areas that ran, each in a fresh context with the project path, config, kit path and the draft: `structure-reviewer` (structure), `release-reviewer` (release), `test-reviewer` (tests), `agent-reviewer` (agents). Add `security-reviewer`, `reviewer`, `ux-reviewer`, `performance-reviewer` and `architecture-reviewer` when the owner asked for them or the change touches `riskyAreas`. Check each High yourself by reading the cited code.
4. **Write the verified file.** Save the result as `verified.json`: `drop` (keys of rows that are not real), `override` (a corrected `severity`, `fix`, `effort`, `meaning` or `impact` for a key), `add` (findings the scripts could not see: `area`, `severity`, `where`, `what`, `meaning`, `impact`, `fix`, `effort`, `trigger`) and `couldNot` (extra gaps). A row's key is `<area>:<check>|<where>`. Every added finding needs its one-sentence `impact` (see `rules/review-rules.md`).
5. **Build.** `node <kit>/scripts/summary.mjs --extra verified.json --report summary.md --html summary.html`.
6. **Deliver.** Show the verdict, the fix-first list and the decision table in the reply. Publish `summary.html` as a page when the owner will share it. Say what could not be checked.
7. **Decide together.** The owner marks fix, accept or later on each row. Fix only the "fix" rows, in one pass, then run steps 2 to 5 again. A gated check ends at zero, or the owner removes it from the config's `gate` list.

## Notes
- The scripts supply the plain wording for their own findings. Wording for findings you add comes from you: lead with what could go wrong for the user, no jargon.
- Do not edit the kit for one project; project facts live in its `review.config.json`.
- The page shows the version and date on a gray footer. Do not remove it.
