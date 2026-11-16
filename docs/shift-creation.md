# CS-009: Manager shift creation and assignment

Issue: https://github.com/EldarSadeghi/soen287-covershift/issues/19
Branch: `codex/CS-009-shift-creation`. Status: user approved push and merge on 2026-11-16.

Open Schedule as a manager. Enter a title (1–100 characters), select a worker, and choose start/end dates and times. All entered times use the signed-in business’s IANA timezone, even when the browser or server uses another timezone. For overnight shifts, explicitly choose the following day as the end date. Dates from 2000 through 2099 are supported and the shift must start in the future. Workers whose account setup is pending can be assigned; they see the saved shifts once their login is ready.

The server converts business-local times to canonical UTC, validates dates through a round trip, and rejects daylight-saving gaps and repeated/ambiguous local times with an actionable message. Selecting an unambiguous time is required; this increment does not provide earlier/later offset selection. Shifts spanning a clock change use actual elapsed duration.

`POST /api/manager/shifts` accepts exactly `title`, `assignedWorkerId`, `startLocal` and `endLocal`. A current manager session, exact Origin, JSON content type and session CSRF token are required. Query selectors and client-supplied business/role/UTC fields are rejected. The business is selected from the stored manager account. Inside one exclusive storage transaction, the service rechecks authorization, timezone, worker membership, future start, end ordering, and conflicts before saving. Two shifts for the same worker may touch at an endpoint but cannot overlap; simultaneous overlapping submissions yield one success and one conflict. Other workers may work concurrently. No schema migration is needed.

The manager schedule and counts refresh after success. The assigned worker sees the shift through My shifts and Refresh; there is no push notification or automatic refresh in another open tab. Failed submissions retain entries. If the network response is lost, the form asks the manager to refresh the schedule before retrying; the overlap guard prevents duplicating the same assignment.

Review: create a future daytime shift, check its saved card/count, then sign in as the assigned worker in another browser and check My shifts. Create an overnight shift with the next-day end date. Try overlapping times for the same worker, an end before start, or a past start. New businesses without workers show an Add workers link. Editing and deletion remain CS-010.

Verification: JavaScript syntax checks and 50 passing Node tests, including timezone/DST/fractional-offset cases, calendar validation, persisted manager/worker views, same-business assignments, concurrent overlap prevention, and HTTP protections. Browser checks confirmed creation, persisted reload, worker visibility, overlap feedback retaining values, keyboard return to the form, and a 390-pixel mobile layout without horizontal overflow.
