# CS-031D acceptance report

2026-11-22–23 — local feature branch `codex/CS-031D-notifications`, issue #52. Fictional isolated data only. No paid AI calls. Feature awaits user review; not pushed or merged.

| ID | User story / acceptance check | Result and evidence |
| --- | --- | --- |
| US01 | As either role, see a private saved inbox and exact unread count. | PASS: manager/employee browser bell/inbox, 20-record pagination with 32 total unread in automated test, reopen storage read markers. |
| US02 | Receive truthful submission, approval, rejection and pending cancellation alerts. | PASS: manual and automatic service tests; browser automatic pending → manager explicit approval → employee receipt. Original worker gets outcome; no transfer before approval. |
| US03 | Commit alerts with workflow and avoid retries/restart duplicates or upgrade backfill. | PASS: concurrent reconciler, repeated no-op/reconcile, rollback, legacy non-backfill tests; existing periodic matcher test. |
| US04 | Follow the exact request's current state without exposing other accounts/businesses. | PASS: browser History link shows one exact request and current assignment; pending manager history offers Review link. HTTP and service tests deny foreign read markers/cursors and query scope overrides; current expired status derived on read. |
| US05 | Mark a notification or displayed page read, preserving new arrivals. | PASS: scoped/idempotent selected-ID tests, new-arrival remains unread, mixed foreign IDs fail atomically, reopening store retains read state. Browser lost acknowledgement reports uncertainty; Refresh recovers saved Read/0 unread. Origin, JSON, CSRF, no-store and unauthenticated checks pass. |
| US06 | Use the bell without blocking workspace work, on keyboard/mobile and after errors. | PASS within checked scenarios: background badge polling does not replace inbox/form DOM, 320×760 dialog fits (x19..286, document scroll width305 within320); Escape closes and restores bell focus; Shift+Tab from Close wraps to final link; GET503 leaves saved schedule visible and Refresh recovers. Browser sign-out returned to Login with no inbox; cleanup inspected and session security covered by regression suite. Empty Sam inbox and individual manager read action checked in the browser. |

## Checks and evidence

`npm run verify`: **200 tests passed**, zero failures; JavaScript syntax checks pass. Includes 11 new notification tests and existing matching, authentication, CSRF, offboarding and workflow tests. `verification.txt` retains the test output. `employee-approved.png`, `mobile.png`, `load-error.png`, `uncertain-read.png`, and `review-preview.png` show browser checks. A disposable local HTTP proxy injected GET503 and a post-commit lost acknowledgement; no fault hooks added to product code. Mobile viewport reset after checking. These are targeted acceptance checks, not an exhaustive accessibility audit or external delivery test.

## Local review

Preview: `http://localhost:3025/workspace/manager/approvals` for manager; `http://127.0.0.1:3025/workspace/worker/shifts` for employee. Different hostnames isolate role session cookies.

Fictional manager: `manager_morgan@example.test`; employee: `worker_jamie@example.test`. Fictional preview passphrase: `Fictional chat review access!`. Dedicated temp database, separate from the user's desktop account/data. One morning match was approved during verification; another afternoon match is pending so the reviewer can approve/reject it and refresh the employee bell. Historical seed requests intentionally produce no upgrade alerts. The preview does not configure paid AI; existing real-provider chat behavior is outside this increment.

## Limits

In-app polling requires an active visible website; no background operating-system/email/SMS notifications. Polling updates the badge; use Refresh in an open inbox to load new records. Older pages replace the current page; Refresh returns to newest. Notification history is retained without deletion/retention settings in this increment. Existing notifications show dated event text plus current status, so an earlier pending receipt can coexist with a later approval receipt. CS-018 remains the final deployment/submission step.
