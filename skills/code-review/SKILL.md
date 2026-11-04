---
name: code-review
description: Run a full pre-release review of a project - automated checks, independent reviewer, security reviewer, store-compliance checklist, and a manual test script. Use when the user asks to review code, make a release bug-free, or check before shipping.
---

# Code review kit

Findings first, fixes only after the owner chooses. Never change code during the review.

## Steps
1. **Config.** Look for `review.config.json` in the project root. If missing, copy `templates/review.config.json`, fill it from the project (stack, commands, risky areas), and show it to the owner.
2. **Automated checks.** Run `node <kit>/scripts/check.mjs` from the project root. It runs the configured commands, scans for leftover dev code and secrets, and, when the config has a `structure` block, checks for import loops, layer breaks, repeated code and oversized files. Save the output. For the full duplicate and structure table, run the `structure-review` skill.
3. **Independent review.** Start the `reviewer` agent in a fresh context. Give it only the project path, the config and the check output, not your own opinions of the code.
4. **Security review.** Start the `security-reviewer` agent the same way.
4b. **Failure paths (on request, or automatically when the change touches `riskyAreas`).** Say "review with negative cases" to turn it on. Start a fresh `reviewer` with `checklists/failure-paths.md` plus the project's `failurePaths` notes from the config. It reports only verified findings, lists what it handled correctly, and lists what needs a device or emulator. After any fixes, run it again on the fix diff: fixes open new failure paths. It is slower and costs more than the normal pass, so it stays off for small changes.
5. **Store compliance.** If `config.stores` is set, start the `release-reviewer` agent the same way (it walks `checklists/app-store.md`, `release.md` and the `release.mjs` output, and `play-store.md` if present).
5b. **Optional passes.** On request, or when the change touches `riskyAreas`, run the `focused-review` skill for tests (`test-reviewer`), usability (`ux-reviewer`) or speed (`performance-reviewer`).
6. **Merge.** De-duplicate, verify each Blocker and High yourself by reading the cited code, drop anything you cannot confirm, and write one report using `templates/report.md`.
7. **Show the owner** the ranked list and ask which to fix. Fix only those, then re-run steps 2 to 4.
8. **Manual test script.** Produce a short numbered list of on-device steps from `templates/manual-test.md`, adjusted to the app's screens.

## Notes
- Be honest about what cannot be checked (real devices, live backend). Never promise zero bugs.
- Keep `review.config.json` the only project-specific file. Do not edit the kit for one project; add a checklist instead.
