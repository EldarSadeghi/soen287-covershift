# CoverShift implementation plan

Status: CS-001 merged (PR #1, issue #2). CS-002 merged (PR #4, issue #3). CS-003 merged (PR #6, issue #5). CS-004 merged (PR #8, issue #7). CS-005 merged (PR #10, issue #9). CS-006 merged (PR #12, issue #11). CS-007 merged (PR #14, issue #13). CS-008 merged (PR #18, issue #17). CS-009 merged (PR #20, issue #19). CS-010 merged (PR #22, issue #21). CS-011 merged (PR #24, issue #23). CS-012 merged (PR #26, issue #25). CS-013 merged (PR #28, issue #27). CS-014 merged (PR #30, issue #29). CS-015 merged (PR #32, issue #31). CS-016 merged (PR #34, issue #33). CS-017 merged (PR #37, issue #35). CS-019 merged (PR #38, issue #36). CS-020 merged (PR #41, issue #40). CS-022 (issue #42) is ready for local user review. CS-021 is deferred as an unstarted suggestion. Repository: https://github.com/EldarSadeghi/soen287-covershift.

## Basis and open questions

Source: `/Users/eldarsadeghi/Desktop/SOEN287 GROUP PROJECT/CoverShift_Proposal.docx`, particularly sections 2, 8, and 9. These are statements in the proposal, not independently verified instructor requirements. No separate assignment rubric was supplied.

The proposal places the milestone at approximately November 12 and describes navigable worker/manager front ends, signup/login/session-protected routes, and a data model. Verify the exact deadline, deliverables, allowed stack, and JSON persistence requirement against the instructor's rubric before expanding scope.

The foundation is implemented and the GitHub remote is configured. Teammate GitHub username is still needed to verify collaboration access.

## Working agreement

- Implement one increment at a time. Agree on its acceptance criteria first.
- Work locally on `codex/CS-xxx-short-name` branches. Keep `main` as the last accepted version.
- Run relevant checks and provide launch instructions, a visible preview, and a short acceptance checklist.
- Wait for the user's explicit approval of that increment before any push or merge. Feedback means revise and preview again.
- After approval, push the feature branch, open a pull request, and merge only within the scope of that approval. If approval covers only pushing or opening the PR, wait before merging.
- Link the task ID in branch names, commit messages, issues, and PRs. Record approved increments in this plan.
- Coordinate separate task ownership with the teammate; avoid concurrent edits to shared files. Establish merge responsibility and PR review conventions together.
- Configure available main-branch protections to require PRs and successful checks. Keep secrets and real personal data out of Git.

## Feature inventory and ordered increments

M2 means proposed next-milestone scope; Final means the complete MVP after M2. Each row is a separately reviewable increment. Dependencies indicate previously accepted increments.

| ID | Increment | Target | Depends on | Acceptance criteria |
| --- | --- | --- | --- | --- |
| CS-001 | Project foundation and collaboration documentation | M2 | — | Both teammates can follow README setup; environment example and ignore rules exist; traceability and review workflow documented. No push before approval. |
| CS-002 | Responsive application shell and role navigation | M2 | CS-001 | Worker and manager screens are navigable at phone and desktop widths; demo content is clearly identified. Navigation does not grant authorization. |
| CS-003 | JSON data model and storage adapter | M2 | CS-001 | Business, user, shift, and coverage-request records have stable IDs; seeded fictional data can be loaded; JSON survives restart; writes are serialized and files replaced safely. |
| CS-004 | Manager signup and business creation | M2 | CS-002, CS-003 | Valid signup creates a manager in a new business; passwords are hashed; duplicate/invalid input is rejected; users cannot self-enroll into another business as manager. |
| CS-005 | Login, logout, sessions, and authorization | M2 | CS-004 | Both seeded roles can log in; logout invalidates the session; unauthenticated and wrong-role routes are blocked server-side; business boundaries are enforced; mutation requests have CSRF protection. |
| CS-006 | Worker upcoming-shifts view | M2 | CS-005 | Worker sees only their assigned shifts with dates, times, and clear empty states. |
| CS-007 | Manager dashboard and milestone walkthrough | M2 | CS-005, CS-006 | Manager sees their business's shifts and a pending-coverage area; every proposed page can be reached; unfinished actions are clearly labeled; both-role milestone demo works. |
| CS-008 | Worker management | Final | CS-007 | Manager can add workers safely and view their roster; worker credentials are handled through a documented setup flow; workers cannot manage staff or grant roles. |
| CS-009 | Shift creation and assignment | Final | CS-008 | Manager creates valid shifts for workers in the same business; invalid dates, times, and assignments are rejected server-side. |
| CS-010 | Shift editing and deletion | Final | CS-009 | Manager can edit/delete eligible shifts; linked coverage requests are handled consistently; invalid changes cannot leave orphaned records. |
| CS-011 | Request and cancel coverage | Final | CS-010 | Worker can open a request for their own future shift and cancel an eligible request; duplicates and requests on another worker's shifts are rejected. |
| CS-012 | Open-shift board | Final | CS-011 | Workers see eligible open requests only within their business; own, expired, and unavailable requests cannot be claimed. |
| CS-013 | Claim coverage with live conflict detection | Final | CS-012 | Claim displays an immediate no-reload overlap warning; server independently checks eligibility and conflicts; concurrent claims cannot produce multiple active claimants. |
| CS-014 | Manager approval and rejection | Final | CS-013 | Approval transfers assignment exactly once; rejection leaves original assignment unchanged and reopens the request; authorization and conflicts are rechecked at approval. |
| CS-015 | Coverage status and history | Final | CS-014 | Both workers and managers can understand open, pending, approved, rejected, and cancelled outcomes; history records actor and time within the business. |
| CS-016 | Security and workflow verification | Final | CS-015 | Verify cross-business denial, role restrictions, tampered IDs, overlapping shifts, concurrent claims, stale approvals, validation, and session protections. Core checks also accompany relevant earlier increments. |
| CS-017 | Accessibility and responsive polish | Final | CS-015 | Keyboard use, labels, readable errors, mobile layouts, and loading/empty states work through the core loop. Apply basic accessibility from CS-002 onward. |
| CS-019 | Remove and deactivate employees | Final | CS-017 | Delete only unreferenced employees; deactivate with access revoked and history retained; block unresolved assignments/claims; confirm scoped atomic changes. |
| CS-020 | Request recovery and independent Schedule loading | Final | CS-019 | Saved schedule/Refresh independent of roster; bounded reads/writes and body parsing; draft retention, explicit uncertain-save reconciliation, late-response isolation and regression/browser checks. |
| CS-022 | Expired coverage handling | Final | CS-020 | Derive expiry at shift start, separate actionable approval count/list from expired History, preserve stored status/events/assignment and verify exact boundaries and scope. |
| CS-018 | Deployment and final submission package | Final | CS-016, CS-017, CS-019 | Deployment supports persistent JSON storage and sessions; documented demo works; report, actual AI collaboration log, security review, and approved release tag are ready. Release publication requires user approval. |

## Milestone priority

Do CS-001 through CS-007 first, subject to the official rubric. Prioritize the authentication/data foundation and navigable role screens before final-MVP mutation workflows. Do not present placeholder buttons as completed functionality. The roadmap is an order of work, not a promise that every increment fits before the deadline; review after confirming the deadline and available time.

## Data and workflow decisions

Suggested records: businesses; users with business ID and role; shifts with assigned worker, start/end timestamps, and business ID; coverage requests with original worker, claimant, status, reviewer, and timestamps. Keep a business timezone and compare timestamps consistently.

Proposed request lifecycle: open -> pending approval -> approved. Rejection records the rejected claim and returns the request to open; eligible cancellation closes it. Original assignment remains in effect until approval. Define permissions for cancelling pending claims and editing shifts with pending requests before CS-010/CS-011.

Use a server storage layer such as `usersRepository`, `shiftsRepository`, and `coverageRepository` rather than file access scattered through route handlers. Keep authorization in server-side services. For JSON storage, make claim/approval read-check-write operations exclusive in the supported single-server deployment. Do not assume this design supports multiple server instances.

## Supabase decision

Recommended course version: semantic HTML/CSS/JavaScript, Node.js/Express if allowed by the course, server sessions, and JSON files behind repositories. Confirm the stack against the actual rubric.

The proposal explicitly says JSON files rather than SQL are required. Supabase Postgres would change that design; Supabase Auth would also change the proposed authentication approach. Defer both unless explicitly allowed. A repository interface makes later database migration manageable, but authentication, authorization policies, data migration, and deployment still require real work.

If the instructor permits Supabase and the team chooses it, integrate it before implementing persistent business workflows. Establish schema, migrations, authentication, business membership, and row-level security at that point. Do not postpone authorization until deployment.

Out of MVP scope: automatic scheduling, payroll, payments/subscriptions, SMS/email notifications, cross-business coverage, live AI features, and worker reliability scoring. Pricing and future moat ideas in the proposal do not imply implementation tasks.

## Tracking template

For every task record: ID, owner, status (planned / in progress / ready for user review / changes requested / approved / merged), acceptance checks, preview instructions, test results, approval reference, issue URL, and PR URL. Owner assignment remains unassigned until coordinated with the teammate. Keep an honest AI log as work happens; proposal statements about past implementation/security reviews are not evidence that those activities have occurred.

CS-007 completed in PR #14. CS-008 is tracked in issue #17 on branch `codex/CS-008-worker-management`: Team roster, add worker, and one-time account setup. User approved push and merge on 2026-11-13. Next increment: CS-009, manager shift creation and assignment.

CS-009: manager Schedule form and protected shift creation/assignment endpoint implemented on `codex/CS-009-shift-creation`, issue #19. Validation: 50 tests, syntax checks, desktop/mobile browser creation and worker visibility. User approved push and merge on 2026-11-16. Next task: CS-010, shift editing and deletion.

CS-010: issue #21, local branch `codex/CS-010-shift-edit-delete`. Edit/reassign or delete future shifts with no linked coverage requests; started shifts and all coverage-linked shifts remain locked. Stale revisions and overlaps rejected atomically. 59 tests pass; browser preview on port 3004. User approved push and merge on 2026-11-16. Next: CS-011, request and cancel coverage.

CS-011: issue #23, local branch `codex/CS-011-request-cancel-coverage`. Workers request coverage for own future shifts and cancel open/pending requests before start while still assigned. Cancellation preserves records/claimant and never transfers assignment. 66 tests pass; worker preview on port 3005. User approved push and merge on 2026-11-16. Next: CS-012, open-shift board.

CS-012: issue #25, local branch `codex/CS-012-open-shift-board`. Read-only worker board filters own/business/status/expiry server-side, shows business-local dates, duration and requesting teammate, and supports refresh/empty/retry states. 71 tests pass; worker preview on port 3006. User approved push and merge on 2026-11-16. Next: CS-013, claiming with live conflict detection.

CS-013: issue #27, local branch `codex/CS-013-claim-conflict-detection`. Immediate inline assigned/pending overlap checks, fresh server preflight, atomic claim-to-pending without reassignment, and scoped My requests claims. 80 tests pass; worker preview on port 3007. User approved push and merge on 2026-11-16. Next: CS-014, manager approval and rejection with fresh conflict checks.

CS-014: issue #29, local branch `codex/CS-014-manager-decisions`. Atomic approval transfers once after current authorization, revision, start-time and assigned/pending conflict checks. Rejection retains the reviewed claim as rejected and atomically opens a fresh request. Schema v3 adds rejected outcomes without altering v1/v2 records. 86 tests pass; fictional manager preview port 3008. Awaiting user approval before push/merge.

User explicitly approved CS-014 push and merge on 2026-11-17.

CS-015: issue #31, branch `codex/CS-015-coverage-history`. Manager business history and employee participant-only history, all five status filters, current assignment and chronological actor/time events. Schema v4 adds optional per-request history; existing data stays readable with honest legacy snapshots. 92 tests pass; fictional preview on port 3009. Awaiting user review before push/merge.

User explicitly approved CS-015 push and merge on 2026-11-17.

CS-016: issue #33, branch `codex/CS-016-security-workflow-verification`. Source security review and nine new HTTP integration checks cover complete lifecycle, business/role/CSRF guards, tampered IDs/bodies, races, stale approvals, session revocation/expiry, private paths, safe errors, production-origin headers and throttling. `npm run verify`: 101 tests pass plus syntax checks. No bypass found within checked scope; production behavior unchanged. Evidence and deployment limits in security-verification.md; isolated browser preview port 3010. Awaiting user approval before push/merge.

User explicitly approved CS-016 push and merge on 2026-11-17.

CS-017: issue #35, branch `codex/CS-017-accessibility-responsive`. Shared contrast/focus/control/reflow styles; labeled inline groups and Escape/focus return; focused create/edit validation; concise status live regions and refresh focus; setup/password accessibility. 101 tests and syntax checks pass; keyboard/320px/390px checks with long fictional content, preview port 3011. Awaiting user approval before push/merge.

User explicitly approved CS-017 push and merge on 2026-11-17. CS-018 remains the final step after CS-019 and remaining implementation work.

User instruction, 2026-11-17: CS-018 Deployment and submission is the very last step, after CS-019 and any further implementation tasks.

CS-019: issue #36, branch `codex/CS-019-employee-removal`, isolated worktree `/private/tmp/covershift-cs019-worktree`, based on merged CS-017. Employee deletion is restricted to no shift/coverage/history references. Deactivation clears login/setup access, preserves history and is blocked by current/upcoming assignments or pending claims on unended shifts. Inactive roster and assignment exclusion; current authorization/revision checks. 108 tests pass; fictional preview port 3012. Awaiting user approval before push/merge.

User explicitly approved CS-019 push and merge on 2026-11-17. CS-018 remains the final step.

CS-020: issue #40, branch `codex/CS-020-request-recovery`. Todo verified, then In Progress on 2026-11-18. Acceptance-report F-01 recovery fix; shared 15-second JSON deadlines and independent Schedule loading, no automatic mutation retries. Review evidence: request-recovery.md. CS-018 remains last.

CS-020 ready for Your review: 118 tests and syntax checks pass; browser delayed roster, working Schedule/Refresh, uncertain saved response with preserved draft and explicit reconciliation, Team timeout/filter/draft retry, cancelled-editor late response, bodyless logout, employee preflight and 320px recovery checks completed. No push/merge.

User explicitly approved CS-020 push and merge on 2026-11-18. CS-018 remains the final step.

CS-022: issue #42, branch `codex/CS-022-expired-coverage`. Todo verified, then In Progress on 2026-11-18. Derived Expired status for unresolved started coverage; actionable manager queue and expired History filter/deep links; both-role request labels; no data rewrite. 125 tests plus syntax/diff checks pass; fictional preview port 3016. Awaiting review before push/merge. CS-021 remains a suggestion, and CS-018 remains last.

User explicitly approved CS-022 push and merge on 2026-11-18. CS-021 remains an unstarted suggestion; CS-018 remains the final step.
