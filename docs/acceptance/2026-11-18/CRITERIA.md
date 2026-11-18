# Acceptance criterion register — 2026-11-18

Baseline commit: `0043def050c1edc85b0a72fd78531219dd3a1fc0`. Read together with [REPORT.md](REPORT.md). Each AT ID below corresponds to one original issue checklist item; IDs do not claim one executable test per checklist item.

Evidence labels: **AUTO** = relevant current automated suite passed; **BROWSER** = explicitly listed new browser scenario; **SOURCE/HTTP** = current document/code or route inspection; **HISTORICAL** = original approval/merge or earlier UI record, not repeated human acceptance; **GAP** = known defect or uncompleted verification; **SUPERSEDED** = planned later feature intentionally replaced an incremental restriction. UI states not named in the fresh browser log retain historical evidence only. Test groups overlap across issues and must not be added as independent test counts.

## CS-001 — issue #2, PR #1

[Original issue](https://github.com/EldarSadeghi/soen287-covershift/issues/2) · [Merged PR](https://github.com/EldarSadeghi/soen287-covershift/pull/1)

Fresh browser references: B-02 (REPORT.md).

| Acceptance ID | Original expected criterion | Evidence / qualification |
| --- | --- | --- |
| AT-CS-001-01 | Minimal Node server and visible local start page. | SOURCE/HTTP and BROWSER where listed; original issue records earlier full UI review. Teammate/protection checks remain unverified in the broader plan (F-07). |
| AT-CS-001-02 | Frontend, server, runtime data, and documentation folders. | SOURCE/HTTP and BROWSER where listed; original issue records earlier full UI review. Teammate/protection checks remain unverified in the broader plan (F-07). |
| AT-CS-001-03 | README setup instructions and environment example. | SOURCE/HTTP and BROWSER where listed; original issue records earlier full UI review. Teammate/protection checks remain unverified in the broader plan (F-07). |
| AT-CS-001-04 | Ignore rules for secrets and runtime data. | SOURCE/HTTP and BROWSER where listed; original issue records earlier full UI review. Teammate/protection checks remain unverified in the broader plan (F-07). |
| AT-CS-001-05 | Traceable implementation plan and approval workflow. | SOURCE/HTTP and BROWSER where listed; original issue records earlier full UI review. Teammate/protection checks remain unverified in the broader plan (F-07). |
| AT-CS-001-06 | Syntax and local HTTP checks passed. | SOURCE/HTTP and BROWSER where listed; original issue records earlier full UI review. Teammate/protection checks remain unverified in the broader plan (F-07). |
| AT-CS-001-07 | User reviewed and approved the feature. | HISTORICAL: closed issue and merged PR #1; no new user acceptance implied. |
| AT-CS-001-08 | Merged into main through PR #1. | HISTORICAL: closed issue and merged PR #1; no new user acceptance implied. |

## CS-002 — issue #3, PR #4

[Original issue](https://github.com/EldarSadeghi/soen287-covershift/issues/3) · [Merged PR](https://github.com/EldarSadeghi/soen287-covershift/pull/4)

Fresh browser references: B-02, B-09, B-13, B-14 (REPORT.md).

| Acceptance ID | Original expected criterion | Evidence / qualification |
| --- | --- | --- |
| AT-CS-002-01 | Worker: My shifts, Open shifts, My requests. | SOURCE/HTTP and BROWSER where listed; original issue records earlier full UI review. Teammate/protection checks remain unverified in the broader plan (F-07). |
| AT-CS-002-02 | Manager: Overview, Schedule, Approvals, Team. | SOURCE/HTTP and BROWSER where listed; original issue records earlier full UI review. Teammate/protection checks remain unverified in the broader plan (F-07). |
| AT-CS-002-03 | Role preview switch, active navigation, and direct links work. | SOURCE/HTTP and BROWSER where listed; original issue records earlier full UI review. Teammate/protection checks remain unverified in the broader plan (F-07). |
| AT-CS-002-04 | Layout works at desktop and phone widths with keyboard-accessible navigation. | BROWSER: B-02, B-09, B-13, B-14. HISTORICAL for UI combinations not explicitly rerun; AUTO covers service behavior, not all visual states. |
| AT-CS-002-05 | Demo data and unavailable actions are clearly labeled; role preview grants no authorization. | SOURCE/HTTP and BROWSER where listed; original issue records earlier full UI review. Teammate/protection checks remain unverified in the broader plan (F-07). |
| AT-CS-002-06 | Syntax, route, and browser checks pass. | BROWSER: B-02, B-09, B-13, B-14. HISTORICAL for UI combinations not explicitly rerun; AUTO covers service behavior, not all visual states. |
| AT-CS-002-07 | User reviews local preview before push or merge. | HISTORICAL: closed issue and merged PR #4; no new user acceptance implied. |

## CS-003 — issue #5, PR #6

[Original issue](https://github.com/EldarSadeghi/soen287-covershift/issues/5) · [Merged PR](https://github.com/EldarSadeghi/soen287-covershift/pull/6)

Fresh automated groups: [`storage.test.js`](../../../tests/storage.test.js).

- `storage`: initializes empty, seeds stable references, and survives a new process; seeding never replaces existing records, even after edits; concurrent transactions across store instances do not lose writes; failed and invalid transactions preserve disk data and release the queue; corrupt files and unsupported schema versions are never reset; an existing writer lock rejects writes without changing or removing its lock; readers always see complete valid JSON during writes; repositories scope by business and return detached records; model rejects duplicate identities, cross-business references, and invalid workflow records.

| Acceptance ID | Original expected criterion | Evidence / qualification |
| --- | --- | --- |
| AT-CS-003-01 | Businesses, users, shifts, coverage requests have stable IDs and documented relationships. | AUTO: storage.test.js; exact relevant test names above. Browser-specific behavior retains historical issue evidence. |
| AT-CS-003-02 | Fictional seed data loads without overwriting existing records. | AUTO: storage.test.js; exact relevant test names above. Browser-specific behavior retains historical issue evidence. |
| AT-CS-003-03 | Saved data survives restart. | AUTO: storage.test.js; exact relevant test names above. Browser-specific behavior retains historical issue evidence. |
| AT-CS-003-04 | Read-modify-write operations are serialized and persisted using atomic file replacement. | AUTO: storage.test.js; exact relevant test names above. Browser-specific behavior retains historical issue evidence. |
| AT-CS-003-05 | Invalid data and broken cross-business references are rejected. | AUTO: storage.test.js; exact relevant test names above. Browser-specific behavior retains historical issue evidence. |
| AT-CS-003-06 | Storage tests cover persistence, concurrency, rollback, and corrupt files. | AUTO: storage.test.js; exact relevant test names above. Browser-specific behavior retains historical issue evidence. |
| AT-CS-003-07 | Provide a local review method; no unauthenticated access to stored data. | AUTO: storage.test.js; exact relevant test names above. Browser-specific behavior retains historical issue evidence. |
| AT-CS-003-08 | User reviews before push or merge. | HISTORICAL: closed issue and merged PR #6; no new user acceptance implied. |

## CS-004 — issue #7, PR #8

[Original issue](https://github.com/EldarSadeghi/soen287-covershift/issues/7) · [Merged PR](https://github.com/EldarSadeghi/soen287-covershift/pull/8)

Fresh automated groups: [`signup.test.js`](../../../tests/signup.test.js).

- `signup`: signup persists a new business/manager and a verifiable salted scrypt hash; invalid fields and client-selected roles/business IDs never create records; concurrent duplicate emails create only one account and business; hashing failures leave no partial business or account; signup limiter blocks repeated attempts and expires them; HTTP signup rejects unsafe requests, creates accounts, and protects private files.

| Acceptance ID | Original expected criterion | Evidence / qualification |
| --- | --- | --- |
| AT-CS-004-01 | Signup form collects manager name, email, password, and business name. | AUTO: signup.test.js; exact relevant test names above. Browser-specific behavior retains historical issue evidence. |
| AT-CS-004-02 | Server validates inputs and stores a salted password hash, never plaintext. | AUTO: signup.test.js; exact relevant test names above. Browser-specific behavior retains historical issue evidence. |
| AT-CS-004-03 | Business and manager are created atomically with new IDs; clients cannot choose their role or join another business. | AUTO: signup.test.js; exact relevant test names above. Browser-specific behavior retains historical issue evidence. |
| AT-CS-004-04 | Duplicate emails and invalid requests are rejected without partial records. | AUTO: signup.test.js; exact relevant test names above. Browser-specific behavior retains historical issue evidence. |
| AT-CS-004-05 | Responsive form has accessible errors and a clear success state. | HISTORICAL for UI combinations not explicitly rerun; AUTO covers service behavior, not all visual states. |
| AT-CS-004-06 | Signup does not imply a working login/session; CS-005 follows. | SUPERSEDED: original staged scope; later merged increments intentionally add these actions. Original issue/PR retains historical evidence. |
| AT-CS-004-07 | Relevant automated and browser checks pass. | HISTORICAL for UI combinations not explicitly rerun; AUTO covers service behavior, not all visual states. |
| AT-CS-004-08 | User reviews and confirms before pushing or merging. | HISTORICAL: closed issue and merged PR #8; no new user acceptance implied. |

## CS-005 — issue #9, PR #10

[Original issue](https://github.com/EldarSadeghi/soen287-covershift/issues/9) · [Merged PR](https://github.com/EldarSadeghi/soen287-covershift/pull/10)

Fresh automated groups: [`auth.test.js`](../../../tests/auth.test.js), [`security-workflow.test.js`](../../../tests/security-workflow.test.js).

- `auth`: password verifier accepts existing signup hashes and rejects wrong/null/malformed hashes; authentication normalizes email, returns only user ID, and gives identical unknown/wrong feedback; sessions expire by idle and absolute limits, rotate IDs, and invalidate logout; HTTPS cookies use __Host prefix and capacity is bounded without evicting working sessions; authorization reloads role/business from disk and rejects deleted or disabled accounts; explicit demo setup hashes both roles and never resets existing credentials; HTTP enforces sessions, role/business access, cookie rotation, CSRF logout, and expiry; new signup accounts can authenticate through the same stored hash format; HTTP login throttles attempts before repeated password derivation.
- `security-workflow`: HTTP lifecycle: onboard employee, request, reject, reopen, reclaim, approve, re-request and cancel with durable history; HTTP foreign IDs cannot edit/delete/request/cancel/claim/review or reveal another business records; HTTP race: competing claimants and approval/cancellation serialize with no partial assignment or extra history; HTTP approval rechecks assignments added since claim and rejects stale approval after rejection/reclaim; HTTP mutation guard matrix rejects wrong roles, cross-site requests, foreign CSRF and forged fields without disk changes; HTTP malformed/oversized bodies, private paths and generic errors do not mutate or expose storage/secrets; HTTP sessions rotate CSRF, reject duplicate/forged cookies, expire and revoke disabled accounts; HTTP production origin and security headers ignore spoofed forwarding headers and bind secure sessions; HTTP coverage throttling bounds repeated mutations and leaves storage unchanged.

Fresh browser references: B-01, B-02, B-09 (REPORT.md).

| Acceptance ID | Original expected criterion | Evidence / qualification |
| --- | --- | --- |
| AT-CS-005-01 | Responsive login page verifies hashed passwords with generic failure feedback. | BROWSER: B-01, B-02, B-09. HISTORICAL for UI combinations not explicitly rerun; AUTO covers service behavior, not all visual states. |
| AT-CS-005-02 | Opaque server-side sessions use HttpOnly SameSite cookies, expiration, and rotation on login. | AUTO: auth.test.js, security-workflow.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-005-03 | Logout invalidates the server session; missing/expired sessions cannot access protected routes. | AUTO: auth.test.js, security-workflow.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-005-04 | Server enforces manager/worker roles and business boundaries; preview role switching grants no access. | AUTO: auth.test.js, security-workflow.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-005-05 | Mutating authenticated requests require CSRF protection. | AUTO: auth.test.js, security-workflow.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-005-06 | Both fictional demo roles can be tested locally through an explicit development account setup. | AUTO: auth.test.js, security-workflow.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-005-07 | Automated tests and browser checks cover login, logout, session and role boundaries. | BROWSER: B-01, B-02, B-09. HISTORICAL for UI combinations not explicitly rerun; AUTO covers service behavior, not all visual states. |
| AT-CS-005-08 | User reviews before push or merge. | HISTORICAL: closed issue and merged PR #10; no new user acceptance implied. |

## CS-006 — issue #11, PR #12

[Original issue](https://github.com/EldarSadeghi/soen287-covershift/issues/11) · [Merged PR](https://github.com/EldarSadeghi/soen287-covershift/pull/12)

Fresh automated groups: [`worker-shifts.test.js`](../../../tests/worker-shifts.test.js).

- `worker-shifts`: upcoming shifts filter by authenticated worker, exclude completed boundaries, and sort deterministically; end-time exclusion is exact to the millisecond and returns an honest empty state; shift reads reflect saved changes and re-check current account identity; formatting uses business timezone instead of machine timezone and handles overnight dates; daylight-saving repeated clock times include offsets and use actual elapsed duration; HTTP shift endpoint denies anonymous/managers and cannot select another worker via URL parameters.

Fresh browser references: B-04, B-09 (REPORT.md).

| Acceptance ID | Original expected criterion | Evidence / qualification |
| --- | --- | --- |
| AT-CS-006-01 | Worker sees only assigned shifts in their own business; role and identity enforced server-side. | AUTO: worker-shifts.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-006-02 | Upcoming/current shifts are ordered by start time; completed shifts are excluded. | AUTO: worker-shifts.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-006-03 | Dates/times display in the business timezone, including overnight shifts. | AUTO: worker-shifts.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-006-04 | Responsive loading, error/retry, and empty states; no fake shifts in private workspace. | BROWSER: B-04, B-09. HISTORICAL for UI combinations not explicitly rerun; AUTO covers service behavior, not all visual states. |
| AT-CS-006-05 | Saved changes appear after refresh; no shift mutation or coverage actions added. | SUPERSEDED: original staged scope; later merged increments intentionally add these actions. Original issue/PR retains historical evidence. |
| AT-CS-006-06 | Automated tests cover filtering, business/role isolation, ordering, and time boundaries; browser checks pass. | BROWSER: B-04, B-09. HISTORICAL for UI combinations not explicitly rerun; AUTO covers service behavior, not all visual states. |
| AT-CS-006-07 | User reviews before push or merge. | HISTORICAL: closed issue and merged PR #12; no new user acceptance implied. |

## CS-007 — issue #13, PR #14

[Original issue](https://github.com/EldarSadeghi/soen287-covershift/issues/13) · [Merged PR](https://github.com/EldarSadeghi/soen287-covershift/pull/14)

Fresh automated groups: [`manager-dashboard.test.js`](../../../tests/manager-dashboard.test.js).

- `manager-dashboard`: manager summary returns sorted business shifts and pending people without sensitive account data or writes; each manager sees only their own business including claim participants and counts; completed shifts leave the schedule but unresolved pending claims remain visible; new businesses return empty data and access re-checks stored roles and credentials; manager API rejects workers, forged filters, and mutations and reflects saved records; milestone walkthrough: signup, own empty dashboard, both-role pages, logout and protected routes.

Fresh browser references: B-02, B-06, B-16 (REPORT.md).

| Acceptance ID | Original expected criterion | Evidence / qualification |
| --- | --- | --- |
| AT-CS-007-01 | Manager overview shows only their business’s saved current/upcoming shifts and pending coverage claims. | AUTO: manager-dashboard.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-007-02 | Read-only schedule and approvals pages are connected to those same scoped records. | AUTO: manager-dashboard.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-007-03 | Pending claims show original worker, claimant, shift time, and status; approval/rejection remain clearly unavailable until CS-014. | SUPERSEDED: original staged scope; later merged increments intentionally add these actions. Original issue/PR retains historical evidence. |
| AT-CS-007-04 | Responsive loading, empty, refresh, and error/retry states; dates use business timezone. | BROWSER: B-02, B-06, B-16. HISTORICAL for UI combinations not explicitly rerun; AUTO covers service behavior, not all visual states. GAP F-01: delayed worker list lacks bounded recovery; saved Schedule waits for roster. |
| AT-CS-007-05 | Manager/worker and cross-business boundaries are tested server-side. | AUTO: manager-dashboard.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-007-06 | Both-role walkthrough documents what works and what remains upcoming; all proposed pages are reachable. | AUTO: manager-dashboard.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-007-07 | Automated tests and browser walkthrough pass. | BROWSER: B-02, B-06, B-16. HISTORICAL for UI combinations not explicitly rerun; AUTO covers service behavior, not all visual states. GAP F-01: delayed worker list lacks bounded recovery; saved Schedule waits for roster. |
| AT-CS-007-08 | User reviews before push or merge. | HISTORICAL: closed issue and merged PR #14; no new user acceptance implied. |

## CS-008 — issue #17, PR #18

[Original issue](https://github.com/EldarSadeghi/soen287-covershift/issues/17) · [Merged PR](https://github.com/EldarSadeghi/soen287-covershift/pull/18)

Fresh automated groups: [`workers.test.js`](../../../tests/workers.test.js).

- `workers`: add worker atomically upgrades v1 without altering existing records; roster is scoped and safe; strict fields, duplicate race, role and business boundaries reject unauthorized changes; setup survives reopening storage, expires at boundary, and replacement invalidates original; single-use completion is atomic, cannot reset accounts, and cannot change role or business; expiry and link rotation are rechecked after password hashing; v2 setup metadata is restricted to pending workers and rejects extra fields; HTTP manager mutations enforce session, CSRF, origin, JSON, and fixed business; setup creates usable worker login.

Fresh browser references: B-08, B-15 (REPORT.md).

| Acceptance ID | Original expected criterion | Evidence / qualification |
| --- | --- | --- |
| AT-CS-008-01 | Manager Team page shows only their own business’s saved workers and account setup status. | AUTO: workers.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-008-02 | Manager can add a worker with validated name/email; role and business are server-selected. | AUTO: workers.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-008-03 | Duplicate emails/concurrent submissions cannot create duplicate workers. | AUTO: workers.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-008-04 | Worker sets their own password through a single-use, expiring setup link; no email delivery or plaintext password storage. | AUTO: workers.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-008-05 | Manager-only mutations require a valid session, same-origin JSON, and CSRF token. | AUTO: workers.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-008-06 | Worker and cross-business access are rejected server-side; setup tokens are stored hashed and never included in roster responses. | AUTO: workers.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-008-07 | Responsive loading, empty, error/retry, and setup confirmation states. | BROWSER: B-08, B-15. HISTORICAL for UI combinations not explicitly rerun; AUTO covers service behavior, not all visual states. GAP F-01: delayed worker list lacks bounded recovery; saved Schedule waits for roster. |
| AT-CS-008-08 | Automated and browser checks cover roster, add-worker, setup, expiry/reuse, and role/business boundaries. | BROWSER: B-08, B-15. HISTORICAL for UI combinations not explicitly rerun; AUTO covers service behavior, not all visual states. GAP F-01: delayed worker list lacks bounded recovery; saved Schedule waits for roster. |
| AT-CS-008-09 | User reviews before push or merge. | HISTORICAL: closed issue and merged PR #18; no new user acceptance implied. |

## CS-009 — issue #19, PR #20

[Original issue](https://github.com/EldarSadeghi/soen287-covershift/issues/19) · [Merged PR](https://github.com/EldarSadeghi/soen287-covershift/pull/20)

Fresh automated groups: [`create-shift.test.js`](../../../tests/create-shift.test.js).

- `create-shift`: business time conversion is independent of host timezone, handles fractional offsets and DST; strict calendar validation rejects impossible dates, normalization, offsets and nonstrings; saved assignment appears in manager and assigned worker views and survives store reopen; overnight shifts and pending-login workers are supported; adjacent shifts are allowed; invalid input, past or reversed ranges, forged assignments and roles never change disk; overlaps are rejected atomically under concurrent creation; other workers may work at same time; HTTP creation enforces method, session, role, business, origin, CSRF and JSON before persisting.

Fresh browser references: B-03, B-04, B-16 (REPORT.md).

| Acceptance ID | Original expected criterion | Evidence / qualification |
| --- | --- | --- |
| AT-CS-009-01 | Manager can create a titled shift assigned to an existing worker in their own business. | AUTO: create-shift.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-009-02 | Dates/times are interpreted in business timezone, saved as UTC, and support overnight shifts with an explicit end date. | AUTO: create-shift.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-009-03 | Server rejects malformed/past/reversed times, nonexistent or ambiguous daylight-saving times, foreign workers, extra fields, and overlapping assignments. | AUTO: create-shift.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-009-04 | Session, manager role, same-origin JSON, CSRF and atomic assignment checks protect writes. | AUTO: create-shift.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-009-05 | Saved shifts appear in manager schedule/counts and assigned worker My shifts; persist after restart. | AUTO: create-shift.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-009-06 | Form includes loading, empty-roster, success, validation and retry states; mobile and keyboard use checked. | BROWSER: B-03, B-04, B-16. HISTORICAL for UI combinations not explicitly rerun; AUTO covers service behavior, not all visual states. GAP F-01: delayed worker list lacks bounded recovery; saved Schedule waits for roster. |
| AT-CS-009-07 | Automated checks and local preview provided. | AUTO: create-shift.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-009-08 | User approval before push/merge. | HISTORICAL: closed issue and merged PR #20; no new user acceptance implied. |

## CS-010 — issue #21, PR #22

[Original issue](https://github.com/EldarSadeghi/soen287-covershift/issues/21) · [Merged PR](https://github.com/EldarSadeghi/soen287-covershift/pull/22)

Fresh automated groups: [`manage-shift.test.js`](../../../tests/manage-shift.test.js).

- `manage-shift`: edit persists title, overnight time and reassignment, updates both role views and preserves identity; deletion removes only eligible shift, leaves all other collections intact and survives reopen; every linked coverage status blocks edit/delete without orphaning or modifying records; started/ended shifts are locked at the exact start boundary, including attempts to move them into future; stale submissions and concurrent edit/delete cannot overwrite a more recent change; edit excludes its own interval, rejects overlapping reassignment, and serializes conflicts with creation; foreign/worker access, forged fields, invalid dates, assignment and missing revisions do not change storage; dashboard exposes safe revision and lock reasons consistent with server policy; HTTP edit/delete require session, role, Origin, CSRF and JSON; persisted changes reflect in role endpoints.

Fresh browser references: B-05 (REPORT.md).

| Acceptance ID | Original expected criterion | Evidence / qualification |
| --- | --- | --- |
| AT-CS-010-01 | Manager can edit title, assigned worker and business-local start/end times of their business’s future shifts. | AUTO: manage-shift.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-010-02 | Manager can delete eligible future shifts with an explicit confirmation. | AUTO: manage-shift.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-010-03 | Shifts with any linked coverage request are locked for editing/deletion, preserving active requests and history; started/ended shifts are also locked. | AUTO: manage-shift.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-010-04 | Server rechecks manager/business, eligibility, dates, assignment and overlaps atomically; stale edits/deletes are rejected instead of overwriting newer changes. | AUTO: manage-shift.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-010-05 | Writes enforce session, Origin, JSON and CSRF; foreign/worker access rejected. | AUTO: manage-shift.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-010-06 | Manager schedule/counts and worker views reflect persisted edits, reassignment and deletion. | AUTO: manage-shift.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-010-07 | Loading, validation/error/retry, cancel and mobile/keyboard states work. | BROWSER: B-05. HISTORICAL for UI combinations not explicitly rerun; AUTO covers service behavior, not all visual states. |
| AT-CS-010-08 | Automated checks and local preview provided before push/merge. | AUTO: manage-shift.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-010-09 | User approves publication. | HISTORICAL: closed issue and merged PR #22; no new user acceptance implied. |

## CS-011 — issue #23, PR #24

[Original issue](https://github.com/EldarSadeghi/soen287-covershift/issues/23) · [Merged PR](https://github.com/EldarSadeghi/soen287-covershift/pull/24)

Fresh automated groups: [`coverage.test.js`](../../../tests/coverage.test.js).

- `coverage`: request persists open status without changing assignment and appears only in owner’s requests and shifts; concurrent duplicates produce one active request and reject even with a fresh active-request revision; cancel preserves request/claimant history and assignment, supports open/pending, and allows fresh re-request; request/cancel ownership, role, strict fields and exact-start boundary are enforced without writes; closed/approved requests and stale claim status cannot be cancelled, concurrent cancellation wins once; coverage and manager mutations recheck current data atomically; stale edited/deleted shifts cannot be requested; HTTP endpoints protect both mutations, scope reads and persist request/cancel without changing assignment.

Fresh browser references: B-10 (REPORT.md).

| Acceptance ID | Original expected criterion | Evidence / qualification |
| --- | --- | --- |
| AT-CS-011-01 | My shifts offers coverage requests only for own future assigned shifts without an active open/pending request. | AUTO: coverage.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-011-02 | My requests lists only the signed-in worker’s own requests, with status, shift times and cancellation eligibility. | AUTO: coverage.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-011-03 | Original worker can cancel open or pending requests before shift start while still assigned; pending cancellation preserves claimant information and never transfers assignment. | AUTO: coverage.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-011-04 | Cancelled requests remain saved; a fresh request may be created after refresh with a new ID. | AUTO: coverage.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-011-05 | Atomic checks reject duplicate/concurrent/stale requests, foreign or other-worker shifts/requests, started shifts and closed/approved cancellations. | AUTO: coverage.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-011-06 | Session, worker role, Origin, JSON and CSRF protect mutations; request bodies cannot select owner/business/status. | AUTO: coverage.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-011-07 | Clear confirmation, loading, empty, error/retry, mobile and keyboard states; assignment stays unchanged. | BROWSER: B-10. HISTORICAL for UI combinations not explicitly rerun; AUTO covers service behavior, not all visual states. |
| AT-CS-011-08 | Tests and working local worker preview provided. | AUTO: coverage.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-011-09 | User approves before push/merge. | HISTORICAL: closed issue and merged PR #24; no new user acceptance implied. |

## CS-012 — issue #25, PR #26

[Original issue](https://github.com/EldarSadeghi/soen287-covershift/issues/25) · [Merged PR](https://github.com/EldarSadeghi/soen287-covershift/pull/26)

Fresh automated groups: [`open-shifts.test.js`](../../../tests/open-shifts.test.js).

- `open-shifts`: board filters own, foreign, started, ended and all unavailable states; sorts dates and ties consistently; expiry is exact to the millisecond and honest empty results do not modify saved requests; refresh reads cancellation and pending changes from disk without transferring assignments; authentication and current business membership are rechecked on each board read; HTTP board rejects anonymous/managers, query tampering and mutations; allows scoped GET/HEAD only.

Fresh browser references: B-11 (REPORT.md).

| Acceptance ID | Original expected criterion | Evidence / qualification |
| --- | --- | --- |
| AT-CS-012-01 | Worker sees only open future coverage requests from other workers in the same business. | AUTO: open-shifts.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-012-02 | Own, started/ended, pending/already-claimed, approved and cancelled requests are excluded server-side. | AUTO: open-shifts.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-012-03 | Cards show title, business-timezone date/time, duration and original worker; earliest shifts first with stable ordering. | AUTO: open-shifts.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-012-04 | Session/worker/business checks are server-enforced; client query selectors cannot change scope and DTOs omit private account fields. | AUTO: open-shifts.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-012-05 | Refresh reflects new requests/cancellations and exact shift-start expiry; board reads do not modify data or assignments. | AUTO: open-shifts.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-012-06 | Loading, honest empty, error/retry, responsive and keyboard states work. | BROWSER: B-11. HISTORICAL for UI combinations not explicitly rerun; AUTO covers service behavior, not all visual states. |
| AT-CS-012-07 | Claiming is clearly identified as CS-013 and no claim action is presented as functional. | SUPERSEDED: original staged scope; later merged increments intentionally add these actions. Original issue/PR retains historical evidence. |
| AT-CS-012-08 | Automated tests and local worker preview provided. | AUTO: open-shifts.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-012-09 | User approval before push/merge. | HISTORICAL: closed issue and merged PR #26; no new user acceptance implied. |

## CS-013 — issue #27, PR #28

[Original issue](https://github.com/EldarSadeghi/soen287-covershift/issues/27) · [Merged PR](https://github.com/EldarSadeghi/soen287-covershift/pull/28)

Fresh automated groups: [`claim.test.js`](../../../tests/claim.test.js).

- `claim`: shared client/server overlap comparison handles containment, adjacency, overnight and repeated DST clock times; fresh preflight is read-only, returns only own commitments, and atomic claim persists pending without assigning shift; assigned overlap blocks check and final claim, including a new assignment after successful preflight; concurrent claims by different workers choose one claimant and reject repeated claims; pending claims reserve time so concurrent overlapping claims cannot both succeed; adjacent claims remain allowed; cancelling a pending original request releases the claimant reservation while retaining claim history; own, foreign, inactive users, tampered fields and exact-start expiry are rejected without writes; request cancellation or approval between check and confirmation blocks stale claims; HTTP check/claim protect session, role, origin, JSON, CSRF, strict input and query scope.

Fresh browser references: B-11 (REPORT.md).

| Acceptance ID | Original expected criterion | Evidence / qualification |
| --- | --- | --- |
| AT-CS-013-01 | Open board checks assigned shifts and other pending claims for true interval overlap; touching boundaries are allowed, including overnight/DST cases. | AUTO: claim.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-013-02 | Clicking claim/check shows an immediate no-page-reload warning from the current schedule snapshot; a fresh server preflight independently rechecks eligibility/conflicts before confirmation. | AUTO: claim.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-013-03 | Confirm claim atomically rechecks current worker/business, request revision/status, future start, ownership and conflicts, then sets claimant from session and status pending. | AUTO: claim.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-013-04 | Original worker remains assigned until manager approval (CS-014). | AUTO: claim.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-013-05 | Concurrent claims on one request yield exactly one claimant; overlapping requests claimed by one worker cannot both succeed. | AUTO: claim.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-013-06 | Own, foreign, expired, cancelled, approved and already-claimed requests are rejected; tampered identity/status fields are refused. | AUTO: claim.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-013-07 | Worker can see pending claims in My requests; original owner and manager see updated pending status. | AUTO: claim.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-013-08 | Session/Origin/JSON/CSRF, current account and query-scope protections apply to check/claim. | AUTO: claim.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-013-09 | Loading, confirmation/cancel, stale/error/retry, keyboard/mobile states and tests/local preview provided. | BROWSER: B-11. HISTORICAL for UI combinations not explicitly rerun; AUTO covers service behavior, not all visual states. |
| AT-CS-013-10 | User approval before push/merge. | HISTORICAL: closed issue and merged PR #28; no new user acceptance implied. |

## CS-014 — issue #29, PR #30

[Original issue](https://github.com/EldarSadeghi/soen287-covershift/issues/29) · [Merged PR](https://github.com/EldarSadeghi/soen287-covershift/pull/30)

Fresh automated groups: [`review.test.js`](../../../tests/review.test.js), [`security-workflow.test.js`](../../../tests/security-workflow.test.js).

- `review`: approval persists exactly one transfer, reviewer, timestamps and both worker views; rejection retains claimant/reviewer history, reopens with new ID, releases reservation and supports reclaim; fresh assigned and pending conflicts block approval without blocking rejection; adjacency works; concurrent approve/reject permits one decision and never duplicates reopening or transfer; scope, role, revision, expiry, cancellation, inactive claimant and input tampering are rechecked; HTTP manager decisions enforce method, session, role, Origin, JSON, CSRF, query and strict body.
- `security-workflow`: HTTP lifecycle: onboard employee, request, reject, reopen, reclaim, approve, re-request and cancel with durable history; HTTP foreign IDs cannot edit/delete/request/cancel/claim/review or reveal another business records; HTTP race: competing claimants and approval/cancellation serialize with no partial assignment or extra history; HTTP approval rechecks assignments added since claim and rejects stale approval after rejection/reclaim; HTTP mutation guard matrix rejects wrong roles, cross-site requests, foreign CSRF and forged fields without disk changes; HTTP malformed/oversized bodies, private paths and generic errors do not mutate or expose storage/secrets; HTTP sessions rotate CSRF, reject duplicate/forged cookies, expire and revoke disabled accounts; HTTP production origin and security headers ignore spoofed forwarding headers and bind secure sessions; HTTP coverage throttling bounds repeated mutations and leaves storage unchanged.

Fresh browser references: B-06 (REPORT.md).

| Acceptance ID | Original expected criterion | Evidence / qualification |
| --- | --- | --- |
| AT-CS-014-01 | Approval atomically rechecks manager/business, pending revision, future start, original assignment, claimant eligibility and assigned/pending conflicts; transfers assignment exactly once. | AUTO: review.test.js, security-workflow.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-014-02 | Rejection preserves the rejected claim and reviewer/time, leaves original assignment unchanged and reopens coverage. | AUTO: review.test.js, security-workflow.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-014-03 | Stale, concurrent, foreign, wrong-role and tampered decisions cannot mutate data. | AUTO: review.test.js, security-workflow.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-014-04 | Session, Origin, JSON, CSRF and query protections apply. | AUTO: review.test.js, security-workflow.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-014-05 | Manager confirmation, loading, error/refresh and mobile/keyboard states; worker views reflect decisions. | BROWSER: B-06. HISTORICAL for UI combinations not explicitly rerun; AUTO covers service behavior, not all visual states. |
| AT-CS-014-06 | Relevant tests and running fictional local preview. | AUTO: review.test.js, security-workflow.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-014-07 | User approval before push/merge. | HISTORICAL: closed issue and merged PR #30; no new user acceptance implied. |

## CS-015 — issue #31, PR #32

[Original issue](https://github.com/EldarSadeghi/soen287-covershift/issues/31) · [Merged PR](https://github.com/EldarSadeghi/soen287-covershift/pull/32)

Fresh automated groups: [`history.test.js`](../../../tests/history.test.js).

- `history`: request/claim/approval timeline persists actor/time in order and updates assignment; rejection, reopening, reclaim and cancellation retain distinct truthful outcomes; legacy reads do not rewrite data or invent event actors; first mutation retains baseline snapshot; failed and concurrent decisions never add phantom or duplicate events; model refuses forged event roles, foreign actors, unknown fields/actions and nonchronological timestamps; HTTP history protects roles, participants/business, GET/HEAD, query scope and workspace routes.

Fresh browser references: B-07, B-12 (REPORT.md).

| Acceptance ID | Original expected criterion | Evidence / qualification |
| --- | --- | --- |
| AT-CS-015-01 | Workers see status and event timelines for their requests/claims; managers see business coverage history. | AUTO: history.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-015-02 | Record request, claim, approval, rejection, reopening and cancellation actor/time atomically with successful changes; failed/stale actions add nothing. | AUTO: history.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-015-03 | Preserve existing data with honest legacy history where prior event times are unknown. | AUTO: history.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-015-04 | Clear current assignment and open/pending/approved/rejected/cancelled outcomes, business timezone and status filtering. | AUTO: history.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-015-05 | Server enforces role, business and participant scope; no credentials or unrelated worker histories exposed. | AUTO: history.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-015-06 | Relevant tests, refresh/empty/error/mobile states and fictional running preview. | BROWSER: B-07, B-12. HISTORICAL for UI combinations not explicitly rerun; AUTO covers service behavior, not all visual states. |
| AT-CS-015-07 | User approval before push or merge. | HISTORICAL: closed issue and merged PR #32; no new user acceptance implied. |

## CS-016 — issue #33, PR #34

[Original issue](https://github.com/EldarSadeghi/soen287-covershift/issues/33) · [Merged PR](https://github.com/EldarSadeghi/soen287-covershift/pull/34)

Fresh automated groups: [`security-workflow.test.js`](../../../tests/security-workflow.test.js).

- `security-workflow`: HTTP lifecycle: onboard employee, request, reject, reopen, reclaim, approve, re-request and cancel with durable history; HTTP foreign IDs cannot edit/delete/request/cancel/claim/review or reveal another business records; HTTP race: competing claimants and approval/cancellation serialize with no partial assignment or extra history; HTTP approval rechecks assignments added since claim and rejects stale approval after rejection/reclaim; HTTP mutation guard matrix rejects wrong roles, cross-site requests, foreign CSRF and forged fields without disk changes; HTTP malformed/oversized bodies, private paths and generic errors do not mutate or expose storage/secrets; HTTP sessions rotate CSRF, reject duplicate/forged cookies, expire and revoke disabled accounts; HTTP production origin and security headers ignore spoofed forwarding headers and bind secure sessions; HTTP coverage throttling bounds repeated mutations and leaves storage unchanged.

Fresh browser references: B-06 (REPORT.md).

| Acceptance ID | Original expected criterion | Evidence / qualification |
| --- | --- | --- |
| AT-CS-016-01 | Review current server authorization, business isolation, strict input, session/CSRF/Origin, secret exposure and persistence controls. | AUTO: security-workflow.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-016-02 | Verify a full HTTP coverage lifecycle across both roles and businesses, including rejection/reclaim/approval/cancellation/history. | AUTO: security-workflow.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-016-03 | Add meaningful missing regressions for tampered/foreign IDs, overlapping shifts, races, stale approvals, account/session changes and malformed requests. | AUTO: security-workflow.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-016-04 | Fix confirmed findings and document evidence, test commands and remaining deployment limits. | AUTO: security-workflow.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-016-05 | Run the full suite and syntax checks; provide local review evidence and a fictional preview. | AUTO: security-workflow.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-016-06 | User approval before pushing or merging. | HISTORICAL: closed issue and merged PR #34; no new user acceptance implied. |

## CS-017 — issue #35, PR #37

[Original issue](https://github.com/EldarSadeghi/soen287-covershift/issues/35) · [Merged PR](https://github.com/EldarSadeghi/soen287-covershift/pull/37)

Fresh browser references: B-01, B-03, B-05, B-08, B-13, B-14 (REPORT.md).

| Acceptance ID | Original expected criterion | Evidence / qualification |
| --- | --- | --- |
| AT-CS-017-01 | Core manager/worker flows have visible keyboard focus, labels and useful error/status announcements. | BROWSER/SOURCE: focused errors, Escape, confirmation defaults and measured reflow covered by B-01/03/05/08/13/14 as applicable. GAP F-05: complete screen-reader/actual zoom/preferences testing not performed; see original dated review for older evidence. |
| AT-CS-017-02 | Confirmation, validation and refresh flows preserve useful focus. | BROWSER/SOURCE: focused errors, Escape, confirmation defaults and measured reflow covered by B-01/03/05/08/13/14 as applicable. GAP F-05: complete screen-reader/actual zoom/preferences testing not performed; see original dated review for older evidence. |
| AT-CS-017-03 | Phone layouts and zoom/reflow avoid clipped content; controls remain usable with long names/titles. | BROWSER/SOURCE: focused errors, Escape, confirmation defaults and measured reflow covered by B-01/03/05/08/13/14 as applicable. GAP F-05: complete screen-reader/actual zoom/preferences testing not performed; see original dated review for older evidence. |
| AT-CS-017-04 | Authentication/setup and workspace respect reduced motion and readable contrast where issues are found. | BROWSER/SOURCE: focused errors, Escape, confirmation defaults and measured reflow covered by B-01/03/05/08/13/14 as applicable. GAP F-05: complete screen-reader/actual zoom/preferences testing not performed; see original dated review for older evidence. |
| AT-CS-017-05 | Relevant automated checks and desktop/mobile keyboard browser verification with fictional local preview. | BROWSER/SOURCE: focused errors, Escape, confirmation defaults and measured reflow covered by B-01/03/05/08/13/14 as applicable. GAP F-05: complete screen-reader/actual zoom/preferences testing not performed; see original dated review for older evidence. |
| AT-CS-017-06 | User approval before pushing or merging. | HISTORICAL: closed issue and merged PR #37; no new user acceptance implied. |

## CS-019 — issue #36, PR #38

[Original issue](https://github.com/EldarSadeghi/soen287-covershift/issues/36) · [Merged PR](https://github.com/EldarSadeghi/soen287-covershift/pull/38)

Fresh automated groups: [`offboarding.test.js`](../../../tests/offboarding.test.js).

- `offboarding`: delete unused employee persists and invalidates setup while referenced employees cannot be deleted; deactivate retains past work/history, blocks login/session/setup and new assignment, and survives worker setup schema writes; deactivation removes pending setup token, including completion racing password derivation; current/future assignment and future pending claim block deactivation with concrete items; stale revisions and concurrent assignment/removal cannot leave orphaned shifts or repeated deactivation; scope, roles, strict input and schema deactivation metadata refuse tampering without writes; HTTP removal protects session/role/Origin/JSON/CSRF/query/method, and existing worker session is revoked.

Fresh browser references: B-08 (REPORT.md).

| Acceptance ID | Original expected criterion | Evidence / qualification |
| --- | --- | --- |
| AT-CS-019-01 | Manager can delete an employee only when no shift, coverage or history references exist. | AUTO: offboarding.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-019-02 | Manager can deactivate employees while retaining history; revoke sign-in/session/setup access and remove them from assignment options. | AUTO: offboarding.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-019-03 | Block deactivation while current/upcoming assignments or pending claims need resolution; show concrete blockers. | AUTO: offboarding.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-019-04 | Scoped authorization, Origin/JSON/CSRF, fresh revision and atomic rechecks prevent foreign, stale or concurrent unsafe removal. | AUTO: offboarding.test.js; exact relevant test names above. BROWSER supplements only the scenarios explicitly logged above. |
| AT-CS-019-05 | Clear confirmation, active/inactive team views, keyboard/mobile feedback and relevant tests/local fictional preview. | BROWSER: B-08. HISTORICAL for UI combinations not explicitly rerun; AUTO covers service behavior, not all visual states. |
| AT-CS-019-06 | User approval before pushing or merging. | HISTORICAL: closed issue and merged PR #38; no new user acceptance implied. |

Total: **140 original checklist criteria across 18 merged implementation issues**. No criteria were imported from duplicate stubs #15/#16 or unimplemented CS-018.
