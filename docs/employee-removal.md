# CS-019 employee removal

Issue #36, branch `codex/CS-019-employee-removal`, based on merged CS-017 (PR #37). User review only; no push/merge yet. CS-018 Deployment and submission is explicitly the final step.

Team defaults to active employees and provides Active / Inactive / All filters. Employees without shift or coverage/history references can be permanently deleted after confirmation. Deletion removes the employee account and invalidates setup access. Employees with records cannot be deleted; deactivation preserves records and identity for historical views.

Deactivation clears the password hash and setup metadata, records manager/time in schema v5 and blocks new assignments, login, existing protected sessions and setup links. Inactive employees remain in the inactive roster and historical views but not assignment dropdowns or active team counts. No reactivation flow is included; the confirmation states this limitation. Emails of inactive employees remain reserved, preserving unique identity/history.

Current/upcoming assigned shifts (end > now) and pending claims on unended shifts block deactivation. Team lists concrete titles/dates and guidance. Reassign unlinked future work in Schedule. Resolve pending claims in Approvals. Existing CS-010 rules lock coverage-linked shifts even after cancellation: those assignments need an approved coverage transfer or must finish before deactivation. Deactivation does not silently cancel claims or transfer shifts. Expired pending claims do not permanently block offboarding; they remain as historical attention records. Historical names are retained unchanged.

POST `/api/manager/workers/:id/delete` or `/deactivate` accepts only `{revision}`. Manager role/business, method, Origin, JSON, CSRF, fixed query scope and team rate limit apply. Service repeats authorization and all conditions inside the exclusive transaction. Revision hashes the employee, assigned shifts and linked requests/history, so concurrent setup/assignment/claim changes cannot reuse stale confirmation. Delete racing a new assignment yields one safe result; deactivation racing setup completion prevents credential resurrection. Failure leaves storage unchanged.

## Review and validation

`npm run verify`: syntax checks and **108 passing tests**, including seven offboarding tests for deletion/retained history, credentials/session/setup revocation, demo helper non-resurrection, setup-hash race, current/future work and pending claims, stale/concurrent changes, scope/schema tampering and HTTP protections. Diff check passes.

Isolated fictional preview: http://localhost:3012/workspace/manager/team. Manager `manager_morgan@example.test`, password `Fictional employee review access!`. No normal user database is modified. Casey Example has no records and can be deleted; Robin has pending setup; Alex has an upcoming-assignment blocker. Jamie was deactivated in browser QA and appears in Inactive. Sam/Taylor retain historical work and can be deactivated.

Browser checked Delete confirmation and Escape/focus return without submitting the permanent deletion; deletion persistence is verified by automated service tests. Browser confirmed fictional Jamie deactivation, success focus, active count change and inactive filter. Phone reflow and confirmation labels checked. Preview screenshot `/tmp/covershift-cs019-review.png`.

User approval is required before pushing this feature or merging into main.

User explicitly approved CS-019 push and merge on 2026-11-17. CS-018 remains the final step.
