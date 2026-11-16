# CS-012: Open-shift board

Issue: https://github.com/EldarSadeghi/soen287-covershift/issues/25
Branch: `codex/CS-012-open-shift-board`. Status: user approved push and merge on 2026-11-16.

Workers open Open shifts to browse future open coverage requests from teammates in their signed-in business. Cards show the title, business-timezone date/time, actual duration (including overnight dates), and requesting worker’s name. Requests are ordered by start timestamp then request ID for stable ties. The board displays a count and refresh time, and explains that the original worker remains assigned until approval.

The board excludes the viewer’s own requests, shifts starting at or before the current server time, and pending, approved or cancelled requests. Open records must have no claimant or reviewer and must still reference the original worker’s assignment in the same business. Cross-business and missing/inconsistent references are not exposed. The server reads identity, membership, shifts and requests from one validated JSON snapshot. Board reads do not write, expire, claim or transfer anything.

`GET /api/worker/open-shifts` requires an active worker session. HEAD is supported; mutations return 405. Query selectors are rejected rather than used to select a business, worker or status. Responses are no-store and whitelist only request ID/status, original worker name, safe shift fields, business timezone and read timestamp. No emails, account hashes, setup tokens, claimant/reviewer IDs or private business records are returned.

Refresh re-evaluates current saved data and exact shift-start eligibility. New requests appear and cancellations or pending claims disappear on the next load/refresh. There is no automatic polling. An already open page may become stale; this increment has no claiming action. CS-013 will add immediate schedule-conflict feedback and atomic claiming with server-side eligibility rechecks. The board does not filter schedule overlaps yet and does not imply that listed shifts can already be claimed.

The UI includes loading, an honest empty state with a My requests link, timeout/error/retry handling, labelled Refresh, safe text rendering, and a responsive layout. Basic role navigation is now fully routed without the obsolete Open shifts placeholder.

Review: use the local fictional worker Jamie at port 3006. Morning coverage from Alex and Overnight preparation from Sam are visible. Jamie’s own request, a pending claim and cancelled/expired examples are saved but excluded. Check earliest-first order and overnight end date. Claiming is explicitly marked as coming soon. No real business data was modified for the preview.

Verification: 71 passing tests, JavaScript syntax and diff checks. Five added tests cover scope/status/ownership filters, stable ordering, private-field omission, non-mutating reads, exact expiry boundaries, honest empty results, refresh after cancellation/claim, current account membership, and HTTP session/role/query/method protections. Browser verified populated and empty boards, cancellation/new-request refresh, simulated service failure and retry recovery, and a 390px mobile layout without horizontal overflow. All review data changes used isolated fictional data and retained cancelled request history.
