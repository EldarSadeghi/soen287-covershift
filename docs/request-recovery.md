# CS-020: Request recovery and independent Schedule loading

Issue #40. Branch `codex/CS-020-request-recovery`. Local implementation; user approval required before push/merge. CS-018 remains the final step.

## Behavior

- Schedule loads its saved shifts/counts and installs Refresh independently of the create-form worker list. A slow roster only holds the employee selector, not the schedule.
- Every frontend JSON request uses `public/request.js`: one 15-second deadline includes response headers and body parsing. It aborts the client request and rejects even if a transport ignores abort. Late responses cannot resume the old UI operation. It never resubmits automatically.
- A timed-out worker list shows a retry control; retries are single-flight, with focus returned to the worker selector on success or Retry after failure. The Team filter always renders the most recently selected view after its current read completes; Refresh becomes available after failure.
- Network failures, malformed bodies and 5xx mutation responses are treated conservatively: the result may have been saved. Validation/authentication 4xx responses retain normal feedback. CSRF, Origin, server revisions, authorization and coverage policy are unchanged.
- Unknown shift creation keeps title/worker/times, disables repeated submission, and offers **Check saved shifts**. A successful dashboard refresh must precede an explicit **I checked the schedule — allow another attempt** acknowledgement. Check the schedule before permitting another attempt; do not repeat a saved shift.
- An unknown Add worker retains name/email and requires a fresh successful Team read before another submission. Unknown setup-link replacement requires Refresh. Unknown edit/delete/request/cancel/manager-decision/removal keeps its confirmation blocked until a fresh view is loaded; non-destructive dismissal remains available. Claiming always requires a new preflight before a further confirmation.
- Signup and setup give uncertain-result guidance to sign in before submitting again; their unknown submission remains disabled on that page. Login/session/logout now have bounded waits as well. POST setup-details and claim-check are classified as read-only checks, not uncertain mutations.

A client timeout is **not a server rollback or cancellation guarantee**. A save can finish after the timeout or even after a fresh read. No server idempotency ledger or offline queue is introduced. Existing revision and overlap/duplicate checks still apply; reconciliation is a user review step, not proof that an in-flight write cannot later finish. Drafts are retained in page memory, not persisted across navigation/reload or into browser storage. Passwords/setup tokens are not persisted by recovery.

## Verification

Run `npm run verify`. The request-recovery tests exercise deterministic deadlines with ignored abort, stalled response bodies, independent retry/late old success, committed-but-lost saves, malformed responses, 4xx versus 5xx, read-only POST classification, timer cleanup, and real HTTP module/asset loading. Existing server regression suites remain applicable.

Browser QA uses an isolated temporary fictional store and a test-only wrapper, not production routes. The wrapper can delay only one roster GET by 22 seconds or delay a successful shift-save response by 22 seconds. The saved record commits normally; only its response is delayed. Tests must use a separate DATA_DIRECTORY and never reset the owner's normal data.

Acceptance evidence and final check results are recorded below after verification. Actual screen-reader/complete browser conformance is outside this increment.

### Results — 2026-11-18

`npm run verify`: **118 tests pass, 0 fail/skipped**, plus syntax checks; `git diff --check` passes. Ten new tests cover the request deadline/recovery boundary and served module integration, including successful bodyless logout. Browser integration caught the need to change login/signup/setup script tags to modules when introducing their shared import; a served-page regression now checks that integration.

| Browser check | Result |
| --- | --- |
| 22-second delayed roster, first Schedule load | Saved five-shift schedule and summary appear immediately while worker list is loading; Refresh works and retains focus. |
| Worker-list timeout/retry | Error and Retry after the 15-second deadline; healthy retry opens form; successful retry focuses employee selector. |
| Save commits but response delayed 22 seconds | UI reports uncertain result, keeps title/worker/start/end, focuses error, disables submit. After late success arrives the draft remains; exactly one record exists in isolated storage. |
| Check saved shifts | Fresh schedule shows six shifts including the saved record, with explicit acknowledgement required before enabling another attempt. No repeat write was sent. |
| Team delayed roster | After deadline, aria-busy false and Refresh available; unsubmitted name/email and latest inactive filter retained. Fresh retry shows the correct empty inactive view and returns focus to Refresh. |
| Cancel editor while its roster read is pending | Escape returns focus to Edit. After 27.975 seconds, no editor reopened and focus remained on Edit despite late response. |
| 320px Schedule with timeout/retry | Actual viewport 320/document width 305; no horizontal overflow; saved schedule and retry usable. Retry restores selector focus. Viewport reset afterward. |
| Login/logout and employee read | Manager login works; bodyless logout returns to login; employee saved shift view and read-only claim preflight/Escape rechecked. Signup blank-field validation and missing-link setup errors initialize and focus correctly. |

[Independent Schedule screenshot](cs020-evidence/independent-schedule.png) · [Uncertain-save reconciliation](cs020-evidence/uncertain-save.png) · [Phone retry](cs020-evidence/mobile-retry.png).

Preview: http://localhost:3015/workspace/manager/schedule, fictional temporary store `/tmp/covershift-acceptance-CFWyAr`. Fictional manager `manager_morgan@example.test`, employee `worker_jamie@example.test`; test password `Fictional acceptance review access!`. Faults are disabled for user review. The test wrapper and configuration live only under `/tmp`; the product has no fault-injection API.

Not every authentication or coverage action was fault-injected in the browser. All frontend request sites use the tested shared transport; existing HTTP workflow/security tests cover their server behavior. No real account data was seeded, reset or changed. Waiting for explicit user approval before any push/merge.

User explicitly approved CS-020 push and merge on 2026-11-18. CS-018 remains the final step.
