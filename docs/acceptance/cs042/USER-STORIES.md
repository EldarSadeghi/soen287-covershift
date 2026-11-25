# CS-042 Quiet notification panel — local review

Issue #79, branch `codex/CS-042-notification-panel`. User selected Bell panel concept. Todo verified before In Progress. Awaiting review; no push or merge authorized. Deployment is CS-043 / #70, last.

## Acceptance results

- Compact430px desktop native dialog anchors below the bell; full-width mobile panel with sticky header. Desktop and320px screenshots inspected; mobile document305px wide, dialog305×740 within320×740 viewport, no horizontal overflow. Coarse-pointer read controls have44px targets.
- All/Unread filters retain latest request summary even when only an older event is unread. Request/invitation receipts combine using scoped stable group keys; separate requests never merge by title. Today/Earlier uses business timezone. Relative timestamps expose exact dates on hover.
- Approved summaries never imply approval remains pending; employee and manager messages reflect current assignment. Earlier loaded events remain neutral historical descriptions and expandable, preserving individual receipt/read IDs.
- Browser verified history expansion, keyboard filter, per-group read, unread count decrement, shown-read action, caught-up empty state, Escape and return focus to bell. Refresh focus retained after the final focus refinement; background polling updates badge without replacing focused content.
- Local fault proxy committed read status then returned503: panel showed uncertain state, disabled further read/filter changes, and kept Refresh. Refresh reconciled the saved read state and removed the group’s read button. [Evidence](uncertain-read.jpg). No automatic mutation retry. Separate persistent503 GET displayed explicit retry feedback; restored Refresh succeeds.
- Browser request link navigated to protected selected history; manager-specific pending-review/current-approved summaries checked. Manager logout removed the private notification dialog (count0) and returned to sign-in.
- `npm run verify`:322 passed,0 failed. Six new tests cover page merge/deduplication, unread grouped history, distinct keys, timezone-midnight/DST, relative time and current approved metadata/privacy; existing API scope/paging/read-security regressions retained. [Full log](verification.txt). Final focus/touch refinements syntax checked.

## Honest paging/read behavior

Twenty events per API page. Load older appends and deduplicates instead of replacing. Grouping applies to loaded events only; details explicitly say earlier loaded updates. Mark shown as read affects unread IDs of currently shown groups (maximum100 per mutation) and never claims to mark unseen pages. Unread badge remains the account-wide unread event count. All-caught-up in Unread explains when only loaded pages have no unread updates. Refresh restarts the current page; older groups can be loaded again.

## Evidence and limits

[Desktop](desktop.jpg), [mobile](mobile.jpg). Browser checks used existing isolated fictional preview3041; normal accounts, Desktop checkout and provider keys were unchanged. No schema migration or scheduling/approval change. Pagination accumulation is unit tested with real API cursor regressions; this small browser fixture did not contain more than20 events, so the Load older button was not exercised manually. No full assistive-technology certification or live-provider calls.

Local preview http://127.0.0.1:3041/workspace/worker/cover . Click bell. Employee Alex:worker_alex@example.test; fictional password `CoverShift demo access!`. QA marked Alex’s existing updates read; All still shows grouped examples. Temporary fault proxy stopped after checks; normal review server retained.

## Approved completion

User approved merge on 2026-11-24. PR #80 merged, issue #79 closed and board Done verified. Earlier no-approval notes describe the pre-approval state.
