# CS-031: Employee availability

Employees use **Availability** in their signed-in workspace to enter dated start/end times, review them, then explicitly confirm. Each window lasts up to 24 local hours and starts in the future within 90 days. Select **Ends next day** for overnight windows. The form derives the next calendar date in the business timezone, including month/year boundaries. Windows can overlap or adjoin; their union can cover a manager's queried period. Employees can withdraw current windows, including a window already in progress. Expired and withdrawn records remain visible for history. Limits: 60 current windows and 1,000 total per employee.

Managers use **Availability** to check a future start/end period (same bounds). Results include active same-business employees only:

- **Available:** confirmed windows in the current business timezone cover the entire period, with no known conflict.
- **Unavailable:** an assigned shift, pending coverage claim, approved leave, or incomplete account setup prevents eligibility.
- **Unknown:** no window, or only partial coverage, establishes availability for the entire period. Missing evidence never promises availability.

Results are fresh snapshots with the checked time and exact queried range. Changing filters removes old results. Refresh repeats the last checked query. Saved windows are advisory: they do not reserve a worker, become a new assignment requirement, activate an automatic rule, claim a shift, or override manager approval. Scheduling actions retain their existing fresh conflict checks.

General availability is separate from the opt-in automatic-request rules managed through AI chat. An automatic rule does not supply general availability evidence, even when active. Withdrawing a general window does not cancel a rule, existing assignment or coverage claim. No new model calls or provider data are added.

Only the employee sees their saved windows; their managers can query derived statuses/reasons. Teammates cannot browse one another's windows. Manager results omit email addresses, private leave notes, shift titles and claim details. Old-timezone windows remain in employee history but do not establish availability after a business timezone change; withdraw and recreate them in the current timezone.

Confirmation retries use the same submission ID, including after a lost response. An uncertain mutation disables new changes until Refresh checks saved records. No automatic repost occurs. Withdrawal requires a fresh record revision. Employee deactivation withdraws windows and preserves history; availability history prevents hard deletion and changes invalidate stale deletion revisions.

Storage schema 10 adds `availabilityWindows` with id, businessId, workerId, startsAt, endsAt, timezone, submissionId, status (`confirmed`/`withdrawn`), createdAt and updatedAt. Older files remain readable; the first saved window upgrades the file atomically, retaining earlier collections.

Endpoints:

- GET/POST `/api/worker/availability-windows` (own list / confirmed creation)
- POST `/api/worker/availability-windows/:id/withdraw` with revision
- GET `/api/manager/availability-windows?startLocal=...&endLocal=...&timezone=...`

All responses are no-store, authenticated and business-scoped; mutations also require same-origin JSON, CSRF and the existing change rate limit. Manager browsing uses only reads, so it cannot trigger matching or notifications.

Not included: recurring weekly patterns, explicit unavailable windows, automated scheduling, or chat management of these general windows. Use Time off for a request requiring manager approval. Availability is not a substitute for leave.

## Reviewed UI refinement

Managers have summary cards, a compact employee/status/reason roster and All/Available/Unavailable/Unknown filters. Filters operate locally on the last checked snapshot and announce the matching count; editing dates/times removes stale results and summary cards. Employees have a separate add form and chronological upcoming windows, with date badges and explicitly confirmed withdrawal. Past/withdrawn records remain under expandable history. Detailed policy is under How availability works; timezone, uncertainty and commit feedback remain visible. Fields stack at the narrowest mobile widths to keep native time controls readable.
