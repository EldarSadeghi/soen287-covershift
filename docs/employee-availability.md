# CS-031: Employee availability

Employees use **Availability** in their signed-in workspace to enter dated start/end times, review them, then explicitly confirm. Each window lasts up to 24 local hours and starts in the future within 90 days. Select **Ends next day** for overnight windows. The form derives the next calendar date in the business timezone, including month/year boundaries. Windows can overlap or adjoin; their union can cover a manager's queried period. Employees can withdraw current windows, including a window already in progress. Expired and withdrawn records remain visible for history. Limits: 60 current windows and 1,000 total per employee.

Managers use **Availability** to check a future start/end period (same bounds). Results include active same-business employees only:

- **Available:** confirmed windows in the current business timezone cover the entire period, with no known conflict.
- **Unavailable:** an assigned shift, pending coverage claim, approved leave, or incomplete account setup prevents eligibility.
- **Unknown:** no window, or only partial coverage, establishes availability for the entire period. Missing evidence never promises availability.

Results are fresh snapshots with the checked time and exact queried range. Changing filters removes old results. Refresh repeats the last checked query. Saved windows are advisory: they do not reserve a worker, become a new assignment requirement, activate an automatic rule, claim a shift, or override manager approval. Scheduling actions retain their existing fresh conflict checks.

General availability is separate from the opt-in automatic-request rules managed through AI chat. An automatic rule does not supply general availability evidence, even when active. Withdrawing a general window does not cancel a rule, existing assignment or coverage claim. No new model calls or provider data are added.

The employee and same-business managers can access their full windows. Employees can also use **Coworkers** to see derived free windows for the next 14 days and query statuses for active same-business peers (excluding themselves). The upcoming list shows names and usable intervals only; the exact-period checker shows generic explanations. Neither exposes raw record IDs/history, contact details or the conflict cause. Manager results omit email addresses, private leave notes, shift titles and claim details. Coworker results additionally hide whether unavailability comes from leave, an assignment, a pending claim or account setup. Old-timezone windows remain in employee history but do not establish availability after a business timezone change; withdraw and recreate them in the current timezone.

Confirmation retries use the same submission ID, including after a lost response. An uncertain mutation disables new changes until Refresh checks saved records. No automatic repost occurs. Withdrawal requires a fresh record revision. Employee deactivation withdraws windows and preserves history; availability history prevents hard deletion and changes invalidate stale deletion revisions.

Storage schema 10 adds `availabilityWindows` with id, businessId, workerId, startsAt, endsAt, timezone, submissionId, status (`confirmed`/`withdrawn`), createdAt and updatedAt. Older files remain readable; the first saved window upgrades the file atomically, retaining earlier collections.

Endpoints:

- GET/POST `/api/worker/availability-windows` (own list / confirmed creation)
- POST `/api/worker/availability-windows/:id/withdraw` with revision
- GET `/api/manager/availability-windows?startLocal=...&endLocal=...&timezone=...`
- GET `/api/worker/coworker-availability?startLocal=...&endLocal=...&timezone=...` (derived peer statuses only)
- GET `/api/worker/coworker-windows` (automatic next-14-day free intervals, no query overrides)

All responses are no-store, authenticated and business-scoped; mutations also require same-origin JSON, CSRF and the existing change rate limit. Manager and coworker browsing use only reads, so neither can trigger matching or notifications.

Not included: recurring weekly patterns, explicit unavailable windows, automated scheduling, or chat management of these general windows. Use Time off for a request requiring manager approval. Availability is not a substitute for leave.

## Reviewed UI refinement

Managers have summary cards, a compact employee/status/reason roster and All/Available/Unavailable/Unknown filters. Filters operate locally on the last checked snapshot and announce the matching count; editing dates/times removes stale results and summary cards. Employees have a separate add form and chronological upcoming windows, with date badges and explicitly confirmed withdrawal. Past/withdrawn records remain under expandable history. Detailed policy is under How availability works; timezone, uncertainty and commit feedback remain visible. Fields stack at the narrowest mobile widths to keep native time controls readable.

Employees switch between **My availability** and **Coworkers**. An unfinished own form is retained during ordinary switches; switching is disabled during review, save, or uncertain-result recovery. The Coworkers selection is linked with `#coworkers` and survives a page reload. Ask coworkers for agreement outside this view; a displayed Available status does not reserve them, contact them, claim an opening or approve a transfer. Existing coverage claims and manager approval remain the way to transfer a shift. Confirmation and save notices explicitly describe coworker status visibility.

## Upcoming windows: next 14 days (current display)

Both employee views show the rest of today and the following13 calendar days in the business timezone. The inclusive dates are printed; the server clips intervals from the current instant through exclusive local midnight after the final date. These are calendar days, including weekends. DST, non-hour offsets, month/year changes and skipped local midnight are handled by the server's date-boundary calculation.

**My availability:** confirmed records intersecting the range appear in chronological order. Windows beyond it remain in **Later availability**; expired/withdrawn records remain in history. A record crossing the start/end boundary is clipped visually, without changing the stored record/revision. The card and withdrawal confirmation explicitly say that withdrawal removes the entire original window, including time outside the current view.

**Coworkers:** automatically loads Upcoming windows grouped by coworker. The server unions overlapping/adjacent confirmed general availability in the current timezone, clips it to the14-day horizon, then subtracts assigned shifts, pending claims and approved leave. Incomplete accounts return no usable windows. The response exposes only worker ID/name and derived start/end intervals; no source-window IDs or private reasons. Missing free windows do not imply Unavailable; use the exact-period checker or ask the coworker. The checker remains under **Check availability for a specific shift** and retains its original90-day query bounds.

Refresh updates both lists/checker as applicable. Upcoming-list errors have an explicit retry state and do not prevent the exact-period checker working. No read creates claims, assignments, notifications or matching. Employee consent and manager approval are still needed for a transfer. No recurring pattern or automatic contact is added.
