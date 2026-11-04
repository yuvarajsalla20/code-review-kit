# Review summary: demo-app

Kit: 1.9.3   Checks run: structure, tests

## Verdict

**Ready**: Nothing blocks the release.

|  | Count |
|---|---|
| Must fix before release | 0 |
| Blocker | 0 |
| High | 0 |
| Medium | 2 |
| Low | 0 |

Not ready if any item must be fixed (a failed gated check or a Blocker). Ready after fixes if High items remain. Ready otherwise.

## Fix first

| # | What could go wrong | Where | Effort |
|---|---|---|---|
| 1 | The same code is written in more than one place. A fix in one copy can be missed in the other, so the copies drift apart and one stays buggy. | src/a.js:2-9 \| src/b.js:2-9 | small |
| 2 | Important code that no test covers. A change there can break something the project promises, such as a feature that stops working, without anyone noticing. | tests | large |

## Your decisions

Mark the last column and send it back; nothing is changed until you do.

| # | What it means | Why it matters | Suggested fix | Effort | Area | Your decision |
|---|---|---|---|---|---|---|
| 1 | The same code is written in more than one place (src/a.js:2-9 \| src/b.js:2-9) | A fix in one copy can be missed in the other, so the copies drift apart and one stays buggy. | Move the shared lines into one function, component or constant and use it from every place. | small | structure |  |
| 2 | Important code that no test covers (tests) | A change there can break something the project promises, such as a feature that stops working, without anyone noticing. | Add tests for the paths that must never fail. | large | tests |  |

## By area

### Code structure

| # | Where | What (technical) | Trigger |
|---|---|---|---|
| 1 | src/a.js:2-9 \| src/b.js:2-9 | 6 identical lines in 2 places | - |

### Tests

| # | Where | What (technical) | Trigger |
|---|---|---|---|
| 2 | tests | No test files found | - |

## Terms used

None.

## What we could not check

- Whether two similar pieces of code should really be one, and how the app is wired while it runs.
- Whether a test checks the right thing, and behaviour only a real phone shows (alerts firing, permissions, the keyboard).

---
Version 1.9.3 - Nov 4, 2026, 3:36 PM CST
