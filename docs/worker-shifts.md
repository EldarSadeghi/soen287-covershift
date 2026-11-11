# CS-006: Worker upcoming shifts

Status: reviewed and approved by the user for push and merge. Issue: https://github.com/EldarSadeghi/soen287-covershift/issues/11

## Local review

Run `npm run dev`, sign in as a worker, and open My shifts. This page now reads persistent records rather than presentation fixtures. Existing signup accounts are managers and cannot access worker-only pages; worker setup remains a later increment. For local testing, use the explicit fictional worker setup documented in [authentication](authentication.md), with your own private `DEMO_PASSWORD`.

The isolated review server on `localhost:3001` uses temporary saved demo data and is separate from normal development data. Its worker preview includes assigned future, in-progress, and overnight shifts. It is left running for user review. Normal project code is available on port 3000; the user's separate Desktop checkout on port 3002 will receive CS-006 only after approval, merge, and pulling main.

The standard seed week is November 12–16, 2026. Completed sample shifts naturally disappear as time passes. A worker with no applicable records sees an empty state; the app never invents shifts to fill it.

## Access and selection

`GET /api/worker/shifts` requires a valid worker session. Identity comes from the session, and the service re-reads the current user and assignments from one validated JSON snapshot. Managers are rejected; the route accepts no user/business/query filters.

Only records with the current worker's ID and business ID are selected. A shift is included while `endsAt > serverNow`, including shifts already underway. A shift ending exactly now is excluded. Results sort by UTC start time, then stable ID for ties. The response contains only shift ID, title, start/end timestamps, derived upcoming/in-progress status, business timezone, and the server snapshot time. It is no-store and does not modify records.

The service uses the storage adapter, keeping JSON operations out of route handlers. Server time is injectable only through the internal app factory for deterministic tests; clients cannot choose it.

## Display

- Dates and times use the business timezone regardless of the browser/machine timezone.
- Start and end times include timezone abbreviations; overnight shifts show the end date explicitly. Repeated clock times during daylight-saving changes show EDT/EST separately.
- Duration uses elapsed UTC time, not the apparent difference between local clock labels. Summary scheduled hours cover the full duration of listed shifts, including elapsed portions of shifts in progress; they are rounded to one decimal in the summary.
- Status and update time reflect the latest server snapshot. Refresh or reload fetches saved changes and current status. There is no background polling that silently keeps sessions active.
- Loading, empty, and retry/error states contain no fake shifts or stale summary cards. A 15-second request timeout allows retry. Expired sessions return to login.
- Titles and other stored strings are inserted with textContent rather than interpreted as HTML.

This is read-only. Shift creation, editing, coverage requests, and claims are separate increments. The public `/demo` remains a separate fictional presentation preview.

## Verification

`npm run check` and `npm test` pass. The suite now has 30 tests, including six new shift groups: assignment/business filtering and ordering; exact end boundaries and empty results; saved changes/current identity; timezone/overnight rendering; DST elapsed duration; and HTTP authentication/role/query/method boundaries.

Browser checks used an isolated data directory. They covered populated current/future/overnight rows, saved updates after Refresh and reload, 390px layout, no-assignment empty state, and retry after temporarily unreadable storage. The isolated file was restored after error testing. No normal local records were changed. The mobile badge layout was adjusted after visual inspection.
