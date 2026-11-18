# CS-022: Expired coverage handling

Issue #42; local branch `codex/CS-022-expired-coverage`. Ready for user review; no push or merge approved. CS-021 remains an unstarted suggestion for possible future consideration. CS-018 Deployment and submission remains the final step.

## User behavior

- A saved **Open** request or **Pending approval** claim displays **Expired** when its shift starts, including while the shift is in progress. A future request stays Open/Pending. Approved, Rejected and Cancelled outcomes retain their names even after the shift ends.
- Manager Overview and Approvals count/list only pending claims whose shifts have not started. A separate **Expired coverage** section counts unresolved expired open/pending records and links to **History → Expired**. Expired records do not have approval/rejection controls.
- Both roles can filter History by Expired. The filter is in the URL (`?status=expired`) and survives refresh/reload. Pending/Open filters exclude expired records. An empty selection has the existing honest empty state.
- History shows the expiry time in the business timezone, the original saved status and original timeline. Worker My requests also labels expired owned requests and claims clearly, rather than saying the claim still awaits approval. Existing cancellation eligibility remains enforced.

## Data and permissions

Expiry is a **derived display state**, not a saved decision or a new stored workflow status. API history/request DTOs keep `status` and add `displayStatus` and nullable `expiredAt` (the shift start). Manager summary adds `expiredCoverage`; `pendingClaims` now excludes expired claims. Counts are per business. Worker history remains participant-only.

No database migration, background job or expiry history event is added. Reading changes no stored status, timestamps, actors, assignment, reviewer or legacy record. A saved legacy pending record remains pending in JSON; the current view labels it Expired and explicitly shows its saved status. This does not retroactively approve, reject, cancel or transfer a shift. Later legitimate coverage records on a shift remain separate history entries.

UTC instants determine expiry with `startsAt <= now`; no browser-local clock strings or end-of-day assumptions. Overnight and daylight-saving transitions use the same start instant. Refresh fetches a new server-clock snapshot; an already-open page does not automatically tick or update itself at the boundary. Each page says Refresh to check for changes. Existing server guards continue to reject claims/decisions/cancellation after start, even if the browser loaded the request just before it expired.

Existing conservative shift editing/offboarding/conflict policies are unchanged. For example, an in-progress assignment still blocks employee deactivation, and pending-claim commitments on unended shifts retain the prior conflict policy. This increment organizes the expired coverage view; it does not add administrative cleanup or rewrite historical records. Assignment changes require the existing permitted workflows.

## Verification

`npm run verify`: **125 tests passed, zero failed/skipped**, plus syntax checks. Seven new expiry tests cover:

- Exact millisecond before/at/after start; ongoing/ended, overnight and repeated daylight-saving instants; all three terminal outcomes stay terminal.
- Actionable approval counts versus expired open/pending history, including scoped counts and legacy compatibility.
- Owner/claimant views, no cancellation/transfer, participant-only history and open-board exclusion.
- Fresh expired approval/rejection/cancellation/claim attempts rejected without byte changes or assignment changes.
- Recorded actors/times/statuses preserved, with no invented expiry event; approved assignment/timeline retained.
- HTTP refresh across the boundary using a controlled server clock; no-store, role/business/participant boundaries, rejected API query scope and authorized History deep links.

The existing manager-dashboard test requiring ended pending claims to stay in the actionable queue was updated to the new accepted CS-022 behavior; other suites pass. Tests use temporary stores; real user data is untouched. `git diff --check` passes.

## Browser acceptance — 2026-11-18

Fictional isolated preview: http://localhost:3016/workspace/manager/approvals. Temporary data `/tmp/covershift-cs022-qa.DBsyZ7`; manager `manager_morgan@example.test`, original worker `worker_alex@example.test`, claimant `worker_taylor@example.test`; fictional password `Fictional expired coverage review!`.

| Scenario | Observed |
| --- | --- |
| Manager Overview/Approvals with future + expired data | One future pending claim in count/actions; two expired open/pending records in a separate History link/count. |
| Expired link | Opens manager History with Expired selected; 2 of 5 records, original owner/claimant and saved legacy status shown, assignment retained. |
| Pending / Approved filters | Pending shows only one future claim. Approved shows completed approved coverage assigned to Taylor, rather than Expired. |
| Rejected filter with no matching record | Clear 0 of 5 empty state. |
| Expired reload and Refresh | Filter retained through reload; Refresh updates data and keeps focus on Refresh. |
| Original worker My requests | Expired request has no cancellation action; future pending request still offers cancellation; completed approval retains its outcome. |
| Worker claimant My requests and History | Expired claim identified separately from completed Approved claim; expired filter contains only Taylor's one expired participation. |
| 320px manager Expired history | Actual viewport width 320 and document width 305; readable wrapped notes, filter and timeline; no horizontal overflow. Override reset. |

[Approvals](cs022-evidence/approvals.png) · [Expired history](cs022-evidence/history.png) · [Worker history](cs022-evidence/worker.png) · [Phone view](cs022-evidence/mobile.png).

The preview uses one-time QA fixtures to demonstrate this feature; no reusable CS-021 demo generator was implemented. Broad screen-reader/zoom conformance remains outside this task. Explicit user approval is required before any feature branch push or merge.

User explicitly approved CS-022 push and merge on 2026-11-18. CS-021 remains an unstarted suggestion; CS-018 remains the final step.
