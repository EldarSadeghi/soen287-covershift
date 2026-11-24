# CS-030: Employee time-off requests

Both workspaces now have **Time off** in navigation. The employee requests an absence; a manager reviews it. Neither pending leave nor a request note changes assignments.

## Employee workflow

1. Open Time off. Choose **Full day(s)** or **Specific hours**.
2. Choose dates in the business timezone. Full-day End date is included; specific hours use exact start/end instants, with the next date explicitly selected for overnight leave.
3. Add an optional private note (up to 500 characters). Review the exact dates, note and timezone; **Confirm time-off request** submits a pending request.
4. Refresh to see the manager’s decision. Filter by Pending, Approved, Rejected or Cancelled; expand Request history for actors/times.
5. Before the start, an employee may explicitly cancel their own pending or approved request. Cancellation preserves history and existing shifts/claims. Active availability rules may become eligible to request openings again after cancellation; those still need manager approval.

A request must start in the future within 366 days and last at most 366 local calendar days. Full-day leave for a day already started is rejected; use an exact future partial-day window instead. Nonexistent/repeated local DST times are rejected rather than guessed. Overlapping pending/approved leave is rejected, while adjacent intervals are allowed. At most 20 pending requests per employee; rejected/cancelled outcomes free a pending slot.

## Manager workflow

Open Time off (default filter Pending), inspect the request, private note, history and any blockers, then choose Approve or Reject and confirm. Use All requests to see past decisions.

**Approval is blocked until overlapping assigned shifts and pending coverage claims are resolved.** Blockers link to Schedule or Approvals. Pending leave does not automatically withdraw coverage requests or change work. Reassign/edit an eligible shift through existing controls, obtain coverage through the existing approval workflow, or reject an overlapping pending claim as appropriate. Coverage-linked/started shifts retain their existing editing protections; cancel/reject the leave if the commitments cannot be resolved. The time-off feature provides no override or silent reassignment.

Approving a request blocks new overlapping assignments, assignment edits, explicit coverage claims, automatic matches and coverage approvals through shared fresh server checks. AI manager drafting and existing-opening searches use those same eligibility checks. Drafting an availability rule remains possible during leave, but that rule cannot claim an overlapping shift while leave is approved. Cancelling leave does not cancel or pause availability rules.

Past/started pending requests cannot be approved; managers can reject them to close the pending record. Cancellation by an employee is available only before the start. The original timezone and absolute UTC interval remain saved; existing records are not silently reinterpreted.

## Privacy, history and removal

Only the requesting employee and same-business managers can list the request and its note/history. Another employee or business cannot select the worker using parameters or guessed IDs. Notes do not appear in teammate commitments, AI provider context or coverage notifications. The shared commitment representation is only “Approved time off” and its interval. Time-off status is checked on this page; the existing notification bell continues to deliver coverage notifications, not time-off emails or new leave receipts.

Requests are not physically deleted. Time-off history prevents hard employee deletion. Deactivation revokes employee access and records manager-attributed cancellation of pending/actionable approved leave, preserving notes, prior decisions and timestamps; past approved history remains intact.

## Error recovery

Inputs remain available after known validation errors. Every reviewed submission has an employee-scoped UUID so an identical retry resolves to the same saved request, including after a decision/cancellation; changing details cannot reuse that UUID. Manager decisions/cancellations use opaque revisions derived from current request/commitment state and recheck in the exclusive transaction.

After an uncertain save, the page keeps entries and disables repeat mutations until a successful Refresh reconciles saved status. If the saved submission is found, it displays its current outcome. If not, the employee can explicitly retry the same reviewed submission. Reads do not automatically retry writes. Read failure offers Try again, disables stale mutations, and clears its old error after a successful read. A reload loses the in-memory unsaved note/form; saved requests remain in the list. There is no persistent browser cache of private time-off notes.

## Storage and verification

First submission atomically upgrades legacy v1–8 storage to validated schema9 with `timeOffRequests`; prior records are retained. Dates are canonical UTC, with timezone/full-day display metadata, private note, submission nonce, status, reviewer, immutable creation and chronological actor/status history. Half-open intervals allow work ending exactly when leave starts or beginning exactly when leave ends. See [data model](data-model.md).

Run `npm run verify` and `npm run ai:acceptance`. The expanded offline corpus includes CS029-C19 for leave-aware AI search/draft validation, direct claims, note minimization and cancellation. Those use recorded provider replies, not paid language evaluation. Evidence and browser limitations: [CS-030 acceptance](acceptance/cs030/USER-STORIES.md).

For the current fictional local review, open http://localhost:3037/workspace/manager/time-off as `manager_morgan@example.test` and http://127.0.0.1:3037/workspace/worker/time-off as `worker_jamie@example.test`. Both use the public fictional passphrase `CoverShift demo access!`. This isolated review is separate from your normal account data and requires the running review server; the feature is not merged until approval. The usual application start or demo launcher includes Time off once this increment is merged/pulled. Payroll, leave balances, recurring leave, manager-authored absence and external delivery are outside CS-030. CS-040 remains last.
