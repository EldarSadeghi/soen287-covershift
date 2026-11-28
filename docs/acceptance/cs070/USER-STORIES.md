# CS-070 record matching in chat

| User story | Acceptance |
| --- | --- |
| As a manager, I can name an employee and a shift title so I review the intended shift. | Duty and replacement lookups share name and title matching. Tests cover a full name, a title with multiple words, a conflicting title, and multiple matching shifts. |
| As an employee, I can identify a request by the employee or shift it refers to. | Follow-through shares the same name and title matching and keeps its existing request-type and visibility checks. |
| As a manager, I can identify a copy source and destination by dates. | Week-copy lookup shares date parsing with replacement and duty lookups. Tests cover explicit invalid dates and day ordinals. |

The handlers still decide which records are eligible for their task. Existing review and save endpoints enforce the corresponding validation. The offline evaluation measures routing, while the record matching tests assert the records returned by the lookups.

## PR review follow-up

- Replacement titles recognize hyphen and slash separators.
- The duty lookup tries the full selector first. If it has no match, it can omit a recognized leading descriptor while retaining the employee, date and remaining title words. Duplicate employee names still return choices when multiple shifts match.
- In the scripted fictional manager preview, “Add ‘sweep’ to the morning opening shift on December 3” showed Jamie Lee’s Opening service (9 AM to noon) with a Review on Schedule button. The browser check stopped at the review card.
- 539 tests and 25 offline scenarios (217 checks) passed. Offline routing remained at 275 of 327 with zero wrong routes into save-capable features. No live provider calls were made.

## Second review follow-up

- Duty lookups accept stacked leading descriptors, including “early morning.” A time-of-day descriptor separated from the stored title must match the shift’s local start time. Unrecognized words stay in the selector to protect distinctions such as front versus back counter.
- The overnight daylight-saving test verifies selection by the local start date and confirms a past shift remains locked.
- In the fictional manager browser, the December 3 evening request showed “No matching shift.” The early morning request opened the Schedule form for Opening service with “sweep” filled in. Saving showed “Private draft saved” and the duty appeared on that shift.
