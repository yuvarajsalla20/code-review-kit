---
name: db-model-review
description: Review a Firestore data model - collections, access patterns, read/write cost against free-tier limits, integrity versus security rules, growth and migration. Use for "review the database design", "will this stay in the free tier", "is the Firestore model right".
---

# Firestore data model review

Findings with costs first; change nothing until the owner chooses.

## Steps
1. **Config.** Read `review.config.json`: the `design` block (scale, budget) and the `data` block (model files, rules file, access files). Fill gaps by asking, or state assumptions.
2. **Run the agent.** Start `db-model-reviewer` in a fresh context with the project path, config and kit path.
3. **Verify.** Re-trace every Blocker and High yourself: read the query or rule it cites, and re-do its cost arithmetic.
4. **Report.** Use `templates/db-report.md`: the model tree, the access-pattern table, the cost model with numbers, then findings with alternatives.
5. **Decide together.** Ask which alternatives to adopt. Rules changes ship before app changes that depend on them.

## Notes
- Firestore models follow the queries; duplication for reads is fine when updates are controlled.
- Every finding states its cost in reads, writes, dollars or data at risk at the stated scale.
- Pair with `architecture-review` for the system around the database.
