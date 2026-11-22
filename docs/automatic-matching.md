# CS-031C — Automatic availability matching

Issue [#50](https://github.com/EldarSadeghi/soen287-covershift/issues/50). Local branch `codex/CS-031C-automatic-matching`; no push/merge before explicit user review approval. CS-031B-2 is merged in PR #49. Notifications remain CS-031D; deployment CS-018 remains last.

## Behavior

Confirming an availability rule authorizes automatic coverage requests for eligible existing and newly opened shifts. The employee still reviews the exact window, title and maximum before confirmation. Matching itself makes no paid AI request. It runs after saved application mutations, at normal server startup and every 30 seconds while the server runs. The server must be running; this is not a cloud scheduler.

The earliest confirmed eligible rule wins. Openings are considered by shift start, then opening creation time and ID; rules by server confirmation timestamp and ID. Eligibility requires the same business, active employee account, matching current timezone, active/unexpired rule, full shift containment in its UTC window, optional case-insensitive title substring and remaining capacity. Own coverage, started/closed/claimed openings and assigned/pending-claim overlaps are excluded. Pending requests created earlier in the same sweep immediately reserve time for later checks.

A successful match creates a **pending coverage claim**, records a persistent match and consumes one request from the rule's maximum. The original worker stays assigned until the manager approves through the existing workflow. Rejection reopens coverage and can immediately try the next eligible employee. The same worker is never automatically requested again for the same shift, even through overlapping rules or a fresh opening ID. Manual rejected claims also exclude that worker/shift from automatic matching. Explicit manual requests remain available under their existing checks.

Limits count **successful automatic submissions**, not approvals. Rejected or original-worker-cancelled requests still consume a submission; capacity is not refunded. Merely ineligible checks consume nothing. Pause/cancel prevents future automatic submissions; it does not withdraw pending requests already submitted. Expired or exhausted rules cannot create more requests. There is no automatic assignment, notification or email.

## Atomicity and persistence

`src/availability/matching.js` recomputes current eligibility and uses `claimInDatabase`, the same final eligibility/conflict/history logic as manual claiming. Claim, history, match ledger and rule revision commit under one exclusive JSON-store transaction. There is no read/check/write race or nested transaction. Failures roll back the whole mutation. Manual claims, status changes and periodic reconciliation share the same lock; concurrent runs cannot create duplicate claims or exceed a rule's cap.

`withAvailabilityMatching` wraps application service transactions in `createAppServer`; direct integrations outside the HTTP app must use this adapter or explicitly reconcile. Raw storage/seeding stays separate from business side effects. Normal `src/server.js` reconciles before listening and starts the periodic worker, stopping it on server close. The periodic worker skips overlapping runs and emits only a generic storage-health error on failure, then retries at the next interval. Startup storage failure prevents startup. Reconciliation first probes a detached validated snapshot to avoid rewriting storage when no match is possible; it repeats every decision inside the lock before committing. Probe IDs and changes are never persisted or returned.

Schema v7 adds `availabilityMatches` on first successful match, preserving existing records. Each immutable entry links business, rule, worker, shift and claim request, with canonical timestamps. Validation enforces referential scope, unique worker/shift and request identities, valid claimant and per-rule count. Rule updatedAt changes when a match consumes capacity, invalidating stale rule controls. Successful-match history remains through rejection, cancellation and restart; employee deletion/deactivation retains the earlier protections.

## Employee and manager review

**AI assistant → Saved availability** shows matching enabled, used/remaining requests and each automatic match with exact date/hours and current pending/approved/rejected/cancelled/expired status. **View My requests** is the existing authoritative coverage page. Managers use **Approvals** as before. A save receipt confirms rule persistence; fresh saved availability shows any matches produced by that save. Notifications/bell updates are separate work in CS-031D.

Local preview: [employee](http://127.0.0.1:3024/workspace/worker/shifts), [manager](http://localhost:3024/workspace/manager/approvals). Fictional users `worker_jamie@example.test`, `worker_alex@example.test`, `worker_sam@example.test`, `manager_morgan@example.test`; fictional password `Fictional chat review access!`. It uses a separate temporary database. Jamie's rule was confirmed before Sam's; both cover November26 8AM–10PM with two submissions maximum. The preview demonstrates automatic pending claims, manager rejection falling through to Sam, approval-only transfer and a new coverage opening matching Jamie.

Verification: [acceptance report](acceptance/cs031c/USER-STORIES.md). Scope is a single running Node server and its JSON store, not distributed workers or external database edits. Notifications and deployment remain separate increments.
