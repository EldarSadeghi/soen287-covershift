# CS-015 coverage status and history

Issue #31; branch `codex/CS-015-coverage-history`. Local user review; no push/merge yet.

Both workspaces have History navigation. Managers see their business; workers see only records where they are original worker or claimant. Each record displays its own open/pending/approved/rejected/cancelled outcome, current shift assignment, requesting worker, claimant and reviewer when present, and an oldest-to-newest event timeline. Filter status locally without reloading; Refresh fetches current saved data while retaining the filter. Empty and error/retry states are available. Shift expiry is stated separately from saved coverage status.

GET/HEAD `/api/manager/coverage-history` and `/api/worker/coverage-history` require the corresponding session role and current active account. Service repeats role/business scope; worker participant filtering is server-side. Query filters and mutations are refused; responses are no-store and return safe names/shift/event DTOs without emails, password hashes, tokens, or actor IDs. A worker does not gain access to another claimant’s reopened request simply because they claimed its rejected predecessor.

Events are written only with successful exclusive transactions: requested (original worker), claimed (claimant), approved/rejected (manager), reopened (manager on a fresh request), cancelled (original worker). Failures and races produce no phantom events. Original request identity, claimant and reviewer history survive rejection; the new request has a distinct record and timeline. Per-request events persist in JSON v4; v1–v3 remain readable. Legacy records explicitly lack earlier event details; do not infer claim time from last update or invent past actors. First subsequent mutation keeps the legacy snapshot before the recorded event. User names resolve from current records, so renaming updates displayed names.

## Review

Isolated fictional preview: http://localhost:3009/workspace/manager/history. Manager email `manager_morgan@example.test`; employee `worker_jamie@example.test`; password for these fictional accounts `Fictional history review access!`. This preview does not modify the user’s normal database.

Try All statuses and each filter. Morning service shows requested → claimed → approved, assigned to Jamie. Evening coverage has a rejected claim and a separate reopened request, assigned to Alex. Weekend preparation is pending; Stock delivery was cancelled; Afternoon service is open. Old seed records show the legacy note. Employee Jamie sees the claims they made, including approved/rejected/cancelled outcomes, without unrelated open records. Managers can review new decisions in Approvals then refresh History.

Validation: 92 tests pass, including event persistence/ordering/actors, approval/rejection/reopening/cancellation, reclaim privacy, legacy read immutability/mutation baseline, failed/concurrent event writes, schema actor/time/field checks, role/business/participant HTTP scope and protected history routes. Syntax and diff checks pass. Browser checks cover manager filter/timeline and employee phone layout. User approval is required before push and merge.

User explicitly approved CS-015 push and merge on 2026-11-17.
