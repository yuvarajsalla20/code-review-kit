# Review summary: {project} {version}

Checked: {date}   Kit: {kit-version}   Checks run: {list}

## Verdict

**{Ready | Ready after fixes | Not ready}**: {one sentence: what that means for releasing}

| | Count |
|---|---|
| Must fix before release (gated or Blocker) | {n} |
| High | {n} |
| Medium | {n} |
| Low | {n} |

How the verdict is set: **Not ready** if any Blocker or any gated check fails and is not accepted; **Ready after fixes** if there are Highs; **Ready** otherwise.

## Fix first

The five items that matter most, in plain words.

| # | What could go wrong for users | Where | Effort |
|---|---|---|---|
| 1 | {the impact, one sentence, no jargon} | {area and file} | small / medium / large |

## Your decisions

Every finding from every check, ranked by benefit for effort. Mark the last column and send it back; nothing is changed until you do.

| # | What it means | Why it matters | Suggested fix | Effort | Area | Your decision |
|---|---|---|---|---|---|---|
| 1 | {plain explanation} | {impact on users or on future work} | {concrete fix} | small / medium / large | structure / release / tests / security / usability / speed / agents | fix / accept / later |

Technical detail for each row (file, line, trigger) is in the area section below, under the same number.

## By area

### {Area name}

{one or two sentences: what is clean and what is not}

| # | Where | What (technical) | Trigger |
|---|---|---|---|
| 1 | `{file}:{line}` | {the exact problem} | {steps or input that cause it} |

Write "None found." for an area with nothing real.

## Terms used

| Term | Meaning |
|---|---|
| {term, for example "circular import"} | {one-line plain explanation, written the first time it appears} |

## What we could not check
- {plain list: needs a real phone, the live store, a live backend, an installed plugin}

---
Version {kit-version} - {date and time with time zone}   (shown on a gray footer on the page)
