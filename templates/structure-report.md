# Structure report: {project} {version}

Checked: {date}   Kit: {kit-version}   Files read: {n}

`node <kit>/scripts/structure.mjs --report structure-report.md` writes the first draft of this file. The reviewer then verifies each row against the code, replaces the generic fix with a concrete one, and drops anything that is not real.

## Summary

| Check | Found | Counts as |
|---|---|---|
| Circular imports | {n} | Gate: must be fixed or accepted |
| Layer rules | {n} | Gate: must be fixed or accepted |
| Packages used outside their place | {n} | Gate: must be fixed or accepted |
| Duplicate code | {n} | Review: you decide |
| Repeated lists and text | {n} | Review: you decide |
| Size | {n} | Review: you decide |

{one or two sentences: what matters most, and what is already clean}

## {Check name}

| # | Where | What | Impact | Suggested fix | Effort | Your decision |
|---|---|---|---|---|---|---|
| {n} | `{file}:{line}` (several places separated by ` | `) | {what is repeated or wrong} | {what it costs the user or the owner} | {the concrete fix for this code} | small / medium / large | fix / accept / later |

Write "None found." under a check with no rows. Do not pad.

## Plug-in test

| Planned change | Files that would change today | Target |
|---|---|---|
| {a new item from design.next, or: add a reminder type / a sound / a screen} | {list} | one place |

## Could not verify
- {what the scripts cannot see: runtime wiring, generated code, near-copies that differ by a word}
