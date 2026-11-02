# Money and dates

- [ ] Money is never summed as floating point without rounding to minor units.
- [ ] Mixed currencies are never added together without conversion.
- [ ] Zero, negative, very large and many-decimal amounts handled; input parsing rejects `1,5.0`, empty, `NaN`.
- [ ] Currency symbol/format correct for each supported region.
- [ ] "This month" boundaries use the user's local time, not UTC.
- [ ] Month rollover (31st to a short month), year rollover, and leap day behave correctly.
- [ ] Daylight-saving days do not drop or duplicate an entry.
- [ ] Recurring items: created once per period, never twice, never skipped after being offline.
- [ ] Exchange rates: failure falls back sensibly and tells the user; stale rates are not silently used for new entries.
- [ ] Exported totals (CSV/PDF) match what the screen shows.
