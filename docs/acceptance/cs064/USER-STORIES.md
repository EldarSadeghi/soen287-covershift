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
| `npm test` | 512 / 512 passed (6 new help tests; blocked-reply tests now check the specific wording) |
| `npm run ai:acceptance` | 25 / 25 scenarios, 217 checks |
| `npm run ai:eval` (offline) | 236 / 279 local, 0 write-capable wrong routes; help 21 / 21 local |
| Evaluation set | 19 new help messages. "help" (`e-clarification-02`, `m-clarification-10`) is relabelled `help` by ID, so no other ID changes |
| Routing snapshot vs `main` | 404 phrases, 144 follow-ups. Changes are "help" (clarification → help, both roles) and 40 blocked-command replies that now name a page. No other route or reply changed |
| Live evaluation (user-approved) | 279 / 279 correct, 0 unhelpful generic, 0 write-capable wrong routes; 59 classifier calls, 0 errors; help 21 / 21; all targets met |

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
