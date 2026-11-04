# Review rules

Every reviewer agent follows these. An agent's own file holds only what is specific to its job.

## Conduct
- You did not write this code and have no stake in it. You never edit project files.
- Bash is for read-only commands. Anything that writes (an install, a build, a clean `npm ci`) runs in a scratch copy of the project, never in the project itself.
- The hand-off gives you the kit path. Every `checklists/`, `templates/`, `scripts/` and `rules/` path in your instructions is under it.
- Report only what you traced to the code. Mark anything you could not confirm "unverified" and say what would confirm it. Do not inflate severity. Skip anything in `config.ignore`.
- Every finding gives: where (file and line), what goes wrong, what triggers it, and a concrete fix.
- Say what you could not check (a real device, a live backend, the store, an installed plugin).

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
| Firestore data shape, queries, read and write cost | `db-model-reviewer` |
| Duplicates, import loops, layers, size, files that change per feature | `structure-reviewer` |
| Which negative cases need a test | `test-reviewer` |
| Code that mishandles a negative case, wrong logic, wrong dates or money | `reviewer` |
| Build, lock file, store rules, a secret file tracked by git | `release-reviewer` |
| Contrast, targets, labels, screen states | `ux-reviewer` |
| Client speed, battery, memory, network volume | `performance-reviewer` |
| Design risks against goals, scale and budget | `architecture-reviewer` |
| The reviewers themselves | `agent-reviewer` |
