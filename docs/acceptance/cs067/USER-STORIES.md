# CS-067 Employee follow-through on their own requests in chat

Issue [#155](https://github.com/EldarSadeghi/soen287-covershift/issues/155). An employee can ask the chat to answer a cover invitation, cancel a cover request or invitation they sent, or cancel time off. The chat only finds the item. Its link opens that item's existing confirmation on Cover requests, My requests or Time off, and the employee confirms it there. Nothing is saved from chat, and no paid AI call is made for the answer.

## Baseline (main at `f3f579a`)

523 tests, 25 offline acceptance scenarios with 217 checks, offline evaluation with 0 write-capable wrong routes.

## What changed

- **Three employee routes** (`public/routing/employee.js`), checked before drafts:
  - `answerInvite`: "Alex asked me to cover Saturday, accept it", "decline Jamie's invite for Friday", "accept the cover invitation from Sam", "say yes to Alex's swap request".
  - `cancelCover`: "cancel my cover request for Friday", "withdraw the invitation I sent to Sam", "cancel my claim for Saturday".
  - `cancelTimeOff`: "withdraw my time-off request for the 24th", "cancel my leave on December 9".

  They are added to the routing log, the classifier's employee options (with examples that differ from the evaluation messages), the composer's allowed list and the evaluation's write-capable list. Managers get the same replies as before.
- **Blocked commands.** An employee's own "decline the invite" (or "decline it" after "Alex asked me to cover…") is no longer refused. Everything else stays blocked, and so does any message that combines a follow-through with a blocked command:
  - cancelling the shift itself ("cancel my shift since I have time off");
  - someone else's claim ("decline Sam's claim");
  - "decline the invite, delete my shift";
  - "decline Alex's invite and approve Sam's claim".
- **Chat cards** (`public/ai-follow-through.js`), built on the existing status-lookup card:
  - **Lists.** Only the signed-in employee's own items, read from the existing lists:
    - invitations sent to them that are still waiting for an answer;
    - cover requests they created and invitations they sent that can still be cancelled;
    - time off that is pending or approved and hasn't started.
  - **Narrowing.** By date (including "the 24th", read as the next 24th), shift title and coworker name ("Alex asked me", "jamie's invite", "from sam rivera", "sent to Taylor"). A named coworker with no match gets "No matching invitation found", never someone else's item.
  - **Choosing.** Several matches get "Which … do you mean?" with a numbered list. Clicking one, or replying "the second one", continues the same lookup.
  - **One match.** "Ready to accept / decline / cancel", what happens next, and one link: "Review and accept", "Review and decline" or "Review cancellation".
  - **Claims.** A pending claim on a coworker's shift can't be withdrawn in CoverShift, so "cancel my claim" gets an honest "Can't be withdrawn here" answer with a link to My requests.
  - **Nothing to act on.** The card says so, for example "You have no cover invitations waiting for your answer."
  - **Privacy.** Private notes are never shown.
- **Pages** (`public/requested-action.js`). A link such as `?invitation=ID&action=accept` opens that item's own confirmation on Cover requests, My requests or Time off, once the page has loaded. The page's own wording, focus, revision check and uncertain-save handling are unchanged. The `action` is removed from the address, so a refresh doesn't open it again. If the item can no longer take that action, the page says "This item can no longer be accepted…" and opens nothing.

## Checks

| Check | Result |
| --- | --- |
| `npm run check` | Passed (syntax and format) |
| `npm test` | 528 / 528 passed (4 new follow-through tests; two pinned blocked-reply cases now use the manager role, since an employee's own "decline Alex's cover invitation" is a CS-067 route) |
| `npm run ai:acceptance` | 25 / 25 scenarios, 217 checks |
| `npm run ai:eval` (offline) | 0 write-capable wrong routes; new routes 15 / 19 local (4 paraphrases left to the classifier) |
| Evaluation set | 19 new labelled messages (311 in total); existing IDs unchanged |
| Routing snapshot vs `main` | 446 phrases (19 new), 144 follow-ups unchanged. Exactly four existing employee phrases change, from the generic "What would you like me to check?" to the new routes: "cancel my cover request", "cancel my claim for Friday's shift", "cancel my cover request for the Saturday shift" and "cancel my time off request for the shift on Friday". Manager routes and every blocked command are unchanged |
| Live evaluation (user-approved) | 305 / 311 correct (98.1%), 1.9% unhelpful generic, 0 write-capable wrong routes; all targets met. New routes 19 / 19, including the 4 paraphrases only the classifier could route. 52 classifier calls succeeded. The other 13 were refused locally because the evaluation's own lifetime ledger reached its 500-call safety cap (`MAX_CALLS_LIMIT` in `scripts/ai-eval.js`), so they never reached the provider. The 6 misses are among those 13 (5 follow-ups and "anything waiting on me?"); they all passed in the CS-066 live run and are unrelated to this change |

## Review fix (Codex on PR #156): the wrong record could be offered

With one cancellable cover request (Closing service) and no claim or invitation, "Cancel my claim for Friday", "Withdraw the invitation I sent" and "Cancel my cover request for the opening shift on Friday" all offered to cancel the Closing service request. Routing was right; the wrong record was picked afterwards. Now:
- **Record type.** "claim" matches only claims, "invite" or "invitation" only invitations you sent, and "request" cover requests or invitations (both are cover requests in the app). A picker reply such as "the Friday one" keeps the listed kinds.
- **Shift words.** Words describing the shift ("the opening shift", "my Friday closing shift", "the morning one") must match the shift's title, or the part of the day it starts in. This applies to invitations too.
- **No match.** The chat says "No matching claim found.", "No matching invitation you sent was found." or "No matching cover request found.", and shows only the general page link, never a cancellation link.
- **Tests.** The three reported messages, plus "the morning shift", each get the no-match answer with no `action=` link. "the closing shift on Friday", "my Friday evening cover request" and "cancel my cover request" each link to the one request. The picker test now reads which invitation is listed second, since both test invitations share a timestamp and their order was random. 528 / 528 tests, 25 / 25 acceptance scenarios, routing snapshot unchanged, offline eval 0 write-capable wrong routes.
- **Browser.** As Alex: "Cancel my claim for Friday" → "No matching claim found."; "…the opening shift on Friday" → "No matching cover request found."; "…the morning shift on Friday" → Morning coverage with its cancel link.

## Browser check (fictional demo, America/Toronto)

The preview saved, through the app's own services, fictional availability for Sam on December 3, cover invitations to Sam from Jamie (Opening service) and Alex (Afternoon coverage), and a pending time-off request for Sam on December 24.

| Who | Message or step | Result |
| --- | --- | --- |
| Sam | Alex asked me to cover Thursday, accept it | "Ready to accept · Afternoon coverage · From Alex Morgan", with "Review and accept" |
| Sam | Follow the link | Cover requests opens "Accept this whole shift…?" on Afternoon coverage, focus on Confirm accept; the action leaves the address. Confirmed: "Accepted and submitted for manager approval" |
| Sam | The same accept link again | "This item can no longer be accepted. Its current status is shown on this page." Nothing opens |
| Sam | decline jamie's invite | "Ready to decline · Opening service · From Jamie Lee" |
| Sam | accept Taylor's invite | "No matching invitation found." |
| Sam | withdraw my time-off request for the 24th | "Ready to cancel · Dec 24, 2026 · Full day". The link opens Time off's "Cancel this time off?" with focus on Keep current status (left unconfirmed) |
| Alex | cancel my cover request, then "the third one" | A list of three requests, each with its state ("claimed by Sam Rivera", "claimed by Jamie Lee", "open"), then Weekend service. The link opens My requests' "Cancel this request?" with focus on Keep as is |
| Jamie | cancel my claim for Friday (320px) | "Can't be withdrawn here", with an explanation and a link to My requests; no horizontal overflow |

The AI allowance stayed at 5 of 5, and the scripted provider logged no calls.

## Out of scope

Withdrawing a claim on a coworker's shift (CoverShift has no such action; the chat says so), approving or rejecting (managers), deleting and publishing, and more manager drafts (CS-068). CS-043 deployment remains last.
