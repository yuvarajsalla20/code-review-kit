# React Native / Expo

- [ ] Works on a real iPhone, not just the web build: share sheet, file save, photo picker, camera permission.
- [ ] Every permission has a plain-language usage string in app config; none requested that is not used.
- [ ] Keyboard never hides the focused input; screens scroll on small phones.
- [ ] Safe-area insets respected (notch, home indicator).
- [ ] Web-only or native-only APIs are platform-split, not called on the wrong platform.
- [ ] Effects clean up timers, listeners and subscriptions; no state updates after unmount.
- [ ] Lists use stable keys; long lists do not render everything at once.
- [ ] Animations run smoothly on a mid-range phone; heavy decorative layers are bounded.
- [ ] Environment variables used at build time are set in the build service, not only in a local `.env`.
- [ ] Missing config fails clearly (or falls back deliberately), never a blank screen.
- [ ] Back gesture / hardware back does not trap the user or lose unsaved input silently.
- [ ] Bundle: no unused heavy dependencies; images and fonts are sized for use.
- [ ] Version, build number, bundle id and package name are correct and consistent.
