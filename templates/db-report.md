# Database model review: {project} {version}

Reviewed: {date}   Kit: {kit-version}   Store: Firestore

## Model
```
{collection tree: path, key fields, owner, who can read}
```

## Access patterns
| Screen / action | Query or write | Documents | Frequency | Per user per day |
|---|---|---|---|---|

## Cost model
| Item | Per user per day | At {n} users | Free-tier limit | Crossed at |
|---|---|---|---|---|
| Reads | | | 50,000 / day | |
| Writes | | | 20,000 / day | |
| Deletes | | | 20,000 / day | |
| Storage | | | 1 GiB | |

Show the arithmetic under the table. Say which numbers are assumed.

## Summary
{Overall risk in two sentences, counts by severity.}

## Findings (most severe first)

### {n}. [{Blocker|High|Medium|Low}] {title}
- **Where:** `{file}:{line}` (query, rule or model)
- **Problem:** {one sentence}
- **Cost or impact:** {in reads, writes, dollars, or data at risk, at the stated scale}
- **Trigger:** {exact situation}
- **Alternative:** {new document shape or query, and its trade-off}
- **Confidence:** {confirmed | unverified, needs: ...}

## Checklist
| Section | Pass | Fail | N/A |
|---|---|---|---|

## Could not verify
- {live data volumes, console indexes, billing}
