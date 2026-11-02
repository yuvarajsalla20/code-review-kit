# code-review-kit

Reusable pre-release review for any project. Findings first, fixes only after the owner chooses.

## What is inside

| Folder | Purpose |
|---|---|
| `agents/` | `reviewer` (skeptical generalist) and `security-reviewer` (attacker mindset). Read-only. |
| `skills/code-review/` | The workflow that runs everything in order and produces one report. |
| `checklists/` | One file per area: general, money-dates, react-native-expo, firebase, security, app-store. Add more as you learn. |
| `scripts/check.mjs` | Dependency-free runner: your commands, forbidden patterns, secret scan. |
| `templates/` | `review.config.json`, `report.md`, `manual-test.md`. |
| `examples/` | A filled config (Moonpenny). |

## Use it in a project

1. Copy `templates/review.config.json` to the project root as `review.config.json` and fill it in (stack, checklists, risky areas, commands). See `examples/` for a real one.
2. Run the automated layer:
   ```
   node /path/to/code-review-kit/scripts/check.mjs
   ```
3. Ask Claude Code: "run the code-review skill". It starts the reviewers in a fresh context, merges the results, and shows a ranked list before touching code.

## Install as a Claude Code plugin

Add this repository as a plugin marketplace source, or clone it and point Claude Code at the folder. The plugin manifest is `.claude-plugin/plugin.json`.

## Rules the kit follows

- Reviewers never edit code.
- Only traced, reproducible problems are reported; uncertain ones are marked unverified.
- Anything that cannot be checked (real device, live backend) is listed, not guessed.
- Project-specific facts live only in `review.config.json`. To cover a new stack, add a checklist.

---
Version 1.0.0 - 2026-11-02 06:45 CST
