---
name: code-review
description: Run a full pre-release review of a project - automated checks, independent reviewer, security reviewer, store-compliance checklist, and a manual test script. Use when the user asks to review code, make a release bug-free, or check before shipping.
---

# Code review kit

Findings first, fixes only after the owner chooses. Never change code during the review.

## Steps
1. **Config.** Look for `review.config.json` in the project root. If missing, copy `templates/review.config.json`, fill it from the project (stack, commands, risky areas), and show it to the owner.
2. **Automated checks.** Run `node <kit>/scripts/check.mjs --results review-out/results.json` from the project root. Exit 3 means Incomplete: some area has no block; add it (`upgrade.mjs --write`) or have the owner skip it with a reason in `skipAreas`. It runs the configured commands, scans for leftover dev code and secrets, and, when the config has a `structure` block, checks for import loops, layer breaks, repeated code and oversized files, and, with a `speed` block, speed candidates. Save the output. For the full duplicate and structure table, run the `structure-review` skill.
3. **Independent review.** Start the `reviewer` agent in a fresh context. Give it only the project path, the config, the kit path and the check output, not your own opinions of the code.
4. **Security review.** Start the `security-reviewer` agent the same way.
4b. **Failure paths (on request, or automatically when the change touches `riskyAreas`).** Say "review with negative cases" to turn it on. Start a fresh `reviewer` (with the kit path) and `checklists/failure-paths.md` plus the project's `failurePaths` notes from the config. It reports only verified findings, lists what it handled correctly, and lists what needs a device or emulator. After any fixes, run it again on the fix diff: fixes open new failure paths. It is slower and costs more than the normal pass, so it stays off for small changes.
5. **Store compliance.** If `config.stores` is set, run `node <kit>/scripts/release.mjs --report release-report.md`, then start the `release-reviewer` agent the same way with that report (it walks `checklists/app-store.md` and `release.md`).
5b. **Speed (on by default).** When the config has a `speed` block, run `node <kit>/scripts/perf.mjs --report speed-report.md`. Start the `performance-reviewer` agent the same way, with that report if there is one; it reads `design.kind` (`app` or `library`) and opens every script row before keeping it. The owner can say "skip speed" for a small change.
5c. **Optional passes.** On request, or when the change touches `riskyAreas`, run the `focused-review` skill for tests (`test-reviewer`) or usability (`ux-reviewer`).
5d. **Firebase apps.** When the config has a `firestoreLoad` block, run `node <kit>/scripts/firestore-load.mjs --report review-out/load.md --results review-out/load.json` (needs Java; uses the local emulator, never a real project).
6. **Merge.** Save each reviewer's closing JSON block (see "Hand-off file" in `rules/review-rules.md`) as `review-out/<agent>.json`. Then run `node <kit>/scripts/summary.mjs --extra review-out/results.json,review-out/load.json,review-out/<agent>.json,... --previous <last run's summary.json> --report summary.md --html summary.html`, and once more with `--json > summary.json` to keep for next time.
6b. Before showing it, verify each Blocker and High yourself by reading the cited code; drop anything you cannot confirm (add its key to `drop`).
7. **Show the owner** the summary and ask for a mark on every row: fix, later, or "accept: <reason>". Run `node <kit>/scripts/decide.mjs --report summary.md --previous summary.json` on the marked file: it lists the fix rows and, with `--write`, adds the accepted script rows to `review.accepted.json`. Fix only the fix rows, then re-run steps 2 to 6 with `--previous`, so the owner sees what is fixed and what is new.
8. **Manual test script.** Produce a short numbered list of on-device steps from `templates/manual-test.md`, adjusted to the app's screens. For an app, `node <kit>/scripts/e2e.mjs --out <folder>` writes starter Maestro flows from the config's `e2e` block, and reports how many screens have test IDs.
9. **Email the report (when the config has an `email` block).** Follow "Emailing the report" in `rules/review-rules.md`: `node <kit>/scripts/email.mjs --summary summary.json --out review-out/email.json` (add `--to all` or `--to <addresses>` only when the owner asked), then send it with the mail connector, attaching `summary.html`. Report who it went to.

## Notes
- Be honest about what cannot be checked (real devices, live backend). Never promise zero bugs.
- Keep `review.config.json` the only project-specific file. Do not edit the kit for one project; add a checklist instead.
