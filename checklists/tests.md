# Tests

Negative cases are in `failure-paths.md`; this list is about whether the tests themselves can be trusted.

## Coverage of promises
- [ ] Each item in `design.mustNeverHappen` has at least one test that fails if the promise breaks.
- [ ] Each risky area has tests on its rules (dates, repeats, merging, deletion), not only on its happy path.
- [ ] Money, dates and counts have tests at the edges: zero, one, maximum, month end, daylight-saving change, leap day.
- [ ] Data stored by an older version is read correctly (migration test).

## Quality
- [ ] Every test has an assertion on the outcome, not only that the code ran.
- [ ] Expected values are written by hand from the rule, not copied from the code's output.
- [ ] A one-line change to a key rule makes a test fail (checked on a scratch copy).
- [ ] Mocks replace the outside world (network, clock, storage), not the logic under test.
- [ ] No test depends on the real clock, random values, the network or run order.
- [ ] A failing test says what broke (clear name and message).

## Gaps stated
- [ ] What tests cannot cover here (alerts firing, permissions, keyboard, real sign-in) is written down and covered by the manual test script.
