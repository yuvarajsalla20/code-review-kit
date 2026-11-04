# Performance and cost

Lists, animation and bundle items for React Native are in `react-native-expo.md`; read counts and listeners for Firestore are in `firebase.md`. This list is about the measured path and the stated scale.

For a library (`design.kind` is `library`), use **Library** below and skip Launch and Scale.

## Library
- [ ] Nothing is created on every render that a child receives as a prop (styles, objects, functions), unless it is memoised.
- [ ] Importing the package runs no work; unused parts can be dropped by the app's bundler.
- [ ] Timers, listeners and subscriptions it starts are stopped on unmount; no module-level cache grows without a limit.
- [ ] Size added to an app and render count of the busiest component are measured in a host app.

## Launch
- [ ] The first usable screen does not wait on the network, sign-in or a full data load.
- [ ] Work at startup is the minimum; the rest runs after the first screen.

## Scale
- [ ] With `design.scale` records per person, reading, parsing and writing local data stays fast, and one change does not rewrite everything.
- [ ] Lists that can grow are paged or virtualised.
- [ ] Caches, queues and logs have a size limit and are cleared.

## Background and battery
- [ ] Nothing animates, polls or listens while the app is off screen.
- [ ] Timers and listeners are removed when their screen or session ends.

## Network
- [ ] Reads and writes per screen and per change are counted, and the count does not grow with the data.
- [ ] Calls have a timeout, a retry limit and a back-off.
- [ ] Images and assets are sized for the screen.

## Needs a device
- [ ] Launch time, frame rate on the busiest screen, memory and battery over an hour are measured on a real, older phone against a target.
