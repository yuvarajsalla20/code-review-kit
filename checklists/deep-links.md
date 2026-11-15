# Deep links and incoming URLs

Any website, message, QR code, widget or notification can open the app with any URL. Treat every link as untrusted input. The `links` script area finds candidates; walk every item here as well.

- [ ] A malformed link (a stray `%`, a cut-off escape, an unknown path, a very long id) never crashes the app: every decode or parse is in a try/catch with a safe fallback, usually Home.
- [ ] No link is resolved while rendering in a way that can throw outside the error boundary.
- [ ] A link never saves, deletes, buys or sends anything by itself: it only opens a screen, and the person confirms.
- [ ] A link to an item that is deleted, done or belongs to someone else lands on a sensible screen, never a blank one.
- [ ] A link that arrives while signed out waits until sign-in, then opens; it cannot get past the sign-in screen.
- [ ] A link that arrives while a form has unsaved changes asks first (the same Discard prompt as Back), or waits.
- [ ] The same link opens correctly from a cold start (the app was killed), from the background, and while open.
- [ ] Links from widgets and notifications are tested on a device; universal links (https) are checked against the associated-domains file.
