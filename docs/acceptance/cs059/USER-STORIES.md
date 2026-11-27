# CS-059 · Manager lookups in chat

[Tracking issue #139](https://github.com/EldarSadeghi/soen287-covershift/issues/139)

## Baseline

Recorded on main at `64226f5` before source changes. The current suite contained 466 tests, up from the 443 in the original brief. All 466 passed. The offline acceptance runner passed 22 scenarios and 179 checks. Offline routing matched 148 of 181 labels, with 52 classifier candidates and zero incorrect write-capable routes.

## User stories and acceptance

| As a manager, I want to… | Acceptance check |
| --- | --- |
| Check whether Alex Morgan is available on December 3 | The card shows Alex only, confirmed free windows, a checked time and timezone, and a link to Availability. |
| Find out who is off | Chat asks for a date if omitted. December 3 shows approved leave and pending review separately. The response contains no notes. |
| Check whether an assigned shift is covered | A date or exact title can match open, pending and approved coverage. Claimed and covered rows identify the claimant. |
| See whether the upcoming schedule was published | The card shows the two-week dates, Monday due date, publication status and unpublished changes, with a Schedule link. |
| See what needs my attention | The manager summary adds pending leave and a due or overdue publication. The employee summary keeps its existing sections. |
| Follow up safely and use the keyboard | A date completes a lookup. An unsupported command stays blocked. In the browser, Enter opened and submitted chat and Escape returned focus to the launcher. |
| Check saved data with confidence | Signed-out and worker requests fail. Another business cannot see Morgan’s records. A Pacific-time test covers the local date and a request ending at midnight. Reads preserve the saved state. |

## Verification

- Final regression suite: 469 tests passed, including format and syntax checks.

- Offline acceptance: 22 scenarios, 179 checks, all passed.
- Offline routing: 166/202 local matches, 55 classifier candidates, 0 incorrect write-capable routes. All 181 prior prompts retained their IDs and contents.
- Scripted Morgan preview: exact Alex question, date clarification and follow-up, approved and pending time off, a pending coverage claim, overdue publication with one unpublished change, and the attention summary. An unmatched leave phrasing resolved through the scripted classifier.
- At a 320 CSS-pixel viewport, the time-off card width and scroll width both measured 256 px. The screenshot excludes the browser scrollbar.
- Live evaluation awaits approval. The plan caps the separate evaluation ledger at 55 classifier calls and measures the original cohort separately.

## Browser evidence

- [Desktop availability card](desktop-availability.jpg)
- [Mobile time-off card](mobile-time-off.jpg)
