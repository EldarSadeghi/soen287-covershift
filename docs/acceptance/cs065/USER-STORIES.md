# CS-065 Manager insights in chat

Issue [#149](https://github.com/EldarSadeghi/soen287-covershift/issues/149). Three read-only manager lookups, added as new kinds of `GET /api/manager/chat-lookup` (CS-059). The answer is built from saved records, makes no paid AI call, and saves nothing.

## Baseline (main at `41eb7bc`)

502 tests after this change (499 before), 25 offline acceptance scenarios with 217 checks, offline evaluation 0 write-capable wrong routes.

## What changed

- **Hours and fairness** (`teamHours`). "Who has the most hours this week?", "who's under 20 hours next week?", "who is over 30 hours?", "is anyone close to overtime?", "show hours by employee", "who is being given too few shifts?". For each active employee: scheduled hours and shift count for the period. The default is this business week (Monday–Sunday). Shifts are clipped to the period and use elapsed time, so DST changes are counted correctly. Deactivated employees and other businesses are excluded.
- **Overtime line.** CoverShift stores no overtime rule. "Close to overtime" uses a documented 40-hours-a-week line, with a 4-hour margin, set in `src/ai/manager-insights.js` (`OVERTIME_WEEKLY_HOURS`). The card says "CoverShift doesn’t store an overtime rule, so this uses 40 hours a week." Overtime can only be checked for one week at a time; longer periods get a clear message.
- **Coverage gaps** (`coverageGaps`). "Any coverage gaps next week?", "uncovered shifts this week", "which shifts are affected by time off?". It lists upcoming shifts in the period (default: the next 14 days) that are:
  - open for cover;
  - claimed but awaiting approval;
  - assigned to someone with approved or pending time off and no cover request.

  Time-off notes are never returned.
- **Shift history** (`shiftHistory`). "What happened with Saturday’s closing shift?", "show the history of the December 5 opening shift". For shifts on that date, optionally filtered by a title word, it shows the current assignee and every coverage event (requested, claimed, approved, declined, reopened, cancelled) with who and when, oldest first. With no date, it asks: "Which date’s shift should I check?"
- **Routing.** The new patterns are in `public/routing/manager.js`. The classifier's manager options, the routing log `ROUTES` and the evaluation set (13 new labelled messages, 260 total) all include the three routes. "Which shifts still need cover?" stays the attention summary, as the release audit expects. The release-audit prompts are now part of the routing snapshot corpus, so a clash like this one shows up there.

## Checks

| Check | Result |
| --- | --- |
| `npm run check` | Passed (syntax and format) |
| `npm test` | 502 / 502 passed (3 new insight tests, plus new lookup and routing-group cases) |
| `npm run ai:acceptance` | 25 / 25 scenarios, 217 checks |
| `npm run ai:eval` (offline) | 217 / 260 local, 0 write-capable wrong routes; new labels 11 / 13 local (2 paraphrases left to the classifier) |
| Routing snapshot | 356 phrases, 144 follow-ups; 0 existing phrases changed |
| Live evaluation (user-approved) | 260 / 260 correct, 0 unhelpful generic, 0 write-capable wrong routes; 61 classifier calls, 0 errors; all targets met |

## Browser check (fictional demo, manager Morgan Chen, America/Toronto)

| Message | Result |
| --- | --- |
| Who has the most hours this week? | "Most scheduled hours: Jamie Lee (3 hours) and Sam Rivera (3 hours)." |
| Is anyone close to overtime next week? | "Nobody is within 4 hours of 40 hours." |
| Any coverage gaps in the next two weeks? | 5 shifts: four open for cover, one "Claimed by Jamie Lee · awaiting your approval"; Open Approvals link |
| What happened with Friday's shift? | Honest empty state: "No shifts on Nov 27, 2026." |
| Show the history of the December 4 morning shift | Morning coverage, assigned to Alex Morgan, "Cover requested by Alex Morgan" followed by the claim |

At a 320px viewport, the coverage gaps card fits with no horizontal overflow. The AI allowance stayed at 5 of 5, so none of these questions used a paid call.

## Out of scope

Replacement suggestions (CS-066), employee follow-through (CS-067) and more manager drafts (CS-068). CS-043 deployment remains last.
