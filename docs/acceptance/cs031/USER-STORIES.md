# CS-031 acceptance report — 2026-11-24

Issue [#67](https://github.com/EldarSadeghi/soen287-covershift/issues/67). Branch `codex/CS-031-employee-availability`. User selected separate general availability windows. Local review only; push/merge awaits explicit approval.

| ID | User story / acceptance | Result and evidence |
|---|---|---|
| CS031-US01 | As an employee, share a dated window after reviewing and explicitly confirming it. | PASS: browser review locked the form, Confirm saved the window and announced completion; automated strict input, overnight/DST and bounds checks. |
| CS031-US02 | As an employee, withdraw a current window without altering shifts or automatic rules. | PASS: browser explicit withdrawal and retained Withdrawn record; scoped revision tests and unchanged coverage checks. |
| CS031-US03 | As a manager, see Available only when saved windows fully cover my selected period. | PASS: Nov26 14:00–17:00 Toronto showed Jamie Available. Tests cover adjacent union, partial coverage, gaps and old-timezone windows. |
| CS031-US04 | As a manager, see Unavailable for assigned work, pending claims, approved leave or incomplete setup. | PASS: browser Alex Assigned shift, Sam Approved time off. Automated pending-claim and incomplete-setup cases; half-open adjacent periods do not conflict. |
| CS031-US05 | As a manager, see Unknown when no complete evidence exists. | PASS: browser Taylor Unknown, plus partial/no-evidence tests. Automatic claim rules alone never count as general evidence. |
| CS031-US06 | As a user, keep my business/account data private and avoid unexpected actions. | PASS: role/business/own-record tests; no leave-note/email/shift-title leakage. Manager reads preserve exact file bytes. HTTP window saves cannot trigger an existing eligible automatic rule. |
| CS031-US07 | As a user, recover honestly from an outage or uncertain save. | PASS: controlled browser GET503 showed error/Refresh; retry restored empty list. Proxy forwarded a confirmed save, then discarded its acknowledgement: UI blocked new mutations, Refresh recovered one Confirmed window without reposting. Concurrent same-ID service test also retains one record. |
| CS031-US08 | As a manager, know when results were checked and avoid stale results after changing filters. | PASS: exact queried range + checked time displayed; changing an end filter cleared prior statuses and asked to check again. Automated subsequent reads reflect withdrawal immediately. |
| CS031-US09 | As a mobile/keyboard user, operate labelled controls and readable status cards. | PASS: both roles checked at actual320px; document scrollWidth305px. Labels, native inputs/buttons, confirmation focus and status/alert announcements checked. Temporary viewport overrides reset. |
| CS031-US10 | As a manager, deactivate employees without deleting availability history or retaining actionable windows. | PASS: automated history prevents deletion, invalidates stale removal revisions and deactivation withdraws windows/excludes inactive employee. |

## Verification

`npm run verify`: JavaScript syntax checks and **284/284 tests pass** (16 new availability tests). The full suite includes the existing 19 offline AI scenarios. These validate deterministic recorded-provider workflows; this increment does not change AI prompts/models, and no live provider quality claim is made.

Evidence: [verification log](verification.txt), [manager desktop](manager-desktop.png), [employee desktop](employee-desktop.png), [manager mobile](manager-mobile.png), [employee mobile](employee-mobile.png), [recovered save](recovered-save.png).

Browser tests used only a fresh temporary fictional database (`/tmp/covershift-cs031-review-LkAEca`), served at3039; controlled outage/lost-response proxy at3040 was test infrastructure outside the product and stopped after checks. No normal account file, previous demo run or API key was modified. The final review server was restarted on the final backend while preserving these fictional records. Private provider configuration is not loaded in this isolated availability preview.

## Local review

- Manager: http://localhost:3039/workspace/manager/availability
- Employee: http://127.0.0.1:3039/workspace/worker/availability
- If asked to sign in: `manager_morgan@example.test` / `worker_jamie@example.test`; fictional passphrase `CoverShift demo access!`.
- Manager period: **November26,2026 14:00–17:00**, timezone America/Toronto. Expected initial results: Jamie Available, Alex Unavailable (assigned), Sam Unavailable (approved leave), Taylor Unknown. Taylor has a separate confirmed Dec1 window used for recovery QA, so remains Unknown for Nov26.
- Jamie also has a withdrawn Nov30 example from the browser test. Save a fresh period, check it as manager, then withdraw and Refresh to see the derived result change.

## Limits

Dated positive windows only; no weekly recurring patterns or explicit unavailable windows. Availability is advisory and does not promise an eventual assignment. Existing scheduling actions still recheck conflicts at commit time. General windows are independent from automatic request rules; withdrawing one does not withdraw another rule or an already-submitted claim. See [policy](../../employee-availability.md).
