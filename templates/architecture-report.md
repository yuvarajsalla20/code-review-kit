# Architecture review: {project} {version}

Reviewed: {date}   Kit: {kit-version}

## How I read the design
{5-10 lines: modules, what owns what, external services, data flow. Mark anything inferred with (inferred).}

## Assumptions used
| Item | Value | Source |
|---|---|---|
| Expected users | {n} | config / assumed |
| Budget / plan | {x} | config / assumed |
| Platforms | {x} | config |

## Summary
{Overall risk in two sentences. Counts by severity. Split: fix before launch / fix as it grows.}

## Findings (most severe first)

### {n}. [{Blocker|High|Medium|Low}] {title}   ({before launch | as it grows})
- **What the design does:** {one or two sentences, with file references}
- **Why it matters here:** {tied to the stated scale or goal}
- **Trigger:** {the situation that exposes it}
- **Options:**
  | Option | Buys you | Costs you |
  |---|---|---|
- **Recommendation:** {which and why}
- **Confidence:** {confirmed | inferred, needs: ...}

## Checklist
| Section | Pass | Risk | N/A |
|---|---|---|---|

## Questions for the owner
- {each assumption whose answer would change the advice}

## Could not verify
- {production traffic, real billing, live configuration}
