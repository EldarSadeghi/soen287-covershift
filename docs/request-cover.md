# CS-040: Request cover

Issue [#75](https://github.com/EldarSadeghi/soen287-covershift/issues/75). Local increment awaiting user review; no push or merge authorized.

## Employee workflow

1. Open Availability → Coworkers and choose Request cover beside a free window.
2. Choose one of your assigned future shifts that fits completely in that window, optionally write a short message, then Review request → Confirm send.
3. The coworker receives an in-app notification and can open Cover requests to explicitly accept or decline. The sender may cancel an unanswered invitation.
4. Acceptance creates or claims the existing coverage request atomically. A manager receives the existing pending-claim notification and approves or rejects through Approvals. The original worker remains assigned until approval.
5. Both participants can follow the invitation and linked coverage outcome in Cover requests; managers can read their business’s invitations. After acceptance, existing My requests controls govern coverage cancellation.

## Rules and limits

- One pending invitation per shift. A pending invitation does not reserve the shift or automatically publish it. An existing public opening stays open; manual or automatic competing claims can win, expiring the invitation.
- Sending is limited to the existing next-14-local-date availability horizon. The coworker must be active, ready to sign in, and in the same business, with confirmed general availability covering the whole shift and no assigned-work, pending-claim or approved-leave conflict.
- Eligibility is rechecked when sending, accepting and approving. Shift edits/deletion, deactivation, availability withdrawal, competing claims or shift start expire invalid unanswered invitations. Periodic reconciliation persists expiry receipts; reads derive current status without writes.
- Declined/expired invitations cannot be repeated to the same coworker for an unchanged shift. Cancelled invitations, including accepted invitations whose linked coverage was cancelled, may be sent again after fresh eligibility checks. Earlier history stays unchanged. A different eligible coworker can be invited once the earlier invitation is terminal. Limit: 20 invitations per rolling 24 hours and 1,000 lifetime records per sender.
- Messages are optional single-line plain text, maximum 500 characters; only participants and business managers may read them. No contact details, private leave reasons or AI provider calls are introduced.
- Accepted invitations follow their linked coverage outcome. Accepted pending claims display Expired after shift start under the existing coverage semantics; a separate new accepted-start expiry notification is not added.

## Recovery and storage

Schema 11 adds strictly scoped `coverInvitations` with immutable shift snapshots and two-event histories, plus `coverNotifications` receipts. Older schemas remain readable; first confirmed send initializes the newer collections atomically. Historical invitations prevent hard deletion of involved employees; deactivation preserves history. Existing JSON transaction locking serializes invitations, claims and manager decisions.

Confirmed sends use an employee-scoped UUID for idempotency. After a lost acknowledgement, Check saved result retrieves the saved invitation before any explicit retry. Uncertain accept/decline/cancel blocks further actions until Refresh reads saved status. No mutation is automatically retried.

Protected routes: GET worker cover-options, GET/POST worker cover-invitations, POST worker cover-invitations/:id/accept|decline|cancel, and GET manager cover-invitations. Existing session, role, origin, CSRF, JSON, exact-field and rate-limit protections apply; revisions reject stale decisions. General availability remains separate from AI automatic-claim rules.

## Local review

Temporary fictional data only, independent of normal accounts and the normal demo. These review processes must remain running:

| Role | Preview | Email |
| --- | --- | --- |
| Alex Morgan, sender employee | http://127.0.0.1:3041/workspace/worker/availability#coworkers | worker_alex@example.test |
| Jamie Lee, recipient employee | http://127.0.0.1:3042/workspace/worker/cover | worker_jamie@example.test |
| Morgan Chen, manager | http://localhost:3041/workspace/manager/approvals | manager_morgan@example.test |

Fictional password for all three: `CoverShift demo access!`. Hostnames/ports keep these sessions separate. Try Jamie’s December 3 window to send a fresh invitation; Monday November 30 was cancelled during user review and is now ready to request again. The initial November 26 example was approved; December 1 declined and December 2 cancelled.

Validation: [acceptance report](acceptance/cs040/USER-STORIES.md).

If a compatible shift was previously declined, the composer explains that decision and links to the declined invitation. General availability does not override a coworker’s decision about a particular shift.
