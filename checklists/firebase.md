# Firebase / Firestore

- [ ] Rules deny by default; every collection has an explicit rule.
- [ ] A signed-in user cannot read, write or delete another user's documents (check each path, including subcollections).
- [ ] Create rules validate field names (`hasOnly`), types, sizes and string lengths; update rules cannot add fields.
- [ ] Rules and client agree: every field the app writes is allowed, and every rule field is written by the app (a mismatch breaks real users).
- [ ] Ownership fields (owner, members) cannot be changed by non-owners.
- [ ] Auth state is awaited before the first read; no read with `null` user.
- [ ] Listeners are unsubscribed on sign-out; local caches cleared on sign-out.
- [ ] Offline writes queue and sync; conflicts do not silently overwrite newer data.
- [ ] Batched writes stay under limits (500 operations); large deletes are chunked.
- [ ] Delete account: re-authenticates, deletes owned data first, then the auth user; a failure midway leaves the user able to retry.
- [ ] Indexes needed by queries exist; no query depends on an unindexed combination.
- [ ] Free-tier limits: no listener or loop that reads the whole database repeatedly.
- [ ] Public client config is fine in the app; no admin credentials or service-account files in the repo.
- [ ] Hosting: security headers, cache headers, and the rules deploy command is documented.
