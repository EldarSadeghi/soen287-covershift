# CS-064 Help and safe fallback for any chat request

Issue [#151](https://github.com/EldarSadeghi/soen287-covershift/issues/151). The chat now answers questions about using CoverShift, and explains where to go for actions it can't take. The answers come from a fixed help catalog that matches the app's own rules. They make no paid AI call, save nothing, and never include anyone's records or private details.

## Baseline (main at `8204d10`)

506 tests, 25 offline acceptance scenarios with 217 checks, offline evaluation with 0 write-capable wrong routes.

## What changed

- **Help catalog** (`public/routing/help.js`). 31 topics, each with the roles it serves, one or two short steps per role, and one link to a workspace page of that role:
  - **How-to:** request time off, review time off, get cover, pick up an open shift, answer a cover invitation, withdraw a request, share availability, add, change or publish shifts, add or deactivate an employee, review claims, see the schedule.
  - **Why-can't-I:** claim, request cover, request time off, edit a shift, approve time off, approve a claim, assign, publish. Each answer states the rules the server enforces, such as overlaps, approved time off, started or coverage-locked shifts, and unresolved assignments or claims.
  - **Meanings:** pending, awaiting approval, open for cover, expired, declined, cancelled, published or draft, availability windows and rules.
  - **What I can help with:** "help", "what can you do?".
  - **Questions about the other role's task** get a short pointer. For example, an employee asking how to publish is told that the manager publishes the schedule.
- **Routing.** A new `help` route is checked **last**, so it only takes messages that no existing task matched. Patterns must match from the start of the message, after lead-ins like "hey, can you tell me".
  - Existing routes don't change. "How many hours is Jamie working" stays a schedule question.
  - For employees, "why can't I claim this shift?" stays with the existing explanation of that opening.
  - The classifier's options for both roles and the routing log's `ROUTES` gain `help`.
- **Blocked commands name the page.** Approve, decline, delete or cancel shifts, publish, assign me, swap, fire, clock in and manager "request time off" still never run. The reply now says where to do the action instead, and the card links that page. Examples:
  - "I can't approve or decline claims from chat. Review them on Approvals."
  - "CoverShift doesn't track clock-ins or clock-outs, so I can't do that."

  Instruction overrides and role changes keep the general refusal and show no link.
- **Final fallback.** The generic question and its one-click suggestions stay the same, and the AI classifier still runs first. The chat now also shows a "What I can help with" card for the role. Kept open-shift search results are not replaced.
- **Card.** "Help · Nothing saved", the topic, the steps, and one "Open …" link. The chat history keeps only the first step.

## Checks

| Check | Result |
| --- | --- |
| `npm run check` | Passed (syntax and format) |
| `npm test` | 514 / 514 passed (8 new help tests; blocked-reply tests now check the specific wording) |
| `npm run ai:acceptance` | 25 / 25 scenarios, 217 checks |
| `npm run ai:eval` (offline) | 236 / 279 local, 0 write-capable wrong routes; help 21 / 21 local |
| Evaluation set | 19 new help messages. "help" (`e-clarification-02`, `m-clarification-10`) is relabelled `help` by ID, so no other ID changes |
| Routing snapshot vs `main` | 404 phrases, 144 follow-ups. Changes are "help" (clarification → help, both roles) and 40 blocked-command replies that now name a page. No other route or reply changed |
| Live evaluation (user-approved) | 279 / 279 correct, 0 unhelpful generic, 0 write-capable wrong routes; 59 classifier calls, 0 errors; help 21 / 21; all targets met |

## Review clarification (Codex on #151)

"Why can't I claim this shift?" keeps the existing shift-specific explanation, which uses the employee's own records:
- With the selected opening, the only result shown, or a position ("the second one"), the explanation checks that shift.
- With a shift title, it looks the shift up from the description.
- When the shift is unclear, the chat asks "Which opening do you mean?" instead of guessing.
- Only a question with no shift in it, such as "why can't I pick up extra hours", gets the general rule from the help catalog.

A regression test covers this, next to the existing tests that blocked actions stay blocked and that every help link is a page of the asker's role. No code change was needed.

## Review fixes (Codex on PR #152)

- **Blocked commands link the object they name, not just the verb.** Each rule now needs both the verb and its object:
  - "Delete my availability rule" (employee) suggests "cancel my saved availability rule" in chat, where rules are managed, and shows no link.
  - "Delete my availability for Friday" links Availability, where windows are withdrawn.
  - "Delete my time off request" links Time off.
  - Declining a cover invitation links Cover requests.
  - An employee's "approve Sam's claim" now links My requests.

  A command with an unclear object ("delete Jamie", "approve all pending", "approve the new schedule", "publish my availability") gets the general refusal and no link. Against the previous fixture, only those 5 employee claim replies changed text, and no route changed.
- **Publication guidance says when employees see changes.** Shifts stay private only after a two-week schedule has been prepared ("Prepare this schedule" turns on private drafts). Before that, saved shifts are visible straight away. The add-shift, publish and "published" answers now say this for both roles, and a test makes sure no answer promises privacy without that condition.

## Browser check (fictional demo)

| Who | Message | Result |
| --- | --- | --- |
| Manager Morgan | How do I add an employee? | "Adding an employee" card with two steps and **Open Team** |
| Manager Morgan | Approve Jamie's claim | Not run. "I can't approve or decline claims from chat. Review them on Approvals." with **Open Approvals** |
| Manager Morgan | What does awaiting approval mean? | Manager definition with **Open Approvals** |
| Manager Morgan | hello | The preview's scripted classifier returned clarification. The generic question and its 3 suggestions, plus the "What I can help with" card |
| Employee Alex, 320px | How do I give away my shift? | "Getting cover for your shift" card linking `/workspace/worker/shifts`, no horizontal overflow |

The button labels named in the steps ("Request cover", "Add shift", "Claim shift", "Deactivate employee") were checked against the pages.

## Out of scope

Replacement suggestions (CS-066), employee follow-through (CS-067) and more manager drafts (CS-068). CS-043 deployment remains last.
