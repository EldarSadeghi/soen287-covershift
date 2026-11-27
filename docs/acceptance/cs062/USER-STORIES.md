# CS-062 Employee drafts for time off and cover requests in chat

[GitHub issue #145](https://github.com/EldarSadeghi/soen287-covershift/issues/145)

| Story | Acceptance evidence |
| --- | --- |
| As Jamie, I can ask for a day or range off and review the proposed dates. | The draft uses the existing time-off validator in the business timezone. The browser review showed December 4 as an inclusive full-day request with an empty private note. |
| As Jamie, I can see why overlapping shifts might delay approval. | The draft listed overlapping commitments. The existing form saved one pending request after confirmation, and the request displayed the approval blockers. |
| As Jamie, I can ask a coworker to cover one of my shifts. | The browser opened the existing cover composer with Alex Morgan and Saturday opening selected. Confirmation produced one pending invitation in Sent. An ineligible coworker produced an explanation. |
| As Jamie, I can clarify or correct draft details. | The browser asked for a date on an ambiguous Friday. Routing and refinement tests cover date and hours replies, corrections, and unsupported commands. |
| As a manager, I retain the existing time-off and cover controls. | Offline HTTP workflows verify byte-for-byte unchanged business data during the chat draft, then exercise the existing confirmation endpoints, replay and stale-revision handling. |

## Verification

Baseline on main at `32b3d28` after CS-061 was 482 passing tests, 23 offline scenarios with 189 checks, and 195 of 232 offline routes correct with zero incorrect write-capable routes.

The branch passed 487 tests and 25 offline scenarios with 217 checks. CS-062 adds 15 labelled messages. The established case `e-clarification-10` now expects a time-off draft, since requesting time off is supported in this increment. The case ID and wording stay stable. The offline evaluation reports 205 of 247 correct, 61 classifier candidates, 42 unhelpful generic replies and zero incorrect write-capable routes. Live evaluation awaits approval.

## Browser evidence

Fictional Jamie signed in on an isolated loopback instance with scripted replies and used the keyboard to open chat and hand off the drafts. Both existing confirmation flows were exercised. The 320 CSS-pixel viewport had no page-level horizontal overflow.

- [Time-off draft and approval blockers](time-off.jpg)
- [Cover draft at 320 CSS pixels](cover.jpg)
