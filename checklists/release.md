# Release readiness

Store listing and policy items are in `app-store.md`. This list is about whether the build is produced and behaves in release form.

## Build
- [ ] A clean install from the lock file passes (`npm ci`, or the stack's equivalent) with the exact command the build service runs.
- [ ] No local-only path, file or environment value is needed to build; every build-time variable is set in the build service, not only on one machine.
- [ ] Version and build number are raised for this release and agree wherever they are shown.
- [ ] The release build is not the debug build: no dev menus, no test endpoints, no debug logging.
- [ ] Native changes since the last shipped build are listed; a change in native code or permissions needs a new binary, not only a code update.

## Configuration
- [ ] Every requested permission and capability is used by a feature, with a plain reason text.
- [ ] Keys that ship in the app are the public kind; secrets are only on servers.
- [ ] Release and development use separate backend settings where data could be mixed.
- [ ] Background modes, entitlements and notification settings match what the app does.

## Deploy steps outside the app
- [ ] Backend rules and indexes are deployed and match the repository.
- [ ] The public pages the app links to (privacy policy, support) are live at the addresses in the app.
- [ ] Crash reporting is switched on for release and receives a test event.

## Proof
- [ ] The signed build was installed on a real device and the main task done from a fresh install.
- [ ] Upgrading from the previous shipped version keeps existing data.
- [ ] A rollback is possible: the previous build is still available, and a bad data migration can be undone.
