# CoverShift acceptance review — 2026-11-18

## Decision for the owner

The core scheduling and coverage workflow passes the automated regression suite and the browser scenarios exercised in this review. **108 tests passed, none failed or skipped; syntax checks passed; 24 additional public-page, asset and private-path HTTP checks passed.** This is not an unconditional acceptance of every requirement: a delayed-response browser test exposed a recovery defect, and collaboration and complete assistive-technology/zoom verification remain incomplete.

Recommended next increment: **proposed CS-020, bounded request recovery and independent Schedule loading**. Review the proposed backlog below before implementation. At completion of the audit, no application code, real account data, GitHub issues or board statuses had been changed, and no branch had been pushed or merged. The owner subsequently approved publishing this documentation and its supporting evidence. All proposed IDs are reservations in this report, not started GitHub tasks. **CS-018 Deployment and submission remains the very last step.**

## Scope and evidence rules

- Baseline: local `main`, commit `0043def050c1edc85b0a72fd78531219dd3a1fc0` (CS-019 merge PR #38), Node **v24.21.0**, macOS, in-app browser. These results apply to that commit, not future changes.
- Read GitHub's closed issues and merged PRs directly. Reviewed **18 merged implementation issues: CS-001–CS-017 and CS-019**. Closed issues #15/#16 are duplicate CS-008 stubs, not additional implementations. CS-018 is unimplemented and excluded.
- Original issue checklists are preserved in [the GitHub snapshot](evidence/github-issues-and-merges.json); [the criterion register](CRITERIA.md) gives each checklist item an acceptance-test ID and evidence route. A checked box on GitHub is historical acceptance, not proof of a new test execution.
- Fresh automation: `npm run verify`, all 15 test files, including real HTTP listeners, isolated stores, rejection paths and races. First sandbox attempt could not bind loopback ports (`EPERM`); reran with local-listener permission and succeeded. Environment denial is not counted as an application failure. [Full successful transcript](evidence/verify.log).
- Fresh browser checks: normal service on port 3013; separate fault-injection wrapper on 3014 delayed only roster GET by 45 seconds. Both used fictional temporary data. Real/root/Desktop databases were untouched. Browser fixture shifts were deliberately moved into the future; the original seed was tested separately, unchanged.
- Source review supplements automation for frontend error paths, current documentation, assignment locks, deactivation and deployment limits. Earlier browser evidence in the merged task documents is identified as historical; it was not all repeated here.
- “Pass in scope” means the described checks passed. It does not certify every device/browser, a full penetration test, WCAG conformance, teammate access, production hosting or instructor grading.

## Issue-by-issue results

| Task / issue / merged PR | Acceptance scenarios and evidence | Assessment |
| --- | --- | --- |
| CS-001 / #2 / #1 | README launch with Node 24; server starts using temporary storage; expected folders/environment example/ignore rules present; public pages 200, private/unknown paths 404. Review/merge trace verified. | Technical foundation passes. Broader teammate onboarding/protection checks still unverified (F-07). |
| CS-002 / #3 / #4 | Current manager/worker navigation reached in browser; labels and role banner distinct; demo serves separately. 320px populated manager Schedule and employee requests have no horizontal overflow and 44px navigation targets. Historical seven-screen demo navigation recorded in #3. | Pass in checked routes/widths; exhaustive demo/browser matrix not freshly repeated. |
| CS-003 / #5 / #6 | `storage.test.js`: restart in fresh process, seed non-overwrite, shared-store concurrency, rollback, lock refusal, complete reads, scoped detached records, corrupt/invalid reference refusal. Private runtime/source files return 404. | Pass. Seed usefulness now limited by dates (F-02); storage itself preserves records correctly. |
| CS-004 / #7 / #8 | `signup.test.js`: valid business + salted hash; invalid/forged identities, duplicate races and hashing failure leave no partial records; HTTP guards and throttling. Signup page/assets freshly return 200. | Automated acceptance passes; successful signup UI remains historical evidence. |
| CS-005 / #9 / #10 | `auth.test.js` + security HTTP suite: password checks, generic rejection, rotation, idle/absolute expiry, logout, current membership/business checks, CSRF and HTTPS cookies. Fresh browser manager/employee login and manager logout. | Pass in checked security/role flows; memory sessions deliberately reset on restart. |
| CS-006 / #11 / #12 | `worker-shifts.test.js`: owner/business filtering, exact end boundary, ordering, timezone/overnight/DST; fresh browser employee sees only Jamie's four assignments including new overnight shift. | Pass. Full refresh/error mobile combinations have historical and automated, rather than all-new browser, evidence. |
| CS-007 / #13 / #14 | `manager-dashboard.test.js`: scoped sorted schedule, pending participants/counts, empty and both-role walkthrough. Browser overview shows five initial shifts/one claim, then six shifts and zero pending after approval. | Normal behavior passes; Schedule dependency failure found when CS-009 worker list stalls (F-01). |
| CS-008 / #17 / #18 | `workers.test.js`: manager-scoped add/roster, duplicate race, single-use/expiry/replacement, post-hash rechecks, role/CSRF/Origin. Browser roster and setup-status labels verified. | Core onboarding passes; roster loading has no bounded recovery (F-01). New worker password entry was not repeated in browser. |
| CS-009 / #19 / #20 | `create-shift.test.js`: persistence/worker visibility, valid overnight and adjacency, calendar/DST/overlap/foreign input rejection and concurrency. Browser blank submission focuses associated errors; 22:00–06:00 creates an eight-hour saved shift visible to Jamie. | Normal create acceptance passes; delayed worker-list GET blocks the entire initial saved Schedule (F-01). |
| CS-010 / #21 / #22 | `manage-shift.test.js`: edit/reassignment/delete persistence, every linked status locked, started/stale/overlap/race/guard rejection. Browser prefilled overnight editor and Escape focus return. | Tested service behavior passes. Source shows unbounded roster and write fetches; robustness follow-up F-01. Cancelled history locks remain deliberate (F-06). |
| CS-011 / #23 / #24 | `coverage.test.js`: own future shift request, cancellation retains assignment/claimant, fresh re-request, duplicates/races/exact start/closed state denied. Browser requests overnight coverage then cancels; both confirmations default to Keep as is and success receives focus. | Pass. No assignment transfer on request/cancel. |
| CS-012 / #25 / #26 | `open-shifts.test.js`: business/owner/status/start exclusions, ordering, exact expiry, refresh and read-only persistence. Browser eligible Sam request visible; own cancelled and approved teammate request absent; successful claim produces honest empty board. | Pass. Historical read-only/no-claim criterion was intentionally superseded by CS-013. |
| CS-013 / #27 / #28 | `claim.test.js`: immediate shared conflict calculation, independent preflight/final check, concurrent claims/overlap reservations/adjacency, stale and unauthorized rejection. Browser fresh no-conflict preflight, Keep browsing focus, confirmation and pending My requests record. | Pass. Assignment stays with Sam pending approval. Conflict/race cases freshly automated, not all manually repeated. |
| CS-014 / #29 / #30 | `review.test.js` + complete HTTP lifecycle: exact-once approval, rejection/reopening, concurrent decisions, stale/conflicting/inactive claimant checks. Fresh browser approves Taylor, reduces pending count, and History shows Taylor assigned with manager actor/time. | Pass for future claims. Expired pending queue has no resolution path by current policy (F-03). |
| CS-015 / #31 / #32 | `history.test.js`: ordered durable actor/time, distinct rejected/reopened/cancelled records, no phantom events, scoped participant/business and legacy honesty. Browser manager filter empty result and employee history containing only their two participant records. | Pass. Event names resolve current people, not immutable name snapshots; legacy missing details explicitly labeled. |
| CS-016 / #33 / #34 | `security-workflow.test.js` nine HTTP tests: complete lifecycle; foreign/tampered IDs; claims/decision races; late conflicts; guard matrix; malformed/oversized/private-path errors; session revocation; origin/HTTPS; throttling. Existing source review reconciled with CS-019. | Pass within tested threat cases. Not a production penetration test; backup/TLS/hosting remain CS-018. |
| CS-017 / #35 / #37 | Fresh browser focused login errors, create field associations, edit/deactivate Escape return, safe confirmation focus, focused success and both-role 320px reflow. Historical long-content/390px and contrast evidence in accessibility-review.md. | Partial verification: no full screen-reader, actual browser zoom/text-spacing, forced-colors or multiple-device session in this audit (F-05). |
| CS-019 / #36 / #38 | `offboarding.test.js`: unused deletion, retained history, login/session/setup revocation and setup race, future assignment/claim blockers, scope/revision/races/schema. Browser blockers and no Delete for referenced workers; eligible Alex confirmation and Escape focus return. | Pass in tested scope. Actual browser removal not repeated; deletion/deactivation persist/revoke assertions run in automation. Reactivation is absent by explicit design (F-08). |

## Fresh browser scenario log

| Test ID | Steps / expected result | Observed |
| --- | --- | --- |
| B-01 | Submit empty login; summary gets focus and names missing fields. | Pass: focused `login-errors`, email/password messages. |
| B-02 | Sign in Morgan; role-specific overview and stored summary. | Pass: manager navigation, 4 workers, 5 shifts, 1 pending claim. |
| B-03 | Submit blank shift form. | Pass: focused `create-feedback`; title, worker, start/end marked invalid with associated errors/timezone. |
| B-04 | Create Acceptance overnight, Jamie, Dec 2 22:00–Dec 3 06:00 Toronto. | Pass: count becomes 6; eight hours; employee later sees same dates. |
| B-05 | Open new shift editor then Escape. | Pass: persisted values prefilled, Escape closes and focuses Edit trigger. No edit submitted. |
| B-06 | Approve seeded future Taylor claim. | Pass: Keep pending initially focused; confirmation transfers once, pending becomes zero, success focused, History actor Morgan/current worker Taylor. |
| B-07 | Filter manager History to Rejected with none present. | Pass: 0 of 2 and explicit choose-another-status empty state. |
| B-08 | Inspect Team; attempt eligible Alex deactivation then Escape. | Pass: Jamie/Sam/Taylor disabled with concrete blockers, referenced employees have no Delete; confirmation identifies consequences and returns focus. No deactivation submitted. |
| B-09 | Logout manager, sign in Jamie. | Pass: login after logout; worker navigation and only Jamie's four assignments. |
| B-10 | Jamie requests then cancels Acceptance overnight. | Pass: confirmations focus Keep as is; open then cancelled record saved, Jamie remains assigned, success focused. |
| B-11 | Jamie preflights then claims Sam's Morning coverage. | Pass: no-conflict check, safe default, pending claim visible in My requests; Sam remains assigned; eligible board empty. |
| B-12 | Inspect Jamie History. | Pass: cancelled own request and pending own claim; unrelated approved Alex/Taylor record absent; legacy source explicitly disclosed. |
| B-13 | Employee My requests at 320×800. | Pass: actual viewport 320, document width 305, all four navigation targets 44px; no horizontal overflow. |
| B-14 | Populated manager Schedule at 320×800. | Pass: actual viewport 320, document width 305; five navigation targets 44px, input widths 223px/font 16px. Viewport overrides reset afterward. |
| B-15 | Delay roster GET 45 seconds, open Team. | **Recovery gap**: at 23.577 seconds still Loading your team, aria-busy true, Refresh disabled; no retry yet. |
| B-16 | Open Schedule while same roster endpoint delayed. | **Dependency defect**: worker form loading, saved schedule blank and Refresh listener not yet installed; healthy dashboard is held behind worker list. Source confirms awaited mount before initial load/listener. |

Only the normal server remains as a preview at http://localhost:3013/workspace/manager/schedule. Temporary credentials and launch/reproduction steps are in [REPRODUCE.md](REPRODUCE.md). Normal preview data is fictional, not the user's business data.

## Findings and proposed tasks

Priorities: P1 = address before release; P2 = worthwhile next improvement/verification; P3 = optional product scope. “Source-confirmed” and “observed” are distinguished below. No security bypass, orphaned record or incorrect coverage transfer was found in the exercised cases.

### F-01 — Observed: delayed roster blocks recovery and Schedule (P1)

Affected: CS-007/008/009; related source risk in CS-010 and authentication/workspace fetches. The Team helper and create-shift worker-list fetch have no AbortController/deadline. `mountManagerDashboard` awaits `mountCreateShift`, which awaits workers, before dashboard `load()` and Refresh listener registration. Fault injection only delayed roster GET; the dashboard service remained healthy. Team still waited after 23.577s, and Schedule showed no saved records. A 45-second delayed error eventually allows the code to progress; an indefinitely pending request has no app-level deadline.

**Proposed CS-020: Request recovery and independent schedule loading.**

Acceptance: render saved Schedule independently of create-form worker loading; bound relevant reads/writes with a consistent deadline; enable retry after timeout and preserve drafts/focus; Refresh works while roster is unavailable; never automatically repeat a mutation whose outcome is unknown—tell the user to refresh/reconcile first. Add fault tests for delayed roster, missing response, late success and uncertain writes; verify both roles remain usable. Audit other unbounded fetches (Team, create/edit, login/signup/setup/workspace) rather than assuming all were fault-tested here.

### F-02 — Observed: supplied seed no longer supports a working demo (P2)

Affected: CS-003/005/006/007. Original seed uses Nov 12–16, 2026. On Nov 18 it yields **zero upcoming shifts**, one expired pending claim and no actionable future seeded coverage. This is correctly filtered storage, not lost data. Automated tests use controlled clocks and therefore remain deterministic; normal current-date demo usefulness is the gap. [Independent probe](evidence/expired-seed-check.json).

**Proposed CS-021: Repeatable current-date fictional demo fixtures.**

Acceptance: an explicit separate-data demo command creates relative future assignments and open/pending/history scenarios with at least two usable roles; never overwrite a nonempty or real store; remain disabled in production; document credentials/setup and scenario expectations; verify the demo works on multiple simulated dates. Keep deterministic unit-test clocks.

### F-03 — Observed: expired claims count as waiting approval but cannot be resolved (P2)

Affected: CS-007/011/014/015. Original seed pending claim remains in dashboard `pendingClaims` and count even though ended. Both approve/reject and owner cancellation return **409**; source intentionally prevents decisions once started. This preserves honest assignment/history, but leaves a permanent attention item without an actionable cleanup route. Treat as workflow improvement, not permission to retroactively transfer assignments. Probe confirmed no data changed after all three rejected actions.

**Proposed CS-022: Separate expired coverage from actionable approvals.**

Acceptance: distinguish actionable pending count from expired/started attention records; provide an explicit historical/expired view or audited resolution policy agreed with owner; retain original events and assignment; never retroactively approve or silently erase claims; cover exact start/end boundaries and old schema records. Decide whether a display-only derived label is enough before adding stored statuses.

### F-04 — Source-confirmed: current documentation contradicts merged status (P2)

README, AGENTS and roadmap still say CS-019 awaiting review/separate worktree, and README describes several earlier tasks as local review. Authentication documentation says API responses never contain email addresses although the authorized manager roster appropriately includes employee email. Security review's old “no offboarding UI” limitation predates CS-019. Historical evidence is useful, but should be clearly dated and separated from current instructions.

**Proposed CS-023: Reconcile current setup, scope and traceability documentation.**

Acceptance: one current merged task/status index through PR #38, role sign-in/setup and removal guide, correct safe-field/privacy descriptions, explicit dated historical review sections and CS-018 last; verify teammate can follow current run instructions; avoid erasing genuine past test results or approvals.

### F-05 — Verification gap: accessibility acceptance broader than measured checks (P2)

Affected: CS-002/004/005/008–017/019 frontend. Keyboard/field association and measured 320px reflow passed. Screen-reader announcements, actual 200%/400% browser zoom, text-spacing changes and OS reduced-motion/forced-colors behavior were not fully exercised. 320px width is evidence of reflow, not a substitute for all zoom or assistive-technology checks.

**Proposed CS-024: Assistive-technology and zoom acceptance verification.**

Acceptance: documented VoiceOver keyboard walkthrough of signup/login/setup and both-role coverage loop; true zoom/text spacing and long names at critical screens; reduced-motion/forced-colors checks where supported; evidence of focus/status/errors and any actual fixes; explicitly list unsupported combinations. Do not label WCAG compliant solely from this audit.

### F-06 — Deliberate limitation: any coverage history prevents future shift maintenance (P3)

Affected: CS-010/011/019. After the browser cancelled Acceptance overnight, the future shift stayed locked in Schedule because it has coverage history. Existing tests explicitly require this for every linked status; it is **not a failed original acceptance criterion**. It can complicate reassigning a departing employee after coverage cancellation.

**Optional proposed CS-027: History-preserving changes to inactive-coverage future shifts.**

Acceptance before implementing: agree eligibility (never active open/pending, never started); retain immutable original shift details/events or audited snapshots; reject stale/conflicting reassignment; preserve valid references and communicate changed schedule. Requires design approval because it changes CS-010's accepted policy.

### F-07 — Verification/process gap: collaboration access and CI evidence (P2)

Contributing/plan still leave teammate access and branch protections unverified. No tracked `.github` workflow exists. Merged PR evidence previously reported no check runs. Successful local execution does not prove hosted CI, protections or a second teammate's checkout. This audit did not alter settings or grant access.

**Proposed CS-025: Automated PR verification.** Acceptance: Node 24 syntax and all tests run in CI with temporary data, success is visible on a sample PR, failures block the agreed merge flow where repository capabilities allow; verify protection availability rather than promising it. No deployment added.

**Proposed CS-026: Teammate onboarding and repository workflow verification.** Acceptance: identify teammate, verify existing access without unsolicited invitations, test clean checkout/run and contribution workflow, document ownership and available branch protections. Access/settings changes require the appropriate explicit scope. This closes a collaboration verification gap, not a new website feature.

### F-08 — Optional feature opportunities, not defects in merged scope (P3)

- **Proposed CS-028: Secure employee reactivation.** Current UI explicitly has no reactivation option and inactive email stays reserved. Acceptance: authorized same-business manager confirmation, new one-time setup, never restore old password hash/session/setup token, history preserved and races/duplicate email covered.
- **Proposed CS-029: Account recovery.** Existing login has no forgotten-password workflow. Acceptance: prove account control through an agreed delivery/recovery method, generic responses/rate bounds, short-lived single-use hashed tokens, revoke old sessions after reset, no manager-selected employee passwords. Email delivery would be separate scope requiring configuration.
- **Proposed CS-030: Coverage notifications.** Refresh is currently manual and no email is sent by design. Acceptance: agree in-app versus email channel first; private business/participant scope, accurate event links, no setup tokens or credentials in routine notifications, failures must not undo a saved coverage action. Keep outside the required MVP unless selected.

## Recommended order and release boundary

1. CS-020: fix confirmed recovery defect first.
2. CS-021 and CS-023: reliable demo and accurate instructions.
3. CS-022: decide expired-item presentation/resolution.
4. CS-024–CS-026: verification and collaboration confidence before release.
5. CS-027–CS-030: owner-selected optional features only; they are not automatically added to the MVP.
6. **CS-018 last**, after any selected work and its review/approved merge.

Persistent-disk hosting, HTTPS proxy behavior, backup/restore drill, stale-lock recovery operations, restart/session behavior and final rubric/submission verification remain release acceptance work in CS-018. These were not deployed or certified here. No Supabase migration is implied. JSON single-process persistence remains the current architecture.

Before any selected implementation: create its GitHub issue with agreed acceptance criteria, verify Todo, move In Progress, implement locally, test/preview, Your review, then push/merge only after approval. This report does not reopen historical issues or mark proposed work Done.
