# General

- [ ] No crash on empty state (new user, no data, no network).
- [ ] Every async call has error handling and a user-visible failure state; no endless spinner.
- [ ] Double tap / double submit cannot create duplicates or run a destructive action twice.
- [ ] Loading, offline and slow-network paths tested in code (timeouts present).
- [ ] No leftover `console.log`, debug screens, test data, TODO/FIXME on a main path.
- [ ] No dead code, unused exports, or duplicated logic that can drift apart.
- [ ] Long text, emoji and right-to-left text do not break layouts.
- [ ] Small screens: nothing off-screen or unreachable behind the keyboard.
- [ ] Accessible: text contrast, tap targets, labels on icon-only buttons.
- [ ] Version and build number updated for this release.
