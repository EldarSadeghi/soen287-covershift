# CS-014 manager decisions

Issue #29; branch `codex/CS-014-manager-decisions`. Local review only.

Managers use Approvals to approve or reject pending claims. Both actions show the shift, workers and consequences before confirmation, with Keep pending as the initial focused action. Success reloads counts and claims; errors offer refresh guidance. Approval is disabled with a reason when the current snapshot has conflicts; the server always repeats checks during the exclusive transaction.

POST `/api/manager/requests/:id/approve` or `/reject` accepts only `{revision}` from the dashboard. Session role and current business, method, same Origin, JSON, CSRF, fixed query scope and rate limit are required. A SHA-256 revision binds the request and shift. Pending state, future start and original assignment are rechecked for both decisions. Approval also checks an active claimant account and conflicts against assigned shifts and other pending claims, using half-open UTC intervals (adjacency allowed). Approval sets reviewer from session, request approved and shift claimant assignment atomically. Concurrent or stale decisions fail without writing. Repeated approvals cannot transfer twice.

Rejection keeps original assignment, claimant, reviewer and decision timestamp on a rejected record; an atomic fresh open request ID allows coverage to be claimed again. Rejected claims release reserved time. Schema upgrades to v3 on rejection; older data remains readable and unchanged otherwise. Account setup cannot downgrade it. Existing owner/claimant views show rejected/approved outcomes; broader history UI remains CS-015. Both decisions are unavailable once the shift starts; expired pending records remain visible for attention.

## Local review

Isolated fictional data on http://localhost:3008, manager `manager_morgan@example.test`, password `Fictional manager review access!`. Worker `worker_jamie@example.test` uses the same fictional password. Existing user databases are untouched.

Browser checked approval of Morning service, assignment update, rejection of Evening service, and conflict disabling approval after an assignment added since claim. Overnight preparation remains pending for user testing. Use Schedule to verify Morning service assigned to Jamie and Evening service still assigned to Sam. Sign in as Jamie to see approved/rejected claims and the reopened evening request (claim remains conflict blocked). No branch pushed or merged.

Validation: 86 passing tests cover transfer persistence and role views, retained rejection/reclaim, assigned/pending conflicts, adjacency, races, current identity/role/business, disabled claimant, expiry/cancellation, stale revisions, tampered bodies and HTTP protections. Syntax checks pass. Desktop confirmation focus and phone layout checked.

User explicitly approved CS-014 push and merge on 2026-11-17.
