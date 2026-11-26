# CoverShift implementation plan

**Current numbering/status (2026-11-24): CS-001–037 are completed; CS-045 is in local review; CS-038–039 are Todo; CS-044 is completed; CS-040 is completed; CS-041 Quiet Workspace is completed; CS-042 notification panel is completed; CS-043 deployment/submission is last.** This continuous sequence replaces every earlier task-ID scheme. Resolve older references by issue number and the mapping below. Renumbering changes no issue state, implementation, merge history or approval.


Current update (2026-11-24): CS-031 issue #67 is closed/Done, merged PR #74 (`0e3455d778ac92c5a909a4954277474805588a11`). User selected CS-040 Request cover (#75); Todo was verified before In Progress. User approved merging CS-040 on 2026-11-24 after 316 passing tests and a clean browser walkthrough. Merged PR #76 (`0e60396fa96479f8ee16d2dc984f04a900f2d490`); issue #75 closed and project Done verified. Evidence: docs/acceptance/cs040. Deployment issue #70 is renamed CS-041 and remains last. Earlier CS-040 deployment references in historical logs resolve to #70 / current CS-041.

## Assistant conversation reliability

Implement one increment at a time. CS-043 deployment remains last.

| Task | Acceptance criteria | Tracking |
| --- | --- | --- |
| CS-048 Conversation regression baseline | Run real demo prompts through repeatable checks. Cover both roles, follow-ups, missing details and coworker calendar boundaries. Fix the deterministic routing failures found by these cases and provide a preview. | [#95](https://github.com/EldarSadeghi/soen287-covershift/issues/95), merged in #96 |
| CS-049 Intent routing | Handle unfamiliar paraphrases and mixed requests through a fixed set of role-allowed workflows. Ask a focused question when intent is unclear. Preserve explicit confirmation. | [#97](https://github.com/EldarSadeghi/soen287-covershift/issues/97) |
| CS-050 Follow-up context | Keep selected shifts and reviewed dates, hours and filters across search, explanation and alternatives. Verify ambiguous and stale references. | [#99](https://github.com/EldarSadeghi/soen287-covershift/issues/99) |
| CS-051 Clearer answers and recovery | Show grounded facts and one useful next action. Cover empty, stale, pending and uncertain outcomes with keyboard, mobile and screen-reader checks. | [#101](https://github.com/EldarSadeghi/soen287-covershift/issues/101) |
| CS-052 Live-model checks and speed | Evaluate natural phrasing, date handling and follow-ups with fictional data and an opt-in live provider. Measure time to progress and answer, and report failures separately from offline results. | [#103](https://github.com/EldarSadeghi/soen287-covershift/issues/103) |

CS-048 adds 19 deterministic tests. Browser review on port 3056 confirmed “Who’s free Friday?” returns November 27, and “Who’s free December first?” shows Alex Morgan’s confirmed window. Existing offline provider fixtures remain scripted.

## Current consecutive task register

| Current ID | Task | Status | GitHub issue | Previous ID | Merged PR |
| --- | --- | --- | --- | --- | --- |
| CS-001 | Project foundation | Done | [#2](https://github.com/EldarSadeghi/soen287-covershift/issues/2) | CS-001 | #1 |
| CS-002 | Responsive worker and manager navigation | Done | [#3](https://github.com/EldarSadeghi/soen287-covershift/issues/3) | CS-002 | #4 |
| CS-003 | JSON data model and storage adapter | Done | [#5](https://github.com/EldarSadeghi/soen287-covershift/issues/5) | CS-003 | #6 |
| CS-004 | Manager signup and business creation | Done | [#7](https://github.com/EldarSadeghi/soen287-covershift/issues/7) | CS-004 | #8 |
| CS-005 | Login, logout, sessions, and protected access | Done | [#9](https://github.com/EldarSadeghi/soen287-covershift/issues/9) | CS-005 | #10 |
| CS-006 | Worker upcoming shifts from saved data | Done | [#11](https://github.com/EldarSadeghi/soen287-covershift/issues/11) | CS-006 | #12 |
| CS-007 | Manager dashboard and milestone walkthrough | Done | [#13](https://github.com/EldarSadeghi/soen287-covershift/issues/13) | CS-007 | #14 |
| CS-008 | Worker management and account setup | Done | [#17](https://github.com/EldarSadeghi/soen287-covershift/issues/17) | CS-008 | #18 |
| CS-009 | Manager shift creation and assignment | Done | [#19](https://github.com/EldarSadeghi/soen287-covershift/issues/19) | CS-009 | #20 |
| CS-010 | Manager shift editing and deletion | Done | [#21](https://github.com/EldarSadeghi/soen287-covershift/issues/21) | CS-010 | #22 |
| CS-011 | Request and cancel coverage | Done | [#23](https://github.com/EldarSadeghi/soen287-covershift/issues/23) | CS-011 | #24 |
| CS-012 | Open-shift board | Done | [#25](https://github.com/EldarSadeghi/soen287-covershift/issues/25) | CS-012 | #26 |
| CS-013 | Claim coverage with live conflict detection | Done | [#27](https://github.com/EldarSadeghi/soen287-covershift/issues/27) | CS-013 | #28 |
| CS-014 | Manager approval and rejection | Done | [#29](https://github.com/EldarSadeghi/soen287-covershift/issues/29) | CS-014 | #30 |
| CS-015 | Coverage status and history | Done | [#31](https://github.com/EldarSadeghi/soen287-covershift/issues/31) | CS-015 | #32 |
| CS-016 | Security and workflow verification | Done | [#33](https://github.com/EldarSadeghi/soen287-covershift/issues/33) | CS-016 | #34 |
| CS-017 | Accessibility and responsive polish | Done | [#35](https://github.com/EldarSadeghi/soen287-covershift/issues/35) | CS-017 | #37 |
| CS-018 | Remove and deactivate employees | Done | [#36](https://github.com/EldarSadeghi/soen287-covershift/issues/36) | CS-019 | #38 |
| CS-019 | Request recovery and independent schedule loading | Done | [#40](https://github.com/EldarSadeghi/soen287-covershift/issues/40) | CS-020 | #41 |
| CS-020 | Expired coverage handling | Done | [#42](https://github.com/EldarSadeghi/soen287-covershift/issues/42) | CS-022 | #43 |
| CS-021 | AI chat interface and manager shift drafting | Done | [#44](https://github.com/EldarSadeghi/soen287-covershift/issues/44) | CS-031A | #45 |
| CS-022 | Find and request an existing shift through chat | Done | [#46](https://github.com/EldarSadeghi/soen287-covershift/issues/46) | CS-031B-1 | #47 |
| CS-023 | Confirmed employee availability rules | Done | [#48](https://github.com/EldarSadeghi/soen287-covershift/issues/48) | CS-031B-2 | #49 |
| CS-024 | Automatic availability matching and coverage requests | Done | [#50](https://github.com/EldarSadeghi/soen287-covershift/issues/50) | CS-031C | #51 |
| CS-025 | Employee and manager in-app notifications | Done | [#52](https://github.com/EldarSadeghi/soen287-covershift/issues/52) | CS-031D | #53 |
| CS-026 | Schedule questions through AI chat | Done | [#54](https://github.com/EldarSadeghi/soen287-covershift/issues/54) | CS-032 | #63 |
| CS-027 | Clearer AI action cards and conversation guidance | Done | [#61](https://github.com/EldarSadeghi/soen287-covershift/issues/61) | CS-039 | #64 |
| CS-028 | Repeatable demo preparation and presentation walkthrough | Done | [#65](https://github.com/EldarSadeghi/soen287-covershift/issues/65) | CS-021 | #71 |
| CS-029 | Repeatable AI conversation acceptance tests | Done | [#62](https://github.com/EldarSadeghi/soen287-covershift/issues/62) | CS-045 | #72 |
| CS-030 | Employee time-off requests | Done | [#66](https://github.com/EldarSadeghi/soen287-covershift/issues/66) | CS-046 | #73 |
| CS-031 | Show employee availability | Done | [#67](https://github.com/EldarSadeghi/soen287-covershift/issues/67) | CS-047 | #74 |
| CS-032 | Daily shift duties and employee task list | Done | [#68](https://github.com/EldarSadeghi/soen287-covershift/issues/68) | CS-048 | #81 |
| CS-033 | Monday publication of a two-week schedule | Done | [#69](https://github.com/EldarSadeghi/soen287-covershift/issues/69) | CS-049 | #82 |
| CS-034 | Refine AI drafts conversationally | Done | [#57](https://github.com/EldarSadeghi/soen287-covershift/issues/57) | CS-050 | #83 |
| CS-035 | Manage employee availability rules through chat | Done | [#60](https://github.com/EldarSadeghi/soen287-covershift/issues/60) | CS-051 | #86 |
| CS-036 | Explain availability matches and scheduling conflicts | Done | [#55](https://github.com/EldarSadeghi/soen287-covershift/issues/55) | CS-052 | #87 |
| CS-037 | Suggest eligible alternative shifts | Done | [#56](https://github.com/EldarSadeghi/soen287-covershift/issues/56) | CS-053 | #88 |
| CS-038 | Manager batch shift creation through chat | Your review | [#58](https://github.com/EldarSadeghi/soen287-covershift/issues/58) | CS-054 | — |
| CS-039 | AI working-week and attention summaries | Your review | [#59](https://github.com/EldarSadeghi/soen287-covershift/issues/59) | CS-055 | — |
| CS-040 | Request cover from a coworker | Done | [#75](https://github.com/EldarSadeghi/soen287-covershift/issues/75) | New | #76 |
| CS-041 | Quiet Workspace interface | Done | [#77](https://github.com/EldarSadeghi/soen287-covershift/issues/77) | New | #78 |
| CS-042 | Quiet notification panel | Done | [#79](https://github.com/EldarSadeghi/soen287-covershift/issues/79) | New | #80 |
| CS-044 | Use one AI chat without a task selector | Done | [#84](https://github.com/EldarSadeghi/soen287-covershift/issues/84) | New | #85 |
| CS-045 | Improve chat intent routing and search context | Your review | [#89](https://github.com/EldarSadeghi/soen287-covershift/issues/89) | New | — |
| CS-053 | Harden AI intent fallback, usage counting and request code | Done | [#127](https://github.com/EldarSadeghi/soen287-covershift/issues/127) | New | #128 |
| CS-054 | Measure AI intent routing with a labelled evaluation set | Done | [#129](https://github.com/EldarSadeghi/soen287-covershift/issues/129) | New | #130 |
| CS-055 | Fix AI routing problems found by the evaluation | Your review | [#131](https://github.com/EldarSadeghi/soen287-covershift/issues/131) | New | — |
| CS-043 | Deployment and final submission | Todo | [#70](https://github.com/EldarSadeghi/soen287-covershift/issues/70) | CS-040 / CS-018 | — |

CS-001–037, CS-040–042 and CS-044 are complete. CS-045 is the conversation quality follow-up before CS-038 and CS-039. CS-043 final deployment remains last. Each increment requires local user review and explicit merge approval. Stable issue numbers preserve historical task mappings.

Time off and publication must update existing manual and AI paths within those increments. Approved leave participates in current assignment/claim/approval/matching checks. Unpublished schedules must not leak through employee views, chat answers, search, rules, notifications or matching. Clarify the Monday window/legacy-shift handling before CS-033. Chat confirmations and uncertain-save protections remain required; atomic batch saves do not implicitly publish.

Earlier optional suggestions without issues (formerly CS-023–029) remain historical ideas only, outside the current sequence. Their former IDs now refer to different current tasks; use feature names when reconsidering them. The former deployment ID CS-018 now means completed employee removal; deployment is exclusively CS-041 / issue #70.

## Historical plan and previous numbering — superseded

Everything below preserves earlier planning snapshots and aliases. Use the current register above for all new work.

**Current backlog order (2026-11-24): CS-045 → CS-055**, as listed in “Dependency-based implementation order” below. CS-021 remains in Your review; CS-018 is always last. Older entries below are historical snapshots; former unstarted IDs are retired aliases, not additional work.

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
| CS-031A | AI-assisted manager shift drafting | Extension | CS-009, CS-020 | Manager-only bounded structured AI suggestions, clarification, explicit apply/review/save, current validation, private key and persisted usage allowance; manual fallback, provider evaluation and mobile/keyboard checks. |
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

Original MVP exclusions: automatic scheduling, payroll, payments/subscriptions, SMS/email notifications, cross-business coverage, and worker reliability scoring. User-approved extension CS-031A adds manager AI drafting with review before saving; employee availability remains a separate future CS-031B increment. Pricing and future moat ideas in the proposal do not imply implementation tasks.

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

CS-031A: issue #44, branch `codex/CS-031A-ai-shift-drafts`. Todo verified then In Progress on 2026-11-20. User selected OpenAI GPT-6 Luna and privately configured a project key; US$5 usage target, auto-reload off. Manager-only single-shift drafting; CS-031B employee availability remains separate. CS-022 was merged in PR #43. CS-018 remains last.

CS-031A ready for Your review: 136 tests and syntax/diff checks; six real-provider fictional evaluation cases passed; browser generation/apply/save/employee, clarification, cancellation, failure/timeout and 320px checks documented in ai-shift-drafting.md. Local preview 3017; no push/merge without explicit approval.


CS-031A chat revision: user approved the revised interface and roadmap on 2026-11-20. Issue #44 updated before work, returned from Your review to In Progress (original Todo verification retained). Persistent bottom-left launcher, desktop/mobile dialog, bounded natural follow-up conversation, scoped tab-session history and explicit editable Schedule review, protecting manual entries. Same local branch; no push/merge approval. Five new conversation/state tests bring the full suite to 141; two live multi-turn cases passed. CS-031B/C/D are separate future increments: confirmed employee rules, deterministic matching with manager approval, then both-role in-app notifications. CS-018 stays last.

CS-031A chat revision returned to Your review after the documented checks. Final preview 3017; no push or merge.

CS-031A user-story audit: 14 stories in `docs/acceptance/cs031a/USER-STORIES.md`; 13 pass, US05 partial due to stale unsaved chat card after confirmed creation (CS-031A-F01). Recommend correcting that completion feedback before merging; audit adds no product changes. 141 regression tests pass.

CS-031A-US05 / F01 correction, 2026-11-21: user requested fix; issue #44 acceptance criteria updated, Your review -> In Progress. Added correlated confirmed-save receipts and explicit uncertainty in chat, with final edited values and removal of stale Review action. 149 tests pass, targeted browser scenarios pass; story report now records 14/14 passing within checked scope. Same unpushed branch, pending user review.

CS-031A-US05 correction returned to Your review after final checks on 2026-11-21; local real-provider preview3017 shows the saved completion. No push/merge.

User explicitly approved CS-031A, including the US05 completion fix and review evidence, for push and merge on 2026-11-21. Next increment: CS-031B employee availability rules; CS-031C/D remain separate and CS-018 remains last.


CS-031A was merged in PR #45 on 2026-11-21; issue #44 is closed and Done. The user split the employee work into CS-031B-1 (existing-shift search/request) and CS-031B-2 (confirmed future availability rules). CS-031C matching and CS-031D notifications remain separate. CS-018 stays last.

CS-031B-1: issue #46, branch `codex/CS-031B-1-chat-shift-requests`. Acceptance criteria/user stories recorded before implementation. Todo verified before moving to In Progress on 2026-11-21. Worker chat extracts one business-local day with optional explicit availability bounds/title, deterministically searches current saved openings and excludes own/conflicting requests. Separate Review request → Cancel / Confirm request uses protected read-only preflight and existing atomic claim workflow. Manager approval remains required; no new notifications, future rules, auto-assignment or database schema. Pending/uncertain receipts, fresh matching after navigation, same-tab isolation, shared provider transport and persistent allowance. See `docs/acceptance/cs031b-1/USER-STORIES.md` for validation and preview.

CS-031B-1 moved to Your review after 161 passing tests, seven real-provider cases, and documented browser/keyboard/mobile/recovery checks. The issue remains open; no branch push or merge. Preview: http://localhost:3020/workspace/worker/shifts.

User explicitly approved CS-031B-1 push and merge on 2026-11-22. Next proposed increment: CS-031B-2 confirmed employee availability rules (view/pause/cancel); CS-031C matching and CS-031D notifications remain separate. CS-018 remains last.

CS-031B-1 merged in PR #47 on 2026-11-22; issue #46 closed as completed and board Done verified. CS-031B-2 started as issue #48 after Todo verification then In Progress. Local branch `codex/CS-031B-2-availability-rules`; acceptance criteria recorded before implementation. Separate employee chat task prepares one dated window, optional title and bounded claim count; explicit confirmation saves schema-v6 rules. Saved list, pause/resume/cancel, derived expiry, confirmation idempotency/order, scope/revision guards and deactivation integration. No matching/claims or notifications; CS-031C/D and final CS-018 remain separate. Usage/evidence: `docs/ai-availability-rules.md`.

CS-031B-2 local implementation ready for Your review: 174 tests and syntax pass; eight real-provider fictional cases; browser lifecycle, rejected/uncertain saves and mobile/keyboard checks documented in docs/acceptance/cs031b-2. Preview port3022, no push/merge.

User explicitly approved CS-031B-2 push and merge on 2026-11-22. Next increment is CS-031C: deterministic availability matching and automatic coverage requests, with fresh conflict checks and manager approval before assignment. CS-031D notifications remains separate; CS-018 stays last.

CS-031B-2 merged in PR #49; issue #48 closed and Done verified. CS-031C started as issue #50 after Todo verification then In Progress, on `codex/CS-031C-automatic-matching`. Deterministic eligible-rule matching uses earliest confirmation order; same atomic final claim checks; persistent v7 ledger for capacity/no repeat; transaction adapter plus startup/30-second reconciliation; saved availability shows used/remaining and current matched request status. 189 tests pass (15 new). Browser validates rejection to next employee, approval-only assignment and newly opened coverage. See docs/automatic-matching.md / docs/acceptance/cs031c. No push/merge before explicit user approval. CS-031D and final CS-018 remain separate.

CS-031C is ready in Your review (2026-11-22): 189 tests pass, fictional browser/restart/mobile checks documented in `docs/acceptance/cs031c/`. Preview port3024. Issue #50 remains open; no feature push or merge before explicit user approval.

User explicitly approved CS-031C push and merge on 2026-11-22. Next increment: CS-031D employee and manager notifications. CS-018 deployment/submission remains last.

### CS-031D — Employee and manager in-app notifications

Issue #52; local branch `codex/CS-031D-notifications`. Private workspace bell, exact unread total, paged saved receipts, selected/displayed read controls, scoped request-history links, atomic event projection for manual/automatic requests and manager outcomes. No paid inference or external delivery. Acceptance evidence: `docs/acceptance/cs031d/USER-STORIES.md`. Await explicit review approval before push/merge. CS-018 stays last.

### CS-032 — Schedule questions through AI chat

Issue #54 selected by user on 2026-11-23. Todo verified, then In Progress. Local `codex/CS-032-schedule-questions`: both-role read-only next/date/week/hour questions, server-calculated scope/totals, pending-claim distinction, saved detail links and clarification/recovery. Fourteen new checks; 214 tests pass. Final live provider cases 8/8 pass after calendar-context correction; initial failures retained in evidence. See `docs/acceptance/cs032/USER-STORIES.md`. Await review approval before push/merge. CS-033–040 remain Todo suggestions and CS-018 remains last. CS-031D is complete, merged PR #53 / issue #52.

### CS-039 — Summary cards and clearer response guidance

Issue #61 selected on 2026-11-23 after user chose Summary cards and approved four response examples. Todo verified then In Progress; branch `codex/CS-039-summary-cards`. Short structured schedule/next, manager draft/completion, availability and coverage cards; separated consent/status, native expandable notes, task-specific prompts, reading space and private conversation preservation. Existing workflow/confirmation services unchanged. See `docs/acceptance/cs039/USER-STORIES.md` for evidence. CS-032 is merged PR #63 / issue #54. CS-018 remains last.

### CS-021 — Demo preparation

User selected the previously deferred suggestion on 2026-11-23. Issue #65 acceptance criteria recorded, Todo verified then In Progress; branch `codex/CS-021-demo-preparation`. Added isolated repeatable fictional runs, relative-date service-generated scenarios, two role URLs, dated walkthrough, production/path/staleness guards and loopback launcher with persistent AI usage. Normal records and prior demo runs preserved. 223 tests pass; real-provider/browser rehearsal and fresh reset recorded in `docs/acceptance/cs021/USER-STORIES.md`. Ready for Your review; no push/merge before explicit user approval. CS-039 is complete, PR #64 / issue #61. CS-018 stays last.

### Requested scheduling extensions — initial IDs, 2026-11-24

Superseded by the renumbering table below; links still identify the same issues.

User requested four additions to the backlog. These are planning tasks, not started implementations; each will follow the usual individual branch, local review and explicit push/merge approval. CS-018 remains last.

| ID / GitHub issue | Feature | Planned outcome |
| --- | --- | --- |
| [CS-041 / #66](https://github.com/EldarSadeghi/soen287-covershift/issues/66) | Employee time-off requests | Employees request leave; manager approves/rejects; approved intervals participate in assignment and claim checks. Existing shifts require explicit resolution, never silent deletion/reassignment. |
| [CS-042 / #67](https://github.com/EldarSadeghi/soen287-covershift/issues/67) | Show employee availability | Manager selects a date/time and sees available, unavailable and unknown workers, with saved reasons and approved leave/conflicts respected. Lack of a rule is not proof of availability. |
| [CS-043 / #68](https://github.com/EldarSadeghi/soen287-covershift/issues/68) | Daily shift duties and employee task list | Manager attaches duties to shifts; assigned workers see their duties for the day. Duties follow the shift after approved coverage. |
| [CS-044 / #69](https://github.com/EldarSadeghi/soen287-covershift/issues/69) | Monday publication of a two-week schedule | Manager prepares drafts and publishes a dated two-week schedule, with Monday deadline visibility and audited later changes. |

Suggested order: CS-041 → CS-042 → CS-043 → CS-044, one reviewable increment at a time. Acceptance criteria and open decisions are recorded in each issue. Before implementation confirm partial-day leave/cancellation rules, general availability entry versus automatic-claim rules, whether daily tasks mean shift duties, and which two weeks Monday publication covers. Proposed publication is manual with a due indicator; automatic publication is not assumed. Completion checkboxes, payroll/leave balances, recurring templates and external delivery remain separate scope unless selected.


### Dependency-based implementation order — 2026-11-24

Saved GitHub view: [Implementation order](https://github.com/users/EldarSadeghi/projects/1/views/4), filtered to Todo and sorted by task title ascending. All eleven task statuses verified after reload.

User requested reordering and renumbering to reduce rework and improve quality. All eleven unstarted issues were renamed in place; issue numbers/URLs and history remain unchanged. Completed IDs (including CS-039), CS-021 in review and final CS-018 are unchanged. New IDs begin at CS-045 to avoid collisions with historical references. Every item remains Todo; this planning change starts no implementation.

First review the existing CS-021 increment and decide its merge separately. Then proceed in this order:

| Order | Current ID / issue | Former ID (retired) | Task | Prerequisites |
| --- | --- | --- | --- | --- |
| 1 | [CS-045 / #62](https://github.com/EldarSadeghi/soen287-covershift/issues/62) | CS-040 | Repeatable AI conversation acceptance tests | CS-021 review decision |
| 2 | [CS-046 / #66](https://github.com/EldarSadeghi/soen287-covershift/issues/66) | CS-041 | Employee time-off requests | CS-045 |
| 3 | [CS-047 / #67](https://github.com/EldarSadeghi/soen287-covershift/issues/67) | CS-042 | Show employee availability | CS-046 |
| 4 | [CS-048 / #68](https://github.com/EldarSadeghi/soen287-covershift/issues/68) | CS-043 | Daily shift duties and employee task list | CS-047 |
| 5 | [CS-049 / #69](https://github.com/EldarSadeghi/soen287-covershift/issues/69) | CS-044 | Monday publication of a two-week schedule | CS-046, CS-047, CS-048 |
| 6 | [CS-050 / #57](https://github.com/EldarSadeghi/soen287-covershift/issues/57) | CS-035 | Refine AI drafts conversationally | CS-045, CS-049 |
| 7 | [CS-051 / #60](https://github.com/EldarSadeghi/soen287-covershift/issues/60) | CS-038 | Manage employee availability rules through chat | CS-047, CS-050 |
| 8 | [CS-052 / #55](https://github.com/EldarSadeghi/soen287-covershift/issues/55) | CS-033 | Explain availability matches and scheduling conflicts | CS-047, CS-049, CS-051 |
| 9 | [CS-053 / #56](https://github.com/EldarSadeghi/soen287-covershift/issues/56) | CS-034 | Suggest eligible alternative shifts | CS-050, CS-052 |
| 10 | [CS-054 / #58](https://github.com/EldarSadeghi/soen287-covershift/issues/58) | CS-036 | Manager batch shift creation through chat | CS-048, CS-049, CS-050, CS-053 |
| 11 | [CS-055 / #59](https://github.com/EldarSadeghi/soen287-covershift/issues/59) | CS-037 | AI working-week and attention summaries | CS-049, CS-051, CS-052, CS-054 |

The dependencies are deliberate scheduling choices; independent work is still implemented one increment at a time. Tests first establish the baseline. Time off then feeds shared eligibility, availability and all existing assignment/claim/approval/matching paths. Duties are defined before publication and batch creation. Publication must update existing employee reads, AI questions/search/rules, notifications and coverage checks within that increment so drafts cannot leak or become actionable. Define legacy-shift migration and Monday window before implementation.

After that, stabilize conversational refinement and explicit confirmations, then availability lifecycle actions, explanations, alternative suggestions and finally atomic batch writes. Summaries come after the data and workflows they summarize. More tests are added with each feature; the baseline task does not claim future features already work. Every increment retains authorization, same-business scope, fresh eligibility checks, uncertain-save recovery, accessible local review and explicit user approval before pushing/merging. A finite passing suite reduces risk but does not guarantee absence of bugs.

CS-023–029 remain optional earlier suggestions outside this selected sequence; CS-030 notifications were covered by CS-031D. CS-018 remains the final deployment/submission step after approved implementation work and final regression checks.


### CS-029 — Repeatable AI workflow acceptance baseline

User selected issue #62 on 2026-11-24. Acceptance criteria recorded; Todo verified then In Progress on `codex/CS-029-ai-acceptance-tests`. One offline command, 18 fictional conversations / 137 checks, real protected services with recorded provider replies and temporary storage, HTML/JSON reports, negative scorer/CLI checks and extension guidance. Full syntax/regression: 243 tests pass. Browser report preview3036. Actual model language evaluation remains separately opt-in; no paid calls or production UI/workflow changes. Normal database fingerprints unchanged. Evidence: docs/acceptance/cs029/USER-STORIES.md. Ready for Your review; no push or merge before explicit user approval. CS-028 merged PR #71 / issue #65 Done. Next CS-030; deployment CS-040 stays last.


### CS-030 — Employee time-off requests

Issue #66 selected 2026-11-24, confirmed policy recorded before implementation, Todo verified then In Progress. Local branch codex/CS-030-employee-time-off. Dedicated both-role Time off pages, full/partial leave, confirmation/idempotency/revisions, private notes/history, schema9, blockers, shared approved-leave scheduling eligibility and offboarding integration. 268 tests pass; offline corpus expanded to 19 scenarios / 148 checks. Both-role browser, lost-ack reconciliation, read retry and mobile/keyboard evidence in docs/acceptance/cs030/USER-STORIES.md. Ready for Your review; no push/merge before explicit approval. CS-029 merged PR #72. Next CS-031; CS-040 remains last.


CS-031 (#67), `codex/CS-031-employee-availability`: user selected separate employee availability windows on 2026-11-24. Todo verified before In Progress. Local confirmation/withdrawal and read-only manager status/reasons implemented; general windows never activate automatic rules. 284 tests pass; desktop/320px, empty, error/retry and lost-save acknowledgement checks documented in `docs/acceptance/cs031/USER-STORIES.md`. Preview3039, isolated fictional data. Ready for Your review; no push or merge without explicit approval. CS-030 is merged PR #73; CS-040 remains last.

CS-031 UI refinement approved for local implementation on 2026-11-24, explicitly requiring another review before merge. Mockup applied to manager summary/filter/compact roster and employee form/window history; 285 tests pass, browser recovery/overnight/withdrawal/320px and tablet checks documented in `docs/acceptance/cs031/USER-STORIES.md`. Status Your review. User has NOT approved push/merge of CS-031. Preview3039 remains running.

CS-031 coworker visibility extension (2026-11-24) supersedes earlier manager-only status visibility: employees may query active same-business peers, excluding self, via My availability/Coworkers. Only derived name/status/generic reasons; no private cause, raw windows or contact information. Local implementation ready for Your review: 290 tests, browser filter/own-draft/confirmation guard/read retry/320px checks. Preview3039 employee now uses fictional Alex; manager Morgan at localhost. No push/merge approval.

CS-031 next14-day extension (2026-11-24): coworker Upcoming windows automatically lists derived free intervals grouped by peer, subtracting commitments and preserving private causes. Own view uses same rest-of-today+13-local-date horizon with Later availability/history and explicit whole-record withdrawal on clipped cards. Exact-period checker retained. 296 tests pass; browser auto-list/read retry/own later/clipped withdrawal/320px documented in `docs/acceptance/cs031/USER-STORIES.md`. Your review, not pushed/merged. Preview3039 preserved, Alex employee.

User explicitly approved all current CS-031 changes for push/merge on 2026-11-24, including manager/employee UI, coworker visibility, next14-day free windows, later/history retention and acceptance evidence (296 tests). Earlier no-merge requests are superseded by this approval. After verified merge, add Request cover as a Todo planning task only; do not implement it yet. Final deployment/submission must remain last.


CS-040 (#75) selected 2026-11-24 on `codex/CS-040-request-cover`. User confirmed one pending invitation per shift, open-board competition and manager approval after coworker acceptance. Local implementation includes full-window eligibility, review/confirmation, private note/inbox/notifications, accept/decline/cancel, stale expiry and lost-ack reconciliation. 314 tests pass; real browser send/accept/approve/decline/cancel, dropped-response recovery, read retry, 320px and Escape return-focus checks documented in docs/acceptance/cs040/USER-STORIES.md. Isolated fictional previews3041/3042; normal data preserved. Board Your review, issue open. No push or merge authorized; CS-041 remains last.


User explicitly approved CS-040 push/merge on 2026-11-24. Completed PR #76, merge SHA `0e60396fa96479f8ee16d2dc984f04a900f2d490`; issue #75 closed/completed and board Done verified. 316 tests pass; clean Dec3 browser send→accept→approve→persisted transfer passed. This approval/completion supersedes earlier local-review snapshots. CS-032–039 remain Todo; next planned task CS-032 Daily shift duties (#68), not started. CS-041 deployment/submission remains last.


Authoritative update 2026-11-24: User selected Quiet Workspace implementation. New CS-041 issue #77; deployment issue #70 is now CS-042 and remains last, superseding earlier deployment041 aliases. Branch `codex/CS-041-quiet-workspace`, Todo verified then In Progress. Shared responsive shell/icons/typography and compact cover cards/Active-History/progress implemented locally. 316 tests pass; desktop/mobile320px/keyboard/confirmation and manager shell checks documented in docs/acceptance/cs041/USER-STORIES.md. Preview3041 employee/localhost3041 manager. Your review; no push/merge authorized.

User explicitly approved CS-041 merge on 2026-11-24. Merged PR #78 (`041bb66baf0f4bc467eb1da8f0dff1469d485008`), issue #77 closed/completed and board Done verified. 316 tests pass. Earlier review-only snapshots are superseded. CS-042 deployment remains last. Notification redesign suggestions requested only; no implementation selected.


Authoritative 2026-11-24 update: CS-042 Quiet notification panel (#79) selected after approved Bell panel concept; Todo verified then In Progress. Local grouping/current-status metadata, compact anchored/mobile panel, All/Unread, loaded-history/paging/read recovery implemented. 322 tests pass; browser desktop320px/keyboard/uncertain saved read/GET retry/manager/logout checks in docs/acceptance/cs042/USER-STORIES.md. Your review; no push/merge authorized. Deployment #70 now CS-043 and remains last; earlier CS-042 deployment references are superseded.

User explicitly approved CS-042 merge on 2026-11-24. PR #80 merged as `af00c3d95c5313cf0aa9e76e5f8865889d9c89c5`; issue #79 closed/completed and board Done verified. 322 tests pass. Earlier local-review notes are superseded. Recommended next CS-032 Daily shift duties (#68), not started. CS-043 deployment remains last.


Current CS-032 (#68) local review, 2026-11-24: manager shift duties, employee day filter and coverage retention implemented on `codex/CS-032-shift-duties`. 327 tests pass; see `docs/acceptance/cs032-duties/USER-STORIES.md`. Todo verified before In Progress; now Your review. Nothing pushed or merged. Explicit approval still required. CS-043 deployment remains last.


CS-032 approved and completed on 2026-11-24: user authorized push/merge after local review. PR #81 merged as `cd2412d17f88d2b9d292b30b80b47c6d8e8260dc`; issue #68 closed/completed and project Done verified. 327 tests pass. Earlier local-review status is superseded. Next planned task CS-033 Monday publication of a two-week schedule (#69), still Todo and not started. Confirm publication window and manual/automatic policy before implementation. CS-043 deployment remains last.


CS-033 (#69) selected on2026-11-24: user confirmed following-Monday14-day window and manual Publish with Monday due/overdue indicator. Todo verified then In Progress; branch `codex/CS-033-schedule-publication`. Local schema13 private staging, reviewed atomic publication, scoped employee receipts, audit/retry/conflict handling and legacy-preserving activation ready for Your review.337 tests pass; real browser private/read/publish/edit/notification/lost-ack/320px evidence in `docs/acceptance/cs033-publication/USER-STORIES.md`. Preview3048 manager/Alex,3049 additional login. No push/merge approved. CS-034–039 remain Todo; CS-043 deployment remains last.


CS-033 and the user-selected Week planner refinement are complete: user approved combined implementation/push/merge on2026-11-24; PR #82 merged as `5070caa85007b7f9818fe0acef75f50d5353c82f`. Issue #69 closed/completed and project Done verified.341 tests pass; create/edit preset/validation/overnight/320px checks passed. Earlier review-only notes for this scope are superseded. Next planned task CS-034 conversational AI draft refinement (#57), still Todo, not started. CS-043 deployment remains last.
