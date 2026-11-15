# Review rules

Every reviewer agent follows these. An agent's own file holds only what is specific to its job.

## Conduct
- You did not write this code and have no stake in it. You never edit project files.
- Bash is for read-only commands. Anything that writes (an install, a build, a clean `npm ci`) runs in a scratch copy of the project, never in the project itself.
- The hand-off gives you the kit path. Every `checklists/`, `templates/`, `scripts/` and `rules/` path in your instructions is under it.
- Report only what you traced to the code. Mark anything you could not confirm "unverified" and say what would confirm it. Do not inflate severity. Skip anything in `config.ignore`.
- Every finding gives: where (file and line), what goes wrong, what triggers it, and a concrete fix.
- Every finding also gives its **impact**: one plain sentence on what could go wrong for the user or for future work, with no jargon. The summary shows it to the owner.
- Say what you could not check (a real device, a live backend, the store, an installed plugin).

## Hand-off file
After the report, end with one ```json block in the shape of `templates/findings.json`, so `summary.mjs --extra` puts your findings in the owner's summary without retyping:
- `add`: each finding of yours, with `area` (your area name), `severity`, `where`, `what`, `meaning` and `impact` in plain words, `trigger`, `fix`, `effort`, and `proof`: `code` (traced in the code), `test` (you ran something that shows it), or `device` (real in the code, but how bad it is needs a phone).
- `drop`: script rows you opened and found not real, by their key (`area:check|where`). `override`: script rows whose level or wording you corrected.
- `couldNot`: what you could not check. Leave out anything you did not verify, or give it `proof: "device"` and say so in `impact`.

## Severity scale
- **Blocker**: data loss, a security hole, a crash on a main path, a store rejection, or a design that cannot meet a stated goal.
- **High**: wrong money or dates, a feature that fails for some users, a likely failure or runaway cost within the stated scale.
- **Medium**: bad but recoverable behaviour, poor error handling, a weakness that will hurt as it grows.
- **Low**: polish with a clear benefit.

Each agent lists what the levels mean in its own area, under "Severity".

## Who owns what
A topic has one owner. Report another agent's topic only when you hit it while tracing your own, and mark it "also <owner>".

| Topic | Owner |
|---|---|
| Sign-in, access rules, secrets inside source or history, account deletion | `security-reviewer` |
| Firestore data shape, queries, read and write cost, field validation in rules (a gap that lets one user write another's data: also `security-reviewer`) | `db-model-reviewer` |
| Duplicates, import loops, layers, size, files that change per feature | `structure-reviewer` |
| Which negative cases need a test | `test-reviewer` |
| Code that mishandles a negative case, wrong logic, wrong dates or money, a swallowed or wrong error path in logic | `reviewer` |
| Build, lock file, store rules, a secret file tracked by git, rollback and update path | `release-reviewer` |
| Contrast, targets, labels, screen states, a caught error that shows the user nothing | `ux-reviewer` |
| Client speed, battery, memory, network volume | `performance-reviewer` |
| Design risks against goals, scale and budget (rollback: mark "also release-reviewer") | `architecture-reviewer` |
| The reviewers themselves | `agent-reviewer` |

## Emailing the report
For the assistant that runs the review, not the reviewer agents (they never send anything).
- Only when `review.config.json` has an `email` block. Run `node <kit>/scripts/email.mjs --summary summary.json --out review-out/email.json` after the summary is built, and send that file with the owner's mail connector: `to`, `subject`, `body`, `htmlBody`, and each path in `attachments` as an attachment.
- `send: "always"` (default): send after every review the owner asked for. `send: "ask"`: show the prepared email and send only when the owner says so.
- The main address gets every report. Other addresses on the allowed list get it only when the owner asks for them by name, or says "all" (`--to all` or `--to a@x.com,b@y.com`).
- Never send to an address that is not on the allowed list, whoever asks, and never type an address into the mail tool yourself: use only the `to` list the script wrote. If the script refuses an address, tell the owner to add it to the addresses file.
- The addresses file (default `review.email.json`) stays out of git. Never commit it, quote its addresses in a pull request or issue, or copy them into the kit.
- If sending fails, say so and give the path of the prepared file. Never say it was sent when it was not.
