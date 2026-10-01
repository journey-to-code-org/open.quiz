# Leaderboard rules

The leaderboard week starts every **Monday at 00:00 UTC**. A week is represented as a
half-open interval: `week_start` is included and `week_end` is excluded. For example, the week
starting `2026-09-07T00:00:00.000Z` ends immediately before
`2026-09-14T00:00:00.000Z`.

Weekly totals are materialized in the `weeklyleaderboards` MongoDB collection. Each document
stores one learner's `xp_total` for one `week_start`; a unique index prevents duplicate totals for
the same learner and week. The ranking index sorts totals from highest to lowest, with `user_id`
available as a stable tie-breaker.

The future aggregation and reset jobs must use `getLeaderboardWeek` from
`backend/src/utils/leaderboardTime.js` rather than calculating their own boundaries.

`rollupLeaderboardWeek` in `backend/src/services/weeklyLeaderboard.service.js` materializes a
week on demand. It groups immutable XP events by learner and replaces each stored `xp_total`, so
rerunning the rollup is idempotent rather than adding the same XP again. A scheduler can safely run
this rollup nightly and immediately before the weekly reset.

`getLeaderboardForUser` runs that rollup before returning rankings to opted-in learners, so the
dashboard can show current-week XP even before the nightly job runs.

At the Monday boundary, `rotatePreviousLeaderboardWeek` in
`backend/src/services/leaderboardReset.service.js` performs the reset in one transaction. It first
finalizes the previous week's rollup, assigns final ranks only among eligible opted-in learners,
upserts those results into `leaderboardhistories`, and removes the previous week from active totals.
The history contains internal user IDs, XP, and ranks but no profile or contact information. The
job is idempotent if retried because history records are uniquely keyed by learner and week.

`backend/src/jobs/leaderboardScheduler.js` starts after the database connection. It runs catch-up
rotation and rollup work once at process startup, schedules the weekly rotation for **Monday at
00:00 UTC**, and schedules current-week rollups nightly at **00:05 UTC**. Each timer calculates its
next UTC boundary after it finishes instead of relying on the server's local timezone. Job errors
are logged and the following run remains scheduled.

XP awards are recorded in the `xpevents` collection. Each event stores the requested and actually
awarded XP, its UTC day bucket, and its leaderboard week bucket. Weekly totals sum `awarded_xp`,
not `requested_xp`. The `(user_id, source_key)` unique index makes reward sources idempotent, while
the `(user_id, day_start)` index supports enforcing the 500 XP daily cap in UTC.

XP events contain internal identifiers and award data only. They must not contain names, email
addresses, avatars, or other profile information.

All new reward paths must call `awardXp` from `backend/src/services/xpAward.service.js`. Inside a
MongoDB transaction, the service checks the reward's source key, atomically allocates remaining XP
from the learner's `dailyxptotals` document, and creates the event. The shared daily document makes
concurrent rewards contend on the same record, preventing their combined total from exceeding 500
XP. Production MongoDB must support transactions (as MongoDB Atlas and replica sets do).

The onboarding-completion reward uses the source key `onboarding:v1`. Resetting or replaying the
onboarding tour therefore cannot award it a second time.

This storage contract does not make a learner visible. Leaderboard queries must separately require
`leaderboard_opt_in: true` and must return only display name, avatar, weekly XP, and rank.

`getLeaderboardForUser` in `backend/src/services/leaderboardRead.service.js` enforces that rule.
Opted-out learners receive empty rankings, and opted-out, disabled, deleted, or archived accounts
are removed before ranks are assigned. Ranked entries project only an internal user ID, display
name, avatar URL, weekly XP, and rank. The default public group contains 20 learners; the current
learner is returned separately even when ranked outside that group. Learners with equal XP share
the same competition rank, with internal user ID used only for stable display ordering.
