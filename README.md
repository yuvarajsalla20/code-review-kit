# review-kit

Reusable pre-release review for any project. Findings first, fixes only after the owner chooses.

## Reviews by phase

| Phase | Skill | Use it when |
|---|---|---|
| Design | `architecture-review` | Before building (design-only mode) or any time the design changes |
| Design | `db-model-review` | When the data model or database rules are drafted or changing |
| Build and release | `code-review` | Before each release; includes the security reviewer |

Run them in that order. Earlier phases are cheaper to fix.

## What is inside

| Folder | Purpose |
|---|---|
| `agents/` | `reviewer` (skeptical generalist), `security-reviewer` (attacker mindset), `architecture-reviewer` (design vs goals, scale, budget) and `db-model-reviewer` (Firestore model, access patterns, cost). Read-only. |
| `skills/` | `code-review` (full pre-release review), `architecture-review` (interviews you first, then reviews the design), `db-model-review` (Firestore model and cost). |
| `checklists/` | One file per area: general, money-dates, react-native-expo, firebase, security, app-store, architecture, db-firestore, failure-paths (negative cases; run on request or for risky changes). Add more as you learn. |
| `scripts/check.mjs` | Dependency-free runner: your commands, forbidden patterns, secret scan. |
| `templates/` | `review.config.json`, `report.md`, `architecture-report.md`, `db-report.md`, `architecture-intake.md`, `manual-test.md`. |
| `examples/` | A neutral sample config. Real project configs live in each project's own repo. |

## Use it in a project

1. Copy `templates/review.config.json` to the project root as `review.config.json` and fill it in (stack, checklists, risky areas, commands). The `design` block (goal, scale, budget, next features) feeds the architecture and database reviews. See `examples/` for a sample.
2. Run the automated layer:
   ```
   node /path/to/review-kit/scripts/check.mjs
   ```
3. Ask Claude Code: "run the code-review skill" (or "architecture-review", or "db-model-review"). It starts the reviewers in a fresh context, merges the results, and shows a ranked list before touching code.

## Install as a Claude Code plugin

Add this repository as a plugin marketplace source, or clone it and point Claude Code at the folder. The plugin manifest is `.claude-plugin/plugin.json`.

## Rules the kit follows

- Reviewers never edit code.
- Only traced, reproducible problems are reported; uncertain ones are marked unverified.
- Anything that cannot be checked (real device, live backend) is listed, not guessed.
- Project-specific facts live only in `review.config.json`. To cover a new stack, add a checklist.

---
Version 1.3.0 - 2026-11-03 11:40 PM CT
