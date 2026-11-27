# Money and dates

- [ ] Money is never summed as floating point without rounding to minor units.
- [ ] Mixed currencies are never added together without conversion.
- [ ] Zero, negative, very large and many-decimal amounts handled; input parsing rejects `1,5.0`, empty, `NaN`.
- [ ] A decimal comma (`2,5`, typed by the number pad in many regions) is read as 2.5 or refused, never as 25. (`integrity.mjs` `decimalComma`)
- [ ] Each row is rounded the same way before it is summed, so the rows shown add up exactly to the total shown.
- [ ] A typed date is checked against the calendar: 30 February, 31 April and 29 February in a non-leap year are refused.
- [ ] Currency symbol/format correct for each supported region.
- [ ] "This month" boundaries use the user's local time, not UTC.
- [ ] Month rollover (31st to a short month), year rollover, and leap day behave correctly.
- [ ] Daylight-saving days do not drop or duplicate an entry.
- [ ] Recurring items: created once per period, never twice, never skipped after being offline.
- [ ] Exchange rates: failure falls back sensibly and tells the user; stale rates are not silently used for new entries.
- [ ] Exported totals (CSV/PDF) match what the screen shows, in the same currency, including when the exchange rate is missing.
- [ ] Totals built on an old rate say so where the total is shown, not only on the rates screen.
