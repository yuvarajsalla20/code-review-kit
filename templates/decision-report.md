# {Review name}: {project} {version}

Checked: {date}   Kit: {kit-version}

Used by the release, test, ux, performance and agent reviews. `scripts/release.mjs --report` and `scripts/testmap.mjs --report` write the first draft of the script rows. The reviewer opens every row, drops what is not real and writes the concrete fix.

## Summary

| Check | Found | Counts as |
|---|---|---|
| {check} | {n} | Gate: must be fixed or accepted / Review: you decide |

{one or two sentences: what matters most, and what is already clean}

## {Check name}

| # | Where | What | Impact | Suggested fix | Effort | Your decision |
|---|---|---|---|---|---|---|
| {n} | `{file}:{line}` | {what is wrong, and what it causes} | {what it costs the user or the owner} | {the concrete fix for this code} | small / medium / large | fix / accept / later |

Write "None found." under a check with no rows. Do not pad.

## Checklist walk

| Item | Result | Evidence |
|---|---|---|
| {checklist item} | pass / fail / not applicable | {file and line, or the missing piece} |

## Needs the owner or a device
- {what only the owner or a real device can confirm}

## Could not verify
- {what the scripts and the reviewer could not see}
