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


## User-approved UI refinement — 2026-11-24

The user selected the interactive mockup and authorized applying it locally, explicitly requesting review before merge. This refines the same CS-031 issue/branch; it is not merge approval. Board moved Your review → In Progress → Your review.

- Manager summary cards, compact initials/name/status/reason roster, local status filters with pressed states and announced matching count, and date/from/until controls implemented. Browsing/filtering adds no API mutations.
- Employee add form and chronological upcoming windows are side by side on desktop. Past/withdrawn history remains accessible. Date badges, explicit withdrawal, same-day/overnight choice and expandable rules preserve the existing policy.
- Browser checks: seeded manager 1 Available/2 Unavailable/1 Unknown; Available filter shows Jamie only; an Available filter for a period with no saved evidence shows an honest empty result; All restores the full roster. Employee explicitly confirmed Dec3 22:00 → Dec4 06:00, then withdrew it and checked retained history.
- Controlled GET503 showed an error and recovered with Refresh. A Dec4 18:00–20:00 save committed upstream while the proxy discarded the response: all mutation controls locked, Refresh recovered one confirmed window without reposting. The proxy was stopped after QA.
- Actual320px viewport checks for both roles show scrollWidth305px. Native date/time inputs are239px wide and stack, preserving complete time values. Manager tablet768px gives scrollWidth753px. Viewport overrides reset. This is browser/layout evidence, not a claim of exhaustive assistive-technology certification.
- `npm run verify`: **285/285 tests pass**, including the new form-mapping/filter test with overnight, leap-day and year-boundary cases. Final accessibility count markup passed syntax and diff checks. Backend/API policy is unchanged by this refinement.

Updated evidence: [manager desktop](manager-refined-desktop.png), [employee desktop](employee-refined-desktop.png), [manager mobile](manager-refined-mobile.png), [employee mobile](employee-refined-mobile.png), [recovered save](refined-recovered-save.png), [verification](refined-verification.txt), [Your review board](board-refined-review.png). Initial screenshots above are retained as the earlier layout, not the latest design.

The isolated3039 preview preserves the earlier fictional records. Jamie now has the original Nov26 window plus the recovered Dec4 window; withdrawn Nov30 and Dec3 windows remain in history. The default Nov26 manager example is unchanged. No push or merge has occurred.


## User-requested coworker access — 2026-11-24 (current scope)

This approved extension supersedes the earlier manager-only visibility scope: coworkers can now query derived statuses, while full windows and private conflict causes remain protected. User requested local implementation, not push/merge.

| ID | Acceptance | Result |
|---|---|---|
| CS031-US11 | As an employee, check active same-business coworkers for a selected period. | PASS: new read-only endpoint, own ID excluded, foreign/inactive peers excluded. Browser as Alex on Nov26 14:00–17:00 shows Jamie Available, Sam Unavailable, Taylor Unknown. |
| CS031-US12 | As an employee, find possible cover without accessing private leave/schedule data. | PASS: API allowlisted id/name/status/generic reasons only. Automated canaries prove no leave note, assigned title, pending-claim/setup cause, email, raw windows or rule details. Browser Sam shows only “Not available for this period”; managers retain “Approved time off”. |
| CS031-US13 | As an employee, browse without making requests or changing any shifts. | PASS: GET only, exact query keys, current-role/session validation, no-store, and exact database byte preservation. Existing final assignment/approval behavior remains unchanged. |
| CS031-US14 | As an employee, use filters, switch views, and recover from an outage. | PASS: Available filter shows Jamie and announces1of3coworkers; My availability retains an unfinished Dec6 form; during confirmation the view buttons are disabled. Coworker deep link loads its selected view. Proxy GET503 shows error; Refresh restores the three statuses. |
| CS031-US15 | As an employee, understand sharing and use the view on mobile. | PASS: own confirmation/save/footer notices explain coworker status visibility. Coworker view has agreement/approval guidance. Actual320px gives scrollWidth305px; viewport reset. |

`npm run verify`: **290/290 tests pass** (five new coworker service/HTTP tests). Final frontend switching/count/deep-link changes passed syntax/diff checks and browser checks. Evidence: [coworker desktop](coworker-desktop.png), [coworker mobile](coworker-mobile.png), [verification](coworker-verification.txt), [review board](board-coworker-review.png).

Review link: http://127.0.0.1:3039/workspace/worker/availability#coworkers — signed in as fictional Alex Morgan (`worker_alex@example.test`, passphrase `CoverShift demo access!`). Select Nov26 14:00–17:00 for one Available, one Unavailable and one Unknown coworker. Morgan's manager session remains at localhost3039. The preserved fictional database was reused, without resetting any normal/demo accounts. The temporary3040 recovery proxy was stopped after QA. No provider call or message was sent. No branch push or merge has occurred.
