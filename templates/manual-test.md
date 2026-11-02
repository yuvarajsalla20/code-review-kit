# Manual test script: {project} {version}

Run on a real device, fresh install. Tick each line; note anything odd.

## First run
1. Install the build. Open it. Expected: {first screen}.
2. Create an account with a new email. Expected: {landing screen}.
3. Close the app fully and reopen. Expected: still signed in.

## Core use
4. {add the main item}. Expected: {result}.
5. {edit it}. Expected: {result}.
6. {delete it}. Expected: {result}.
7. Turn on airplane mode, add an item, turn it off. Expected: item syncs.

## Settings and data
8. {change a setting}. Expected: {result}.
9. {export}. Expected: share sheet opens, file contents correct.
10. Sign out, sign back in. Expected: all data present.

## Edge cases
11. Rotate / small phone / large text size. Expected: nothing cut off.
12. Deny every permission prompt. Expected: app still usable.

## Dangerous actions (use a throwaway account)
13. Delete account. Expected: signed out, data gone, same email can sign up again.

## Second device
14. Sign in on another phone. Expected: same data.
