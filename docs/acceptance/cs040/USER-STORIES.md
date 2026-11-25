# CS-040 acceptance report — 2026-11-24

Issue #75; branch `codex/CS-040-request-cover`; status **Your review**. User selected one pending invitation per shift, open-board competition, and acceptance requiring manager approval. No feature push or merge authorized.

## Results

`npm run verify`: **315 tests passed, 0 failed**, including **19 new request-cover tests**, all existing regressions and the offline AI corpus. See [full verification output](verification.txt). Final frontend-only feedback/focus refinements passed Node syntax checks and the browser checks below. Existing offline AI tests use recorded provider replies; no new live-provider evaluation or paid API calls were needed.

| ID | User story / acceptance criterion | Evidence and result |
| --- | --- | --- |
| CS-040-US01 | As a worker, choose Request cover from a coworker’s free window and review a compatible whole assigned shift before sending. | Browser December 3 window, optional message, explicit review; [confirmation](fresh-review-confirmation.jpg). No-fit fragments show no eligible shifts and disabled review. Service full-window/ownership/horizon/stale guards pass. |
| CS-040-US02 | As a recipient, receive a private invitation and explicitly accept or decline. | Browser accept November 26 and November 30, decline December 1; notification and Received/Sent cards. [Accepted receipt](accepted-awaiting-manager.jpg). No assignment transfer at acceptance. |
| CS-040-US03 | As a manager, retain final approval with fresh eligibility checks. | Browser approved November 26 then recipient My shifts showed assignment; [saved schedule](approved-worker-schedule.jpg). November 30 preserved awaiting approval with original Alex assigned. Service tests approval, rejection/reopening and late leave/availability conflicts. |
| CS-040-US04 | As a sender, cancel an unanswered invitation and follow its outcome. | Browser December 2 cancellation, recipient refresh shows Cancelled; service terminal/repeat guards and linked outcomes pass. |
| CS-040-US05 | Preserve one pending invitation without reserving the public board. | Atomic competing-recipient submissions, board-claim/acceptance race, existing public opening reuse and automatic matching competition pass. Invalid pending invitation expires; assignment stays unchanged. |
| CS-040-US06 | Expire stale invitations and preserve accurate historical evidence. | Tests cover edit/delete/deactivate, withdrawn availability, shift start, periodic expiry delivery/no duplicates, unchanged read bytes and immutable snapshot after shift deletion. Browser terminal states agree. |
| CS-040-US07 | Recover safely from network errors without duplicate actions. | Real local fault proxy forwarded and committed send, then dropped response: Check saved result found one saved invitation; [receipt](recovered-send.jpg). Same dropped response after accept: Refresh found Awaiting manager approval, no automatic repost; [receipt](recovered-accept.jpg). Injected one failed inbox GET showed explicit error/retry; Refresh restored four cards. Proxies are QA-only, outside repository. |
| CS-040-US08 | Protect scope, notes and mutation authorization. | Tests cover foreign-business/participant scope, manager read-only API, notification read ownership, session/role/CSRF/origin/content-type/exact-fields, forged records/history, malformed/oversize/control notes, stale revision and rolling-24-hour quota without writes. Notes rendered with textContent. |
| CS-040-US09 | Use the workflow on a narrow screen and with keyboard controls. | Actual 320px inbox and composer verified: document width305px, open composer273px, internal scrolling and confirmation fit; [inbox](inbox-mobile.jpg), [composer](composer-mobile.jpg). Escape dismisses and returns focus to the specific Request cover button after explicit trigger refinement. Confirmation region receives focus. Viewport reset afterward. |
| CS-040-US10 | Retain existing workflows and normal data. | All prior tests pass. Preview and fault checks used temporary fictional storage only. No normal account database, Desktop checkout, provider key or production setting changed. |

## Review scenario

See [workflow and local accounts](../../request-cover.md). Alex Morgan is an employee; Morgan Chen is the manager. Fresh Dec 3 invitation intentionally remains unsent. November 30 remains accepted and awaiting manager approval for the user to inspect. Initial November 26 approved, Dec 1 declined, Dec 2 cancelled.

## Limits

This is a focused local/service/browser acceptance pass, not exhaustive device or assistive-technology certification. Periodic expiration was verified in automated controlled-clock tests; a real overnight wall-clock wait was not performed. Accepted-start expiry follows existing coverage display semantics and does not introduce a separate new notification. One invitation per unchanged shift/coworker, 20 per rolling24h and 1,000 lifetime per sender are deliberate anti-repeat limits. See workflow documentation for cancellation after acceptance and full-availability requirements.

GitHub issue remains open. Board verified **Your review**; [board evidence](github-review.jpg). Await explicit approval before any push, PR or merge.

## Review correction: cancelled request retry

User reported Monday Nov30 2–5 PM missing despite Jamie’s12–6 availability. The earlier accepted invitation’s linked coverage was cancelled, but the unchanged-shift anti-repeat rule incorrectly blocked a new request. Cancelled invitations and accepted invitations with cancelled linked coverage can now be re-invited after fresh eligibility checks; declines/expiry and quotas retain their existing protection. New regression covers cancel→new invitation→accept with old history unchanged and one new pending claim. Full315 tests pass. Browser verified Monday appears and can be selected; left unsent for user review. [Evidence](monday-cancelled-retry.jpg). This supersedes the earlier preserved Monday awaiting-approval preview state. No push/merge.
