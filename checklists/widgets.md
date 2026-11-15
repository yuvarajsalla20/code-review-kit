# Widgets and Lock Screen (iOS widgets, Live Activities, Dynamic Island)

Use for any app with a Home Screen widget, a Lock Screen widget or a Live Activity. The `widgets` script area finds candidates; walk every item here as well.

## What it shows
- [ ] Every kind of item appears: one-time, and repeating ones after their first occurrence (daily, weekly, monthly, yearly). Test with a daily item at a time already passed today.
- [ ] Done, deleted and archived items never appear; an item edited on another phone updates the widget.
- [ ] An empty list shows a deliberate empty state, not a blank or a stale item.
- [ ] Signed out, or the paid plan lapsed: the widget shows a locked or empty state, and the Live Activity ends.

## Time
- [ ] The timeline covers a fixed span (days, not a fixed count of entries), and the last entry is neutral ("Open the app to refresh"): iOS does not wake the app when entries run out.
- [ ] Day words ("Today", "Tomorrow") flip at local midnight; times follow a time-zone change (prefer iOS's own date text over fixed strings).
- [ ] A Live Activity ends a set time after it is due; it does not sit on "Due now" for hours.

## Privacy on a locked phone
- [ ] Personal text (names, amounts, people, places, health words) is marked privacySensitive or redacted, so it hides when notification previews are "When Unlocked".
- [ ] The privacy policy says what the widget and Live Activity show, and that the shared app-group storage stays on the device.
- [ ] Signing out clears the shared app-group data.

## Starting and stopping
- [ ] Only one Live Activity per item: updates from quick successive changes are queued, and a running one is found again after the app restarts instead of starting another.
- [ ] A Live Activity the person swiped away is not started again for the same item.
- [ ] Tapping a widget or the Live Activity opens the right screen, also from a killed app, and does not throw away unsaved typing (see `deep-links.md`).

## Store and build
- [ ] The widget extension and the app share the same app group in both entitlements files.
- [ ] `NSSupportsLiveActivities` is set when Live Activities are used.
- [ ] Widget text, sizes and colours checked on the smallest and largest phones, and in StandBy if supported.
