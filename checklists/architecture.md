# Architecture

## Fit to purpose
- [ ] The design can meet every stated goal at the stated scale (users, data size, requests).
- [ ] Constraints (budget, free tiers, team size, platforms, store rules) are respected.
- [ ] Nothing is built for a scale or feature the project does not need yet.

## Structure
- [ ] Each module has one clear job; no file or component does several unrelated things. (`structure.mjs` lists oversized files and functions; judge whether the size comes from several jobs.)
- [ ] Dependencies point one way (screens use logic; logic does not import screens). No cycles. (Enforced by `structure.mjs`: the `layers` map and the `cycles` check. A project without a `layers` map has not been checked.)
- [ ] Logic that appears in two places lives in one shared place. (`structure.mjs` finds repeated blocks, lists and text; confirm each is really the same job.)
- [ ] Platform differences (web/iOS/Android) are isolated behind small interfaces.
- [ ] External services (database, auth, rates, analytics) sit behind one thin layer, so swapping or mocking one touches one place. (Enforce with `restricted` in the `structure` block.)
- [ ] Adding the next planned feature, or a new item of an existing kind (type, option, screen), changes one place.

## Boundaries and reuse
- [ ] App-specific code and reusable packages are separated; packages contain nothing app-specific.
- [ ] Shared packages are pinned to exact versions or commits; builds can resolve them (public registry, tokens, lockfile).
- [ ] The public surface of each module is small and documented.

## State and data flow
- [ ] There is one source of truth for each piece of data; copies are derived, not edited.
- [ ] Loading, empty, error and offline states exist for every data-driven screen.
- [ ] Writes are idempotent or guarded against duplicates and double submits.

## Failure modes
- [ ] The app survives: no network, slow network, killed mid-write, expired sign-in, backend error.
- [ ] A partial failure leaves a state the user can recover from (retry works, nothing stuck).
- [ ] Timeouts exist on every network call; no spinner can last forever.

## Security and privacy boundaries
- [ ] The client is not trusted: rules or a server enforce access; secrets never ship in the app.
- [ ] Personal data is minimised, stored in a known place, and can be exported and deleted.
- [ ] Authentication and destructive actions are separated and re-checked.

## Cost and limits
- [ ] Free-tier and quota limits are known for every service, with an estimate of when they are reached.
- [ ] No unbounded read, write, loop or listener tied to data growth.
- [ ] Third-party lock-in is understood, with a rough exit path.

## Release and operations
- [ ] Builds are reproducible (lockfile, pinned dependencies, documented environment variables).
- [ ] A bad release can be rolled back or superseded quickly; the update path is known.
- [ ] Config differs correctly per environment (dev, production) and a missing setting fails loudly.
- [ ] Errors are visible somewhere (logs, crash reports) so problems are noticed without user reports.
- [ ] Versioning is consistent across app, packages and store listings.

## Change and growth
- [ ] The next two planned features (from `design.next`) fit without a rewrite.
- [ ] Data and API changes can ship without breaking older app versions still installed.
- [ ] Tests or checks cover the money, security and data-loss paths.
