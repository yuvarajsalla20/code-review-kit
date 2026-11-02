# Firestore data model

## Model shape
- [ ] Every collection/subcollection has a clear owner (user, household, shared) and a stable path.
- [ ] Document ids are chosen on purpose (user id, date-prefixed, random) and cannot collide or be guessed to gain access.
- [ ] Data read together is stored together; data updated independently is not packed into one document.
- [ ] Duplicated (denormalised) data has a single writer and a clear way to stay in sync, or is safe to go stale.
- [ ] No unbounded arrays or maps inside a document (limit 1 MiB per document; arrays grow forever = problem).
- [ ] Money is stored as an exact, documented unit (minor units or fixed decimals) with its currency beside it.
- [ ] Dates are stored in one format and one timezone convention; month/day queries work with it.
- [ ] Booleans/flags and enums have a defined set of values.

## Access patterns
- [ ] Every screen and action is mapped to the exact query it runs, with its document count.
- [ ] Every query uses an index it can rely on (single-field automatic, or a composite that exists); no query needs a client-side filter of a large set.
- [ ] No query reads a whole collection that grows with user data on every launch, screen open or save.
- [ ] Live listeners are limited to what is on screen, scoped by range, and unsubscribed when not needed.
- [ ] Lists use limits or pagination; "all history" reads are explicit, rare and cached.
- [ ] Reads that happen after each write (refetching) are replaced by local updates where possible.

## Cost and quotas (state the numbers)
- [ ] Reads, writes and deletes per user per day are estimated from the access patterns.
- [ ] Storage per user per year is estimated.
- [ ] The free-tier limits (reads, writes, deletes, storage, bandwidth) are compared to expected users; the crossing point is stated.
- [ ] Account deletion cost is bounded (batches of at most 500 writes; chunked).

## Integrity and rules fit
- [ ] Every field the client writes is allowed by the rules, and every rule-required field is written by the client.
- [ ] Rules validate types, ranges and sizes (strings, numbers, lists), not only access.
- [ ] Update rules prevent adding unknown fields and changing ownership fields.
- [ ] Creating a document cannot overwrite or block another user's (id squatting).
- [ ] Rule `get()` calls per request stay well under the limit (10 for single-doc, 20 for batched/query).
- [ ] Required relationships are enforced (child belongs to a parent the user owns).

## Failure and concurrency
- [ ] Multi-document changes use a batch or transaction where partial success would corrupt data.
- [ ] Delete order is safe: children before parent, or rules still allow the cleanup after the parent is gone.
- [ ] Offline behaviour is defined: what is queued, what is lost if the app is killed, how conflicts resolve.
- [ ] Two devices editing the same document cannot silently lose a change (merge writes, or last-write-wins is acceptable and documented).
- [ ] A hot document (many writes per second or per user) is avoided; counters are sharded or derived.

## Growth and change
- [ ] A new optional field can be added without breaking old app versions or old documents.
- [ ] A required field change has a migration path (read old shape, write new shape).
- [ ] The model can extend to sharing (more than one member per ledger) without moving existing data.
- [ ] Export (all user data) and delete (all user data) cover every collection that holds personal data.
- [ ] Backups or point-in-time recovery are decided (enabled, or consciously not).

## Operations
- [ ] Indexes and rules are deployed from the repo (not edited only in the console).
- [ ] The rules deploy and the app release stay in sync (a new field ships rules first).
- [ ] Billing alerts or budget caps are set for the project.
