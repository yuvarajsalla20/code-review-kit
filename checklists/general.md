# General

- [ ] No crash on empty state (new user, no data, no network).
- [ ] Every async call has error handling and a user-visible failure state; no endless spinner.
- [ ] Double tap / double submit cannot create duplicates or run a destructive action twice.
- [ ] A background job that does one item per run and is guarded by a "running" flag starts its next run itself when it finishes. An effect that returned early while the flag was set does not run again on its own.
- [ ] Loading, offline and slow-network paths tested in code (timeouts present).
- [ ] No leftover `console.log`, debug screens, test data, TODO/FIXME on a main path.
- [ ] No dead code, unused exports, or duplicated logic that can drift apart. (Duplicates and repeated lists: run `structure.mjs`; do not rely on reading alone.)
- [ ] Version and build number updated for this release.
- [ ] Layout, accessibility and screen states: see `ux.md` (run by the `ux-reviewer`).
