# CS-066 Replacement suggestions for managers in chat

Issue [#153](https://github.com/EldarSadeghi/soen287-covershift/issues/153). A manager can ask who could take a shift. The answer comes from saved records: no paid AI call, and nothing is assigned, sent or saved.

## Baseline (main at `82d26c0`)

515 tests, 25 offline acceptance scenarios with 217 checks, offline evaluation with 0 write-capable wrong routes.

## What changed

- **Server** (`src/ai/replacements.js`, a new `replacements` kind of `GET /api/manager/chat-lookup`).
  - **Choosing the shift:** shifts that start on the given business-local date, optionally filtered by a title word and the assigned employee's name (whole name parts only).
    - One match gets suggestions.
    - Several matches are listed (up to 10, with the total) so the manager can choose.
    - No match, or a shift that has already started, gets an honest answer.
  - **Who can take it:** every active employee except the assignee is checked with the same rule cover invitations use: confirmed availability covering the whole shift, and no overlapping shift, pending claim or approved time off. A test checks that each suggestion agrees with `coverEligibility` for every coworker.
  - **Ranking:** fewest scheduled hours in the shift's business week (Monday–Sunday) first, counted like CS-065 team hours, then by name.
  - **Exclusions** carry one generic reason: "Has another shift, claim or time off then", "Not confirmed available for the full shift", or "Hasn't finished setting up their login". Time-off notes, private causes and contact details are never returned.
- **Chat** (`public/ai-replacements.js`). Reads the date, a shift title ("the December 5 closing shift") and the assigned employee ("Jamie's Friday shift", "replace Sam", "fill in for Taylor"). Day and month names are never read as names. Follow-ups:
  - With no date, it asks "Which date's shift needs cover?", and the reply continues the same lookup.
  - With several shifts, it asks "Which shift should I check?", and a reply such as "the opening one" picks one.
- **Card.** The shift (title, time, assignee), the ranked suggestions with each person's hours that week, a "Can't take it" list, the checked time and timezone, and a link to Schedule. It says that nothing is sent, and that the employee whose shift it is can invite one of them from My shifts.
- **Routing.** A new `replacements` manager route ("who can/could cover, replace, take, fill in for…", "is there anyone who can cover…", "find a replacement for…"). It needs an object after the verb, so "who can cover?" and "who can cover for me…" stay as they were. "Who is working Friday", "who's free Friday" and "who covered Jamie's shift" keep their routes, and employee routes don't change. The classifier's manager options and the routing log gain the route.

## Checks

| Check | Result |
| --- | --- |
| `npm run check` | Passed (syntax and format) |
| `npm test` | 523 / 523 passed (8 new replacement tests and one routing example) |
| `npm run ai:acceptance` | 25 / 25 scenarios, 217 checks |
| `npm run ai:eval` (offline) | 0 write-capable wrong routes; replacements 11 / 13 local (2 paraphrases left to the classifier) |
| Evaluation set | 13 new labelled messages (292 in total); existing IDs unchanged |
| Routing snapshot vs `main` | 427 phrases, 144 follow-ups; **no existing phrase changed** |
| Live evaluation (user-approved) | 291 / 292 correct (99.7%), 0 unhelpful generic, 0 write-capable wrong routes; 61 classifier calls, 0 errors; replacements 13 / 13; all targets met. The one miss is an existing employee message, "my coverage decisions this week" (`e-summary-06`): the classifier chose history instead of summary. It is unrelated to this change and is read-only; it passed in the CS-064 live run |

## Review clarification (Codex on #153): available vs. invitable

`coverEligibility` checks only availability and conflicts. The invitation flow also checks the 14-day window, a pending invitation or claim on the shift, and whether that coworker was already invited or declined it. So the card is now explicitly a **planning** answer, with each person's invitation status alongside:
- **Wording.** Suggestions read "N employees are available for all of [shift]". Each row says "Available for the full shift" (not "can take it"), and the excluded list is headed "Not available for this shift". The note says you can change the assignment on Schedule, and that the assignee can invite anyone marked "Can be invited now".
- **Invitation status per suggestion**, from `invitationBlocker` in `src/cover/service.js`. This check was extracted from the invitation flow, which now uses it too, so the two can't disagree:
  - Can be invited now
  - Invitations are only for upcoming shifts in the next 14 days
  - This shift already has a pending invitation or claim
  - Already declined this shift
  - Already invited to this shift
- **Regression test.** For a pending invitation, a prior decline, a cancelled invitation (which no longer counts) and a shift outside the window, "Can be invited now" appears exactly when the assignee's real invitation options (`coverOptions`) list that shift for that coworker. The existing cover-invitation tests still pass.

## Review fixes (Codex on PR #154)

- **Names are read whatever their case, and full names are kept.** "Who can cover jamie's Friday shift?" used to drop `jamie`. If Friday then had only one shift, belonging to someone else, the chat showed replacements for the wrong shift. Names now come from:
  - a possessive: "jamie lee's Friday shift";
  - a verb that takes a person: "replace sam rivera", "fill in for taylor";
  - "cover" or "take" followed by a date or time: "cover Alex tomorrow".

  Up to two words are kept, in any case. Article, date and shift words ("the", "Friday", "opening", "closing") are never read as names. A named employee with no matching shift gets "No shifts…", never another person's shift.
- **Hours are keyed by employee ID.** Two employees named Alex Lee with 4 and 0 hours both showed 0. Team hours and the suggestions now share `hoursByWorker`, which totals by employee ID, so same-name employees keep their own hours and ranking. Tests cover both fixes.

## Browser check (fictional demo, manager Morgan Chen, America/Toronto)

The preview saved fictional all-day availability for Sam and Taylor on December 3 through the app's own availability service.

| Message | Result |
| --- | --- |
| Who can cover a shift on December 3? | "Which shift should I check? There are 4 on Dec 3, 2026. Reply with its title, such as "Opening service"." |
| the opening one | Opening service (Jamie Lee): Sam Rivera (1 hour this week), then Taylor Brooks (2 hours). Alex Morgan: "Not confirmed available for the full shift". After the review fix, both rows also say "Can be invited now" |
| Who can cover Alex's afternoon shift on December 3? (320px) | Afternoon coverage (Alex Morgan): Sam and Taylor suggested, Jamie excluded; no horizontal overflow |

The AI allowance stayed at 5 of 5, so none of these used a paid call.

## Out of scope

Sending the invitation or reassigning from chat (they stay on the pages), employee follow-through (CS-067) and more manager drafts (CS-068). CS-043 deployment remains last.
