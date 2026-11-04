# Failure paths (negative cases)

Run this after the normal checklists. For each item, find the code that handles it
and say what really happens. "Not handled" is a finding if the user could notice.

## Two devices, one account
- [ ] Another device deletes or edits an item while this one is closed: does it disappear here, or come back?
- [ ] Another device deletes an item while its screen is open here: no blank screen, no crash.
- [ ] Both devices act on the same item (Done on both): no skipped step, no duplicate history.
- [ ] A scheduled local effect (alert, timer) on a second device stops after the item is finished on the first.

## Stale actions
- [ ] An old notification, button or deep link acts on an earlier state: it must not change the current one.
- [ ] A double tap or two quick taps cannot run an action twice (save, done, delete, pay).
- [ ] An Undo restores exactly what was changed, including related records.

## Offline, retries and ordering
- [ ] A retried or queued write can never overwrite something newer (old save after a newer delete).
- [ ] The queue survives app kill, sign-out and a user switch without sending to the wrong account.
- [ ] A write that hangs offline does not block later writes.
- [ ] A rejected write is reported to the user, not dropped silently.
- [ ] First launch offline, and a first answer from the server that is empty or cached: nothing is wrongly deleted.

## Sign-out and user switch
- [ ] Nothing of the last user stays visible or active: screens, notifications, scheduled alerts, toasts, caches.
- [ ] Sign-in as a different user on the same device shows only their data.
- [ ] Background work started by the last user cannot write into the next user's storage.

## Time
- [ ] Daylight-saving gap (nonexistent local time) and overlap (repeated hour).
- [ ] Time-zone change and device-clock change, forward and back.
- [ ] Month ends: 29th to 31st, February, leap day; the original day returns after a short month.
- [ ] Past due time at save: refused or handled, not saved silently as something that never fires.
- [ ] Near-boundary cases: just before and after midnight, a lead time longer than the time left.

## Bad, old and unknown data
- [ ] A stored value this version does not know (new type, sound, status) does not crash a screen.
- [ ] Corrupt or truncated storage opens the app empty and keeps a copy of the bad file.
- [ ] A number that is zero, negative, huge or not an integer cannot cause a loop or a crash.
- [ ] Data written by a newer app version is not downgraded and re-uploaded by an older one.

## Limits and rules
- [ ] Every input limit in the app matches the database rule, in the same unit (characters, bytes, items).
- [ ] After upper-casing, trimming or encoding, the value still fits the limit.
- [ ] Emoji, accents, Indian and right-to-left scripts, very long words, empty and whitespace-only values.

## Permissions and system failures
- [ ] Permission denied, revoked later, or granted later: the app explains and recovers.
- [ ] Location, camera, notifications or network unavailable: a clear message, no endless spinner.
- [ ] A timeout on the screen while the operation keeps running in the background: state stays consistent.
- [ ] A multi-step operation that fails halfway (erase data, then delete login) leaves the user able to retry.

## Capacity
- [ ] Platform limits (for example 64 waiting local notifications, 500 writes per batch) are respected with 100+ items.
- [ ] One bad item cannot stop the rest of a loop (scheduling, syncing, exporting).

## Screens
- [ ] Largest text size, smallest iPhone, dark mode, Reduce Motion, keyboard open.
- [ ] Back from every screen; app killed and reopened on every screen.

## The fixes themselves
- [ ] For each fix made in this review: what new failure path does the fix open? Review the fix, not just the original code.
