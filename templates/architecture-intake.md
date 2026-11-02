# Architecture review intake

Ask the owner these before reviewing. Put the answers in the `design` block of `review.config.json`.
Anything unanswered becomes a stated assumption in the report.

1. **Goal:** what must this project do, for whom, in one or two sentences?
2. **Scale now and in 12 months:** users, records per user, requests per day.
3. **Budget and plan:** free tiers only, or a monthly budget? Which services are on which plan?
4. **Platforms and stores:** web, iOS, Android? Which stores and by when?
5. **Team:** who builds and maintains it, and how many hours a week?
6. **Must never happen:** the one or two failures that would hurt most (data loss, a leak, a wrong total).
7. **Next two features:** what is planned, so the design can be checked against it.
8. **Constraints:** regions, regulations, tools you must or must not use.
9. **Already decided:** choices that are fixed and should not be reopened.
