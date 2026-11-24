# AI collaboration log

Record assistance as it happens. Do not claim human review, tests, or results that have not occurred.

| Date | Task | Assistance | Verification / limitations |
| --- | --- | --- | --- |
| 2026-11-11 | Planning | Read proposal DOCX and drafted the feature roadmap. | Separate official rubric not available; course restrictions and milestone date remain provisional. |
| 2026-11-11 | CS-001 | Generated a minimal Node HTTP bootstrap, start page, and setup/collaboration documentation. | Server syntax passed; local HTTP checks confirmed the start page returns 200 and an unknown path returns 404. No authentication or business logic implemented. User review pending. |
| 2026-11-11 | CS-002 | Built responsive role navigation, seven demo screens, public CSS/JS serving, and setup updates. | Both JavaScript syntax checks and HTTP asset/404/405 checks passed. Browser checked all seven screens, direct-link refresh, active navigation, keyboard skip focus, and 390px layout. Fixed skip-link hash routing and mobile navigation fit during review. Demo only; no account authorization or persistence. Awaiting user review; not pushed. |
| 2026-11-11 | CS-002 approval | User approved publishing and merging the local preview. | Merged PR #4; issue #3 closed and board moved to Done. |
| 2026-11-11 | CS-003 | Generated versioned JSON schema, serialized atomic storage, scoped read repositories, fictional seed and inspection commands, and storage tests. | Nine tests passed covering fresh-process persistence, seed preservation, concurrent transactions, rollback, corrupt files, locks, complete reads during writes, scoped reads, and invalid relationships. Runtime records stay out of Git and HTTP; authentication and business workflows remain future increments. User review pending. |

CS-003 approval: the user approved the reviewed storage increment for publishing and merging. Syntax checks and all nine storage tests passed again before publication.

| Date | Task | Assistance | Verification / limitations |
| --- | --- | --- | --- |
| 2026-11-11 | CS-004 | Built manager signup form, validation, salted scrypt hashing, atomic business/account creation, and HTTP protections. Saved Todo-first tracking instruction. | All 15 tests passed. Browser verified blank errors, visibility toggle, success, duplicate email, navigation, keyboard focus, and 390px layout using isolated signup test data. No CS-004 push or merge; awaiting review. |

CS-004 approval: user reviewed the local signup feature and explicitly requested merging it. Syntax checks and all 15 signup/storage tests passed before publication.

CS-005: implemented login, opaque in-memory sessions, CSRF logout, protected role/business context, a real identity workspace shell, and explicit local demo credential setup. All 24 tests passed before final handoff, including real scrypt verification, expiry/rotation, logout, rate limiting, and role/business boundaries. Browser QA used isolated data and checked both roles, refresh, denial, demo isolation, new signup-to-login, and 390px layout. Fixed the retry button accessible name during browser QA. User review pending; no push/merge approved.

CS-005 approval: the user reviewed the local login/session feature and explicitly requested merging it into main. Syntax checks and all 24 tests passed again before publication.

CS-006: connected worker My shifts to a read-only authenticated endpoint and saved records, with exact current/upcoming selection, business-timezone formatting, and loading/empty/error/retry states. Added six shift test groups (30 total tests). Browser QA used isolated saved data to verify refresh/reload, empty results, error recovery, ongoing/overnight rows, and mobile layout. Fixed mobile badge spacing and explicit hidden-state CSS after inspection. Normal user records were unchanged. User review pending; no push or merge approved.

CS-006 approval: the user approved merging the worker shift view. Syntax checks and all 30 tests passed again before publication.

2026-11-13 — CS-007: resumed and completed validation of the manager dashboard, read-only schedule/approvals, and milestone walkthrough. Six new test groups bring the suite to 36 passing tests. Browser verified both roles, saved refresh/reload, empty and error/retry states, pending participants, disabled actions, and 390px layout using isolated data. Shared shift-card worker regression passed. Review fixture restored; normal records untouched. No push or merge; user approval pending.

2026-11-13 — CS-007 approval: the user reviewed the populated manager preview and explicitly requested merging it into main. Syntax checks and all 36 tests passed again before publication.

## 2026-11-13 — CS-008

Implemented manager-scoped worker roster/add-worker and single-use 24-hour setup links; workers choose their own passwords. Added backward-compatible schema v2 setup metadata and atomic consumption/reissue. Verified JavaScript syntax and 43 automated tests, including real scrypt signup/authentication, scope/CSRF/Origin protections, duplicate races, expiry/reuse/rotation, and preserving version 1 data. Browser review on an isolated local fixture added Casey Review and verified roster status and the setup landing page. Password completion was tested through the HTTP suite; no real worker credentials were entered through browser automation. User approval remains pending; branch has not been pushed or merged.

User approved CS-008 for push and merge on 2026-11-13 after the local preview.

## 2026-11-16 — CS-009

Created issue #19 with acceptance criteria, verified Todo then In Progress. Implemented local manager shift creation/assignment, atomic same-business and overlap checks, business-timezone UTC conversion and strict DST/calendar validation. Added seven meaningful tests; all 50 tests pass, JavaScript syntax and diff checks pass. Browser checks on isolated fictional data verified saved assignment/counts, reload persistence, worker My shifts visibility, overlap rejection with entries retained, keyboard focus and 390px mobile layout. User approval and publication remain pending.

User reviewed the working manager preview and approved CS-009 push and merge on 2026-11-16.

## 2026-11-16 — CS-010

Created issue #21, verified Todo then In Progress. Implemented manager edit/reassignment/deletion for future shifts without any linked coverage request; retained all coverage history and locked started shifts. Added transaction-level stale revision protection and shared CS-009 assignment/time/conflict checks. All 59 tests pass, including nine added edit/delete tests; syntax and diff checks pass. Browser used isolated fictional data on port 3004 to save an overnight reassignment, confirm prefilled fields, reject overlap without clearing drafts, verify deletion confirmation/cancel/focus and check a 390px mobile editor. Actual deletion verified in HTTP tests; browser preview kept signed in as manager. User approval pending; nothing pushed or merged.

User reviewed CS-010 and explicitly approved push and merge on 2026-11-16.

## 2026-11-16 — CS-011

Created issue #23, verified Todo then In Progress. Implemented worker-owned request/cancel services and My shifts/My requests UI, before-start eligibility, open/pending cancellation policy, unchanged assignment and retained claimant/history. Added atomic duplicate and stale-state checks with shared session/role/business/Origin/JSON/CSRF protections. All 66 tests pass, syntax and diff checks pass. Browser on isolated fictional data at port 3005 created a request, cancelled a pending request, verified retained claimant/assignment and confirmation focus, and checked a 390px mobile cancellation layout. Preview remains signed in as worker. User approval pending; nothing pushed or merged.

User reviewed CS-011 and explicitly approved push and merge on 2026-11-16.

## 2026-11-16 — CS-012

Created issue #25, verified Todo then In Progress. Implemented read-only worker Open shifts board and a scoped endpoint filtering own, foreign, started/expired, claimed and closed requests. Cards show teammate, local dates, duration and stable earliest-first order. All 71 tests pass; syntax and diff checks pass. Browser on isolated fictional data at port 3006 verified populated/empty board, cancellation and fresh-request refresh, service-error retry recovery and 390px layout without overflow. Preview remains signed in as worker. No claim action implemented (CS-013). User approval pending; nothing pushed or merged.

User reviewed CS-012 and explicitly approved push and merge on 2026-11-16.

## 2026-11-16 — CS-013

After user approval, merged CS-012 in PR #26, verified issue #25 closed/Done and synced main. Created CS-013 issue #27 and verified Todo then In Progress. Implemented immediate client UTC overlap warnings, fresh server claim checks, atomic pending claims preserving assignment, pending-claim time reservations and worker claim visibility. All 80 tests pass; nine claiming tests rerun with exact adjacency also pass. Browser on isolated fictional port 3007 verified assigned/pending conflicts, pending claim and My requests, confirmation cancellation/focus, stale cancellation rejection at final submission and a 390px mobile layout. CS-013 remains local and awaits user approval before push/merge.

User reviewed CS-013 and explicitly approved push and merge on 2026-11-16.

## 2026-11-17 — CS-014

User requested manager approval/rejection. Created issue #29 with acceptance criteria and owner; verified Todo then In Progress before implementation. Implemented exclusive review transactions, scoped protected endpoints, confirmed manager actions, rejected-record retention/reopening with schema v3, and worker outcome labels. Full suite: 86 passing tests; syntax checks passed. Fictional isolated preview on port 3008; browser approval/rejection/conflict checks and phone layout. Awaiting user review; no push/merge.

User explicitly approved CS-014 push and merge on 2026-11-17.

## 2026-11-17 — CS-015

User requested coverage status/history. Created issue #31 with acceptance criteria/owner; verified Todo then In Progress before implementation. Added transactional per-request history in v4, preserving legacy snapshots without inventing actors/times; protected participant/business history endpoints and shared History UI with filters and current assignment. Full suite 92 passing tests; syntax/diff checks passed. Fictional local preview on port 3009. Manager timeline/filter and employee phone checks. Awaiting approval before push/merge.

User explicitly approved CS-015 push and merge on 2026-11-17.

## 2026-11-17 — CS-016

User requested security/workflow verification. Created issue #33 with acceptance criteria and owner, verified Todo then In Progress. Reviewed authorization, session/setup, rendering and storage paths; added nine HTTP integration tests covering full lifecycle, foreign IDs/role/CSRF/input matrices, competing actions, stale approvals, session expiry/revocation, private files/error disclosure, HTTPS Origin/cookie/header behavior and throttling. No bypass found in tested scope; production behavior unchanged. Added `npm run verify` and evidence/limits report. 101 tests and syntax checks pass; diff check clean. Isolated fictional preview port 3010: browser approval, assignment/history and literal HTML-like title verified. Awaiting user approval before push/merge.

User explicitly approved CS-016 push and merge on 2026-11-17.

## 2026-11-17 — CS-017

User requested accessibility/responsive polish. Created issue #35 with acceptance criteria/owner; verified Todo then In Progress. Improved shared focus/contrast/phone controls/navigation/reflow, password/setup labels, create/edit field errors, confirmation groups/Escape and refresh focus; reduced repeated list announcements. 101 regression tests and syntax checks pass, diff clean. Browser verified skip link, error focus/Tab, editor and worker/manager Escape return, refreshed focus, 320px employee/manager reflow and 390px manager long-name confirmation. Selected contrast ratios calculated; no claim of full screen-reader/WCAG audit. Fictional preview port 3011, data isolated. Awaiting approval before push/merge.

User explicitly approved CS-017 push and merge on 2026-11-17. CS-018 remains the final step after CS-019 and remaining implementation work.

## 2026-11-17 — CS-019 and CS-017 approval

User requested employee removal/deactivation and instructed CS-018 remain the final step; saved in AGENTS.md/plan. Created CS-019 issue #36 and isolated worktree so pending CS-017 stayed separate. User then explicitly approved CS-017, which was pushed/merged in PR #37, issue closed and board Done. Brought untouched CS-019 branch forward to that merge. Verified CS-019 Todo then In Progress. Implemented scoped atomic deletion/deactivation, work/history blockers, v5 metadata, access/setup revocation and assignment exclusion with confirmation/filter UI. 108 tests pass. Fictional local preview port 3012; delete confirmation cancelled with Escape; Jamie deactivation and inactive roster verified. Awaiting CS-019 review; no CS-019 push/merge.

User explicitly approved CS-019 push and merge on 2026-11-17. CS-018 remains the final step.

## 2026-11-18 — CS-020 request recovery

User selected CS-020 from the acceptance report. Created issue #40 with acceptance criteria, verified Todo on the project, then moved In Progress. Implemented shared 15-second JSON deadlines (including body parsing and ignored-abort/late-response isolation), independent saved Schedule loading, retry/focus and uncertain-save reconciliation across frontend calls. Browser integration found and corrected module script tags for authentication pages; bodyless logout explicitly covered. Ten new tests plus the existing suite: 118 pass. Fictional browser fault injection verified delayed roster, Schedule Refresh, saved-but-delayed response with exactly one record/draft retained, Team filter/draft recovery, cancelled editor remaining closed, phone reflow and auth/employee checks. Fault injection is temporary QA-only; real records untouched. CS-020 ready for Your review with preview on port 3015 and documentation in request-recovery.md. No branch push or merge; explicit user approval pending. CS-018 remains the final step.

## 2026-11-18 — CS-022 expired coverage

User deferred CS-021 as a suggestion and selected CS-022. Created issue #42 with acceptance criteria, verified Todo then moved In Progress. Implemented read-time expiry at shift start for open/pending records, manager actionable approval separation and expired history count/link, both-role History filter/deep links and worker labels. Original JSON workflow states, events and assignments remain unchanged; existing decision guards preserved. Seven new expiry tests and the full suite pass: 125 tests, syntax/diff checks. Browser verified manager mixed queue/counts/history/filter/reload/focus, owner/claimant labels, participant-only history and 320px reflow using separate fictional data. Preview on port 3016; no feature push/merge. CS-021 unstarted, CS-018 final.

## 2026-11-20 — CS-031A AI-assisted manager shift drafting

User selected GPT-6 Luna, a small grading-period budget, and explicitly requested CS-031A. They entered their key privately in the Desktop checkout's ignored `.env`; its value was never displayed, copied into source, or committed. Created issue #44 with acceptance criteria/owner; verified Todo, then In Progress before implementation on `codex/CS-031A-ai-shift-drafts`.

Implemented server-only Responses structured extraction, minimized scoped context and fresh validation, no AI data writes, explicit suggestion/apply/manual-save UI, clarification by amended description, cancellation/late-response isolation and manual fallback. Added conservative persisted per-data-directory lifetime/per-manager daily reservations plus route/concurrency/input/output/deadline limits. Official API documentation informed the request format. An initial live smoke asked for a title already present as “Opening service”; refined instructions and retested successfully. Six optional paid fictional evaluation cases all passed. These checks do not guarantee arbitrary language accuracy.

`npm run verify`: syntax checks and 136 tests pass (11 new AI checks); diff check clean. Browser used isolated fictional data on 3017, verified no save at generation/apply, explicit edited save/count/employee visibility, clarification, Escape/focus and 320px no horizontal overflow. Separate fake-provider QA on 3018 verified failures preserve description/manual form, cancelled late replies stay hidden, and bounded timeout recovery without additional charges. Evidence/setup/limits: `docs/ai-shift-drafting.md`. CS-031A awaits user review; no push/merge. CS-031B remains separate, CS-018 last.


## 2026-11-20 — CS-031A chat revision

User requested replacing the inline helper with a persistent bottom-left AI chat, then confirmed the scope and explicitly started CS-031A. Updated issue #44 acceptance criteria and returned Your review -> In Progress; original Todo verification remains recorded. Same unpushed feature branch. Implemented a shared signed-in workspace launcher and accessible desktop/mobile dialog, bounded follow-up context (no provider/server conversation persistence), scoped tab-session state/reset/logout, explicit draft card -> editable Schedule handoff, and confirmation before replacing manual form entries. Workers see a truthful future-capability message, with no manager composer or provider calls. Model/service/shift-save authorization and conservative usage controls remain in force.

Full verification: 141 tests and syntax checks pass, including five new history/scoping/state/transfer tests. Two new paid fictional evaluations passed: a short answer completes the earlier request; a correction updates hours while retaining date/worker. Real-provider browser confirmed the clarification/answer/card flow, cross-page Schedule handoff and focus, no automatic save, manual-entry protection, retained chat across reload/navigation, logout/worker isolation, 320px full-screen reflow, keyboard focus wrapping and Escape return. Fake-provider QA verified retained unsent text on failure and New chat invalidating delayed replies. Documentation and new evidence in ai-shift-drafting.md / cs031a-chat-evidence. Awaiting review again; no push/merge. Future CS-031B rules, CS-031C manager-approved matching, CS-031D both-role notifications; CS-018 last.


## 2026-11-20 — CS-031A user stories and acceptance audit

User requested user stories and an assessment of whether CS-031A meets all of them. Defined 14 CS-031A-USxx stories with acceptance criteria and evidence in `docs/acceptance/cs031a/USER-STORIES.md`, against clean product commit f95cc9c. Reran syntax/full suite: 141 pass. Fresh browser checked all five manager launchers, real complete draft and clarification/short-answer conversation, keyboard scrolling in clarification state, 320x760 dimensions, manual Keep protection and an edited explicit save (fictional schedule count 1 -> 2). Keyboard scrolling initially appeared unchanged during animation; after settling, Tab focused the implicit scroll region and Page Up reached the top, so no false defect was recorded. Found a real post-save feedback gap: reopened chat still says Draft / Nothing saved after Schedule confirms creation. Result: 13 pass, US05 partial; F01 proposed correction includes handoff correlation and safe handling of edited/unrelated/uncertain saves. No application code changed or fix claimed. Current task stays Your review; no push/merge. VoiceOver, other browser engines and physical mobile keyboard remain additional verification, not asserted failures.


## 2026-11-21 — CS-031A-US05 / F01 correction

User explicitly requested the post-save chat completion fix. Updated issue #44 criteria, returned Your review -> In Progress (original Todo verification remains recorded), and stayed on the same unpushed CS-031A branch. Added client-only opaque draft identity/captured form handoff, matching confirmed server receipts with actual edited fields, created-card/schedule link, updated assistant message and persisted scoped completion; failed/uncertain and stale/reset/unrelated outcomes cannot claim success. Uncertain responses have a separate Save not confirmed card and retain the existing manual reconciliation requirement. No backend schema/provider/permission changes or automatic retries.

Eight new regressions bring the full suite to149 passing tests plus syntax. Fake-provider browser verified edited title/worker/hours, close/reload/navigation, unrelated Keep/manual save, definite rejection, committed once but delayed response leading to honest uncertainty (including reload), and New chat while an earlier save response was delayed. The local real-provider preview separately uses fictional data. Updated the historical user-story audit with a dated correction/retest rather than erasing F01; all14 stories now pass within documented scope. No push/merge; user review pending. CS-031B/C/D remain separate; CS-018 last.

User explicitly approved CS-031A, including the US05 completion fix and review evidence, for push and merge on 2026-11-21. Next increment: CS-031B employee availability rules; CS-031C/D remain separate and CS-018 remains last.


## 2026-11-21 — CS-031B-1 employee existing-shift search and confirmed requests

User explicitly started CS-031B-1 after refining the employee roadmap: find an existing opening, show exact details, and obtain employee confirmation before submitting a request; manager approval remains required. Created issue #46 with eight user stories/acceptance criteria, verified Todo, then moved to In Progress before creating `codex/CS-031B-1-chat-shift-requests`. CS-031A is merged PR #45. Future rules are CS-031B-2; matching and notifications remain CS-031C/D; deployment CS-018 stays last.

Implemented bounded, minimized GPT-6 Luna criteria extraction and current deterministic scoped search; optional explicit availability bounds/title, own/foreign/started/claimed/conflicting exclusions, honest no-match/full count with ten-card display limit and manual fallback. Worker composer now uses the existing launcher/dialog; fresh Review → Cancel / Confirm invokes existing protected preflight/atomic claim services. Search never writes, automatic retries are absent, and assignment still requires manager approval. Shared provider transport and persistent allowance preserve manager behavior. Cached criteria require fresh matches after navigation; pending/uncertain receipts are scoped to the tab account. Uncertainty is persisted before the write and replaces the old assistant message, including interrupted/reloaded submissions.

Validation: 161 tests (149 existing + 12 new) and syntax checks pass. Seven real-provider fictional cases pass with no database changes during search. Browser confirms results, cancellation/no write, explicit request, submitted receipt, worker My requests and manager Approvals queue with original assignment preserved. Separate fake-provider browser verifies 409 rejection, committed response delayed beyond the 15-second client deadline, uncertainty after reload, immediate reload during a second submission, and New chat discarding a delayed search. 320×760 reflow and Tab/Shift+Tab/Escape checks pass within the documented scope. Acceptance report and screenshots in docs/acceptance/cs031b-1; usage guide in docs/ai-employee-shift-search.md. Local real-provider preview 3020 uses separate fictional data. No feature push/merge before user review approval.

User explicitly approved CS-031B-1 push and merge on 2026-11-22. Next proposed increment: CS-031B-2 confirmed employee availability rules (view/pause/cancel); CS-031C matching and CS-031D notifications remain separate. CS-018 remains last.


## 2026-11-22 — CS-031B-2 confirmed employee availability rules

User explicitly started CS-031B-2 after approving/merging CS-031B-1 in PR #47. Created issue #48 with six user stories and scope boundaries, verified Todo then moved In Progress before creating the local feature branch. Added explicit worker Chat task selection separating existing-shift search from availability drafting; task changes reset context. GPT-6 Luna produces strict, minimized, dated rule proposals with visible one-claim/whole-day defaults. Only Confirm availability persists a rule. Added private saved list, pause/resume and confirmed cancellation, derived expiry, bounded counts/horizon, server confirmation order, idempotent nonce, revisions and current membership checks. Version 6 upgrades only on confirmed write and preserves legacy records. Team removal revisions include rules, and deactivation cancels rules atomically. Matching and notifications explicitly remain unavailable until CS-031C/D; CS-018 stays last.

Verification: syntax and 174 tests pass (13 new). Eight real-provider fictional examples pass with no database writes during interpretation. Browser verified cancellation/no save, explicit confirmation/receipt, reload, pause/resume/Keep/confirmed cancellation. Isolated fake-provider QA covers rejected save and committed-but-delayed save: client shows uncertainty with no repeated action, persists warning over reload, and fresh saved list reconciles exactly one rule. 320px mobile dimensions and Tab/Shift+Tab/Escape focus checks pass within documented limits. Local real preview port3022; acceptance evidence in docs/acceptance/cs031b-2 and guide docs/ai-availability-rules.md. No branch push or merge before user review approval.

User explicitly approved CS-031B-2 push and merge on 2026-11-22. Next increment is CS-031C: deterministic availability matching and automatic coverage requests, with fresh conflict checks and manager approval before assignment. CS-031D notifications remains separate; CS-018 stays last.


## 2026-11-22 — CS-031C automatic matching

User explicitly started this focused increment after asking about remaining credit. Created issue #50 with criteria before work, verified Todo then In Progress; local branch `codex/CS-031C-automatic-matching`. Reused final manual claim checks through `claimInDatabase`, with a deterministic matcher and immutable successful-match ledger committed atomically. Rules are ordered by confirmation, openings by shift start/creation/ID. Full window/title, current membership/timezone, own-shift, count and conflict checks; prior rejection/attempt excludes repeating the same worker/shift across reopened IDs/overlapping rules. Counts consume successful submissions including later rejected/cancelled outcomes. Application transaction adapter triggers immediately after saved changes; normal startup and 30-second non-overlapping reconciliation cover existing data and background matching without AI calls. Updated rule DTO/UI with capacity and current match status, explicit automatic-request consent and manager-approval requirement. Notifications remain separate.

189 tests and syntax pass (15 new) including concurrency, manual pending conflicts, rejection/reopen, original cancellation, approval, expiry, schema corruption/rollback, periodic execution/overlap/error/stop and private HTTP result scope. Browser fictional flow: Jamie auto-requested → manager rejects → Sam auto-requested → manager approves (assignment transfers only then); Alex opens afternoon coverage → Jamie auto-requested within remaining capacity. Restart preserves ledger and counts without duplicates. Documentation/evidence in docs/automatic-matching.md and docs/acceptance/cs031c. No paid AI inference is needed by matching, no new provider evaluation claimed, no feature push/merge before user approval. CS-031D next; CS-018 last.

CS-031C is ready in Your review (2026-11-22): 189 tests pass, fictional browser/restart/mobile checks documented in `docs/acceptance/cs031c/`. Preview port3024. Issue #50 remains open; no feature push or merge before explicit user approval.

User explicitly approved CS-031C push and merge on 2026-11-22. Next increment: CS-031D employee and manager notifications. CS-018 deployment/submission remains last.

## 2026-11-22 — CS-031D notifications

User requested employee/manager notifications after CS-031C merged PR #51. Issue #52 acceptance criteria recorded; Todo verified, then In Progress verified before implementation. Implemented atomic private event receipts, bell/inbox, read controls, role-scoped links and recovery/mobile states on `codex/CS-031D-notifications`. Targeted + full regression/browser evidence recorded in `docs/acceptance/cs031d/`. No paid provider calls. Local preview only; user approval required before push/merge. CS-018 remains last.

## 2026-11-23 — CS-032 schedule questions

User chose CS-032 from the nine Todo AI proposals. Issue #54 Todo and In Progress verified before feature work, scope refined in issue. Added structured question parsing with minimized provider context and fresh server-side schedule calculations, 31-day bound, next-shift selection, DST/overnight hours, same-business manager full-name resolution, private employee scope, pending claim distinction and read-only saved detail links. Added both-role Chat task and recovery/persistence integration. Official Structured Outputs documentation consulted. Initial live next-week failure/overclarification prompted explicit server-derived calendar anchors; final 8/8 live cases pass. 214 automated checks pass. Fictional preview port3027; no feature push/merge before user review.

## 2026-11-23 — CS-039 Summary cards

User selected Summary cards, reviewed four response examples, and authorized implementation. Reused Todo issue #61, recorded selected design criteria before work, verified Todo then In Progress. Implemented a shared safe DOM card hierarchy across read-only answers, manager drafts/correlated receipts, availability and coverage preflight/confirmed/uncertain states. Reduced duplicate paragraphs while preserving bounded conversation context and existing protected workflows. Added composer sample buttons, native details/privacy, concise statuses and reading/focus adjustments. Controlled browser QA uses real saves/claims/rules and temporary lost-ack proxy; no fault hooks or provider prompt changes in product. Browser checking found an empty-next rendering error, fixed and rechecked. Awaiting explicit review approval before push/merge.

## 2026-11-23 — CS-021 demo preparation

User selected implementation of demo preparation. Created issue #65 with acceptance criteria and verified Todo then In Progress before implementation. Added fixed isolated managed demo storage, fresh-run preparation preserving previous records, strictly upcoming Toronto scenarios through real workflow services, generated dated walkthrough and loopback full-application launcher. Public fictional credentials and separate role hostnames support presentation in one browser. Existing private AI config stays process-local; usage persists outside scenario runs. Nine new checks; all 223 pass. Browser rehearsed real schedule AI answer, manager approval, automatic pending match and employee notifications, then prepared and opened a pristine run. Both normal data fingerprints unchanged. Ready for user review; no push or merge authorized. No deployment work.


## 2026-11-24 — Backlog dependency order and renumbering

User requested reprioritizing all seven unstarted AI proposals plus four requested scheduling features. Renamed existing GitHub issues in place to CS-045–055, preserving issue links/history and recording former aliases and prerequisites in every issue. No implementation started. Test baseline precedes leave/availability/duties/publication; AI expansion follows stable scheduling semantics and confirmation behavior, with atomic batches late. Current mapping recorded in implementation-plan.md and working instructions; historical completed IDs, CS-021 review and final CS-018 remain unchanged.


## 2026-11-24 — Continuous completed-to-future numbering correction

User clarified they want all completed tasks consecutively, then all remaining tasks consecutively, not a fresh ID range. Renamed original implementation issues to CS-001–027 in merge order, demo preparation to CS-028 (still Your review), unstarted backlog to CS-029–039 in dependency order, and final deployment to CS-040 (new tracking issue #70 for the existing final scope). Issue numbers/URLs, states, approvals and historical PR/evidence names preserved. Previous identities retained in each issue and current register; superseded duplicate issues #15/#16 are not implementation increments. No implementation or merge authorized by this administrative change.

## 2026-11-24 — CS-028 merge approval

User explicitly approved merging demo preparation, now CS-028 / issue #65. Reviewed implementation and requested task-register documentation included; historical cs021 evidence retained. Pre-merge regression verification repeated with temporary localhost test-server permissions. Next task is CS-029; no new implementation started.


## 2026-11-24 — CS-029 acceptance baseline

User selected CS-029 after choosing baseline tests before future AI expansion. Issue #62 criteria updated, Todo then In Progress verified. Implemented stable fictional conversation corpus against real protected HTTP routes and injected recorded provider replies, with temporary validated stores, isolated usage/session fixtures, named assertions, safe HTML/JSON reporting and failing exit status. Clarified offline-versus-real-model and client-receipt-discard limitations. Two initial harness expectation mistakes corrected against existing routes/response contracts; no product behavior weakened. Final targeted and CLI 18/18 scenarios / 137 checks pass; full syntax/243 tests pass. Negative scoring and CLI exits checked, normal database fingerprints unchanged, local browser report details verified. No paid provider calls, no new chat features, no push/merge before review approval.

## 2026-11-24 — CS-029 merge request

User requested merging the reviewed CS-029 baseline. Clean branch, 243 passing tests and unchanged scope verified against current main before push/PR. Approval applies only to issue #62; no new feature started. Real-model language evaluation remains separately opt-in.


## 2026-11-24 — CS-030 employee time off

User selected CS-030 and explicitly confirmed full/partial days, future pending/approved cancellation and approval blocked until overlapping assigned shifts/pending claims are resolved. Issue #66 scope recorded before coding; Todo then In Progress verified. Added validated schema9 requests/history, actor/privacy/revision/idempotency services, both-role Time off navigation/forms/filters/confirmations, uncertainty/read reconciliation, shared leave-aware eligibility and offboarding retention. Extended offline corpus with CS029-C19. 268 tests and 19 scenarios / 148 checks pass. Browser validated partial/full/multi-day outcomes, conflict blockers, assignment denial, approve/reject/cancel, temporary proxy real lost acknowledgement/read retry and both-role320px/keyboard controls. Browser findings fixed full-day reset labeling and stale read-error display; no fault hooks shipped. Preview uses fictional isolated storage and separate cookies; normal account data unchanged. No paid inference during QA. Ready for review, no push/merge authorized.
