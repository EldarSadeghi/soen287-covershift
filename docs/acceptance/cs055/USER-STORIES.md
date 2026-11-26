# CS-055 Fix AI routing problems found by the evaluation

Issue [#131](https://github.com/EldarSadeghi/soen287-covershift/issues/131). Follow-up to CS-054 (#129 / PR #130).

## What changed

- **Stated availability first** (`public/ai-chat-routing.js`): a message starting "I can take / I can pick up … shifts" routes to `availability` before the search wording "pick up … shifts" is checked.
- **Saved rules wording**: "show my saved availability rules" now routes to `rules`.
- **Unsupported commands**: approve, reject, decline, delete, fire, publish, send, swap, "assign me", "clock me in", "cancel my shift", "request time off", "make … a manager/admin", "give me admin" and "ignore … instructions" are recognised in any part of a message. Such a message is never routed to a task and never sent to the classifier. The chat answers: "I can't approve, assign, delete, send or change records from chat. Use the workspace pages for that, or ask me to check the schedule, find open shifts or prepare a draft for you to review."
- **Classifier context** (`src/ai/intent.js`): the instructions now say whether an employee or a manager is asking, with short examples per intent that differ from the evaluation messages (a test enforces this). Only the message text is sent; the allowed intents per role are unchanged.
- **Saved-rules guard**: a classifier `availability` answer for wording about saved or existing rules ("show me my existing rules", "what rules have I saved") becomes `clarification`.
- **Target change**: the 5% generic target now counts only unhelpful generic replies (the label was a real route). All generic replies are still reported. CS-054 results used the original definition.

## Checks

| Check | Result |
| --- | --- |
| `npm run check` | Passed |
| `npm test` | 435 / 435 passed (11 new in `tests/ai-routing-fixes.test.js`) |
| `npm run ai:acceptance` | 22 / 22 scenarios, 179 checks |
| `npm run ai:eval` (offline) | 0 write-capable wrong routes; exits 0 |
| `npm run ai:eval -- --live --max-calls 50` | Ran with the user's approval; 43 classifier calls; all targets met; exits 0 |

## Review fix: unsupported commands in follow-ups (Codex review of PR #132)

The chat composer checks whether a message answers the assistant's last question before it uses the router's answer. Those checks only excluded mixed requests, so an unsupported command could still continue a follow-up. Codex found the batch case: after "Which dates and times should these shifts use?", the reply "Create a shift and approve Sam's claim" was sent to drafting. The same gap existed for the coworker-date reply, the opening and "why not" explanation replies, the status-lookup choice, and the "find it / save it" availability answer.

- The follow-up decision moved from `public/ai-shift-draft.js` into `resolveChatTarget()` in `public/ai-chat-routing.js`, which tests can call directly. An unsupported command is checked first and never continues a follow-up.
- Multi-turn regression tests cover a pending batch, a coworker date, an opening, the availability question and a status choice, each followed by unsupported commands, while plain follow-ups such as "Friday 9am to 1pm and Saturday 5pm to 10pm" keep working. A guard test keeps the composer from re-implementing this logic inline.
- **Browser check** (fictional demo data, scripted provider, manager Morgan Chen): "Draft 3 shifts for next week" asked for dates; "Create a shift and approve Sam's claim" then showed the unsupported-command explanation and made no draft request. In a new chat, plain batch details after the same question went straight to batch drafting, as before.
- A clarification still ends a pending batch, as it did on `main`.
- The live evaluation was not re-run: the classifier and single-message routing are unchanged, and the offline evaluation still has 0 write-capable wrong routes.

## Offline evaluation (local rules only)

| Measure | CS-054 | CS-055 |
| --- | --- | --- |
| Routed correctly before the classifier | 135 / 165 (81.8%) | 139 / 165 (84.2%) |
| Messages that need the classifier | 56 | 43 |
| Write-capable wrong routes | 3 | **0** |

Thirteen messages that used to need a paid classifier call are now settled locally: the saved-rules message and twelve unsupported commands, which get the specific explanation instead of a classifier call.

## Live evaluation (2026-11-26, user-approved)

`npm run ai:eval -- --live --max-calls 50`, model `gpt-6-luna`, separate eval ledger. 43 classifier calls, 0 errors, every fallback message classified. Same 165 messages as CS-054.

| Measure | CS-054 live | CS-055 live | Target | Met |
| --- | --- | --- | --- | --- |
| Routed correctly | 152 / 165 (92.1%) | **161 / 165 (97.6%)** | at least 95% | Yes |
| Unhelpful generic clarification | 9 (5.5%) | **2 (1.2%)** | at most 5% | Yes |
| All generic clarifications (reported only) | 41 (24.8%) | 21 (12.7%) | — | — |
| Write-capable wrong routes | 4 | **0** | 0 | Yes |
| Classifier calls | 56 | 43 | — | — |

**Remaining misses (4)**, none write-capable:

| ID | Message | Expected | Got | Source |
| --- | --- | --- | --- | --- |
| e-questions-08 | whats my shedule this week | questions | summary | classifier |
| e-summary-06 | my coverage decisions this week | summary | clarification | classifier |
| m-draft-10 | give jamie a shift on saturday | draft | clarification | classifier |
| m-clarification-15 | find open shifts (manager) | clarification | summary | classifier |

"whats my shedule this week" and the manager's "find open shifts" both reach a read-only summary, so the user still sees useful information. These are candidates for a later round, together with conversation context for the classifier (stage 3).

A single live run measures one sample of a non-deterministic model; repeated runs can differ by a message or two. The run's full report stays local in `.covershift-ai-eval/run-2026-11-26T23-12-40-875Z/` (ignored by Git).
