# CS-007: Manager dashboard and milestone walkthrough

Status: reviewed and approved by the user for push and merge. Issue: https://github.com/EldarSadeghi/soen287-covershift/issues/13

## Review locally

Run `npm run dev`, sign in as a manager, and open Overview, Schedule, and Approvals. The isolated manager preview at http://localhost:3001/workspace/manager/overview is left running in Chrome for review with fictional saved data. Normal local records and the separate Desktop checkout were not changed by QA.

The overview shows worker count, current/upcoming assigned shifts, and pending coverage claims for the signed-in manager's business. It previews the first three sorted shifts/claims and links to their complete read-only pages. Counts cover all records in each category. New businesses honestly show zero counts and empty panels.

Schedule lists saved current/future shifts with assigned worker names. Approvals lists every pending claim, its original worker, claimant, shift time, and status. Claims for shifts already underway or ended remain visible with a warning. Approval and rejection buttons are disabled and labeled Coming soon: no approval endpoint or assignment mutation is implemented in CS-007.

## Data and access

`GET /api/manager/dashboard` requires a manager session, accepts no query filters, and derives business identity from the current stored manager. The service reads one validated JSON snapshot, joins only workers/shifts/requests belonging to that business, and returns selected display fields without emails or password hashes. Workers, anonymous users, and caller-selected business IDs cannot access or redirect the data scope.

Current/upcoming shifts use `endsAt > serverNow` and sort by start time then ID. Pending claims include only status pending, sort by shift start then request ID, and retain completed-shift warnings rather than silently disappearing. Reading the endpoint never changes data. It uses no-store caching and the existing authenticated session protections.

Dates use the business timezone and the shared CS-006 formatter, including overnight dates and daylight-saving abbreviations. Both roles now share a safe shift-card renderer; stored text is inserted using textContent. Refresh/reload reads saved changes. Loading, empty, and error/retry states do not display fake or stale records. Requests time out after 15 seconds and expired sessions return to login.

## Milestone walkthrough

This checks the proposal's planned milestone scope; the separate official instructor rubric has not been supplied or verified.

| Step | Action | Expected result |
| --- | --- | --- |
| 1 | Open /signup and create a manager/business | Account and business are saved together; confirmation links to login. |
| 2 | Sign in with that account | Own business identity appears; new business has empty saved-data panels. |
| 3 | Open manager Overview, Schedule, Approvals, Team | All four pages are reachable; Team clearly says management is coming soon. |
| 4 | Use explicit local demo account setup in authentication.md | Fictional manager and worker can sign in; existing credentials are never reset. |
| 5 | Sign in as the fictional manager | Dashboard/schedule show that business's saved assignments; pending claims show original worker and claimant. |
| 6 | Inspect Approvals | Buttons are disabled and labeled; reading claims does not change assignments. |
| 7 | Refresh, then sign out | Saved changes reload; logout invalidates access to protected pages. |
| 8 | Sign in as the fictional worker | My shifts shows only their assigned current/upcoming shifts. |
| 9 | Open worker Open shifts and My requests | Both pages are reachable and clearly label their upcoming workflows. |
| 10 | Try a manager page as the worker | Server returns 403; a demo role switch does not grant access. |
| 11 | Sign out and visit a protected page | Redirect to login; public /demo remains separate presentation content. |

For a recorded demo, use fictional data and check the current date: seed shifts are fixed to November 12–16, 2026 and completed records naturally leave the schedule. The isolated browser QA fixture also includes a current shift, an overnight shift, and a pending claim on an ended shift. Any additional test records remain outside the tracked project data.

## Verification

`npm run check`, `git diff --check`, and all 36 automated tests pass. The six new manager/walkthrough test groups cover safe joined data and read-only behavior, actual cross-business isolation, completed-shift/pending-claim boundaries, empty businesses/current roles, HTTP role/query/mutation restrictions, and the signup/login/both-role/logout milestone walkthrough.

Browser verification completed November 13, 2026: desktop and 390px layouts; all four manager and three worker routes; complete schedule; pending participants and disabled controls; saved updates after Refresh/reload; empty panels; retry after deliberately unreadable isolated storage; recovery after restoring it; and worker denial from manager pages. The shared shift-card worker regression also passed. Normal development records were untouched. The fixture was restored and the manager overview left open for user approval.
