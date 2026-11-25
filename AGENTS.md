# CoverShift working instructions

## Authoritative current identities — 2026-11-24

**Current numbering/status (2026-11-24): CS-001–033 are completed; CS-034–039 are Todo; CS-040 is completed; CS-041 Quiet Workspace is completed; CS-042 notification panel is completed; CS-043 deployment/submission is last.** This continuous sequence replaces every earlier task-ID scheme. Resolve older references by issue number and the mapping below. Renumbering changes no issue state, implementation, merge history or approval.

User explicitly requested renumbering completed and future work into one consecutive sequence. **CS-043 Deployment and final submission is always last** (formerly CS-040 / CS-018). The existing local demo branch/evidence use historical CS-021 names; its current identity is **CS-028, issue #65, merged PR #71 / Done**. The user approved its push/merge on 2026-11-24. For all new work use the current register in docs/implementation-plan.md. Earlier CS-045–055 and old optional-proposal IDs are retired aliases.

CS-040 (#75) is completed: merged PR #76, issue closed and board Done verified. Remaining Todo sequence: CS-032 duties (#68), CS-033 Monday publication (#69), CS-034 refinement (#57), CS-035 chat rules (#60), CS-036 explanations (#55), CS-037 alternatives (#56), CS-038 batch creation (#58), CS-039 summaries (#59), CS-041 final deployment (#70). Completed tasks are CS-001–031; original PR/evidence names remain historical.


Current update (2026-11-24): CS-031 issue #67 is closed/Done, merged PR #74 (`0e3455d778ac92c5a909a4954277474805588a11`). User selected CS-040 Request cover (#75); Todo was verified before In Progress. User approved merging CS-040 on 2026-11-24 after 316 passing tests and a clean browser walkthrough. Merged PR #76 (`0e60396fa96479f8ee16d2dc984f04a900f2d490`); issue #75 closed and project Done verified. Evidence: docs/acceptance/cs040. Deployment issue #70 is renamed CS-041 and remains last. Earlier CS-040 deployment references in historical logs resolve to #70 / current CS-041.

## Workflow rules and historical log

Workflow rules remain applicable. Task IDs/status snapshots in the older log below are superseded by the current register above.

- Track every implementation task with its CS-xxx ID in a GitHub issue and on https://github.com/users/EldarSadeghi/projects/1.
- Add each new task to Todo first and verify it appears there. Then move it to In Progress and tell the user implementation has started. Status flow: Todo -> In Progress -> Your review -> Done. Mark Done only after the user's confirmation and approved merge.
- Implement one increment at a time on a `codex/CS-xxx-short-name` branch. Include acceptance criteria in the issue before implementation.
- Provide a local preview and relevant check results; move the task to Your review. Wait for explicit user approval before pushing any feature branch or merging it into main.
- After approval, open a PR targeting main with `Closes #<issue-number>`. Merge only within the approved scope. Verify the issue closes and its board status becomes Done.
- CS-001 is complete: issue #2, merged PR #1. CS-002 is complete: issue #3, merged PR #4. CS-003 is complete: issue #5, merged PR #6. CS-004 is complete: issue #7, merged PR #8. CS-005 is complete: issue #9, merged PR #10. CS-006 is complete: issue #11, merged PR #12. CS-007 is complete: issue #13, merged PR #14. CS-008 is complete: issue #17, merged PR #18. CS-009 is complete: issue #19, merged PR #20. CS-010 is complete: issue #21, merged PR #22. CS-011 is complete: issue #23, merged PR #24. CS-012 is complete: issue #25, merged PR #26. CS-013 is complete: issue #27, merged PR #28. CS-014 is complete: issue #29, merged PR #30. CS-015 is complete: issue #31, merged PR #32. CS-016 is complete: issue #33, merged PR #34. CS-017 is complete: issue #35, merged PR #37. CS-019 is complete: issue #36, merged PR #38. CS-020 is complete: issue #40, merged PR #41. CS-022 is complete: issue #42, merged PR #43. CS-031A is complete: issue #44, merged PR #45 on 2026-11-21. Consult docs/implementation-plan.md and docs/contributing.md for details.
- The GitHub connector has denied writes. Local Git authentication works; never print, persist, or expose credentials. GitHub Projects API access lacks project scopes; the signed-in browser can manage the board.

- User preference (2026-11-17): CS-018 Deployment and submission must be the very last step, after CS-019 and any remaining approved implementation work. CS-017 and CS-019 are merged. CS-020 is merged. CS-022 is merged. CS-031B-1 and CS-031B-2 are merged in PRs #47/#49; CS-031C automatic matching is the current increment. CS-021 remains an unstarted suggestion for possible future consideration.

- Approved AI roadmap: CS-031A persistent bottom-left chat and manager shift drafts; CS-031B employee confirmed availability/claim rules; CS-031C deterministic matching with manager approval and earliest confirmed eligible rule first; CS-031D in-app notifications for managers and employees. Implement/review/merge one increment at a time. User approved CS-031A push and merge on 2026-11-21; later increments still need their own review and approval.

- CS-031A-US05 / F01 completion-feedback fix is implemented locally (2026-11-21): correlated confirmed-save receipts and honest uncertain-save state, 149 tests pass, user-story report records 14/14 within checked scenarios. User explicitly approved this CS-031A increment for push and merge on 2026-11-21.

- CS-031B-1: issue #46, branch `codex/CS-031B-1-chat-shift-requests`. Todo verified then In Progress on 2026-11-21. Existing open shifts through employee chat, explicit confirmation submits pending manager approval. Future availability rules (CS-031B-2), automatic matching (CS-031C) and notifications (CS-031D) remain separate. No push/merge until explicit user approval.

- CS-031B-1 is ready in Your review (2026-11-21): 161 tests pass, real-provider and browser evidence in `docs/acceptance/cs031b-1/`. Local preview port 3020. Issue #46 remains open; no push or merge without explicit user approval.

User explicitly approved CS-031B-1 push and merge on 2026-11-22. Next proposed increment: CS-031B-2 confirmed employee availability rules (view/pause/cancel); CS-031C matching and CS-031D notifications remain separate. CS-018 remains last.

- CS-031B-1 is complete: issue #46, merged PR #47 on 2026-11-22. CS-031B-2 is issue #48, branch `codex/CS-031B-2-availability-rules`. Todo verified then In Progress on 2026-11-22. Dated rule drafts require explicit employee confirmation; saved private rules support pause/resume/cancel. Matching CS-031C and notifications CS-031D remain separate. No push or merge without explicit approval.

- CS-031B-2 ready for Your review: 174 tests and eight real-provider cases pass; browser confirmation/lifecycle/recovery/mobile evidence in `docs/acceptance/cs031b-2/`. Local preview 3022. Issue #48 stays open; wait for explicit user approval before push or merge.

User explicitly approved CS-031B-2 push and merge on 2026-11-22. Next increment is CS-031C: deterministic availability matching and automatic coverage requests, with fresh conflict checks and manager approval before assignment. CS-031D notifications remains separate; CS-018 stays last.

- CS-031B-2 is complete: issue #48, merged PR #49 on 2026-11-22. CS-031C is issue #50, branch `codex/CS-031C-automatic-matching`; Todo verified then In Progress. Automatic claims require manager approval; successful match ledger enforces count and no-repeat constraints. Notifications CS-031D and final deployment CS-018 remain separate.

CS-031C is ready in Your review (2026-11-22): 189 tests pass, fictional browser/restart/mobile checks documented in `docs/acceptance/cs031c/`. Preview port3024. Issue #50 remains open; no feature push or merge before explicit user approval.

User explicitly approved CS-031C push and merge on 2026-11-22. Next increment: CS-031D employee and manager notifications. CS-018 deployment/submission remains last.

- CS-031C is complete: issue #50, merged PR #51. CS-031D is issue #52, branch `codex/CS-031D-notifications`; Todo verified then In Progress on 2026-11-22. In-app employee/manager notifications implemented locally; acceptance in `docs/acceptance/cs031d/`. No push/merge until explicit approval. CS-018 remains last.

- CS-031D is in Your review (2026-11-23): 200 tests pass; browser manual approval, private employee receipt, read/uncertain recovery, empty state, logout, keyboard and 320px mobile checks recorded. Working isolated preview port3025, one afternoon match awaits a manager decision. Nothing pushed or merged; wait for explicit user approval.

User explicitly approved CS-031D push and merge on 2026-11-23. Approved scope: issue #52 employee/manager in-app notifications and its acceptance documentation. CS-018 deployment/submission remains last.

- CS-031D is complete: issue #52 closed and Done, merged PR #53 on 2026-11-23. CS-032 (issue #54) selected by user on 2026-11-23; Todo verified then In Progress; branch `codex/CS-032-schedule-questions`. Read-only assigned schedule/next/date/week/hours chat for both roles. Acceptance evidence `docs/acceptance/cs032/`; 214 tests, final 8/8 provider cases. CS-033–040 remain unstarted Todo proposals. No push/merge without explicit approval; CS-018 remains last.

- CS-032 is in Your review (2026-11-23): 214 tests pass, final 8/8 live-provider cases, browser employee/manager answers, preserved-message retry/reload, read-only selected shift links, keyboard/Escape focus and actual manager 320px viewport verified. Preview port3027 with isolated fictional accounts. Nothing pushed/merged; explicit approval required.

User explicitly approved CS-032 push and merge on 2026-11-23. After merge, propose clearer AI response UI options for user selection; do not implement a UI redesign until the user selects/approves it. CS-018 remains last.

- CS-032 is complete: issue #54 closed/Done, merged PR #63 on 2026-11-23. User selected Summary cards and approved implementing the four example response types. CS-039 is issue #61, branch `codex/CS-039-summary-cards`; selected acceptance criteria recorded and Todo verified before In Progress. Shared schedule/draft/availability/request cards preserve existing confirmations and uncertainty. Local review3028, controlled QA3029, evidence `docs/acceptance/cs039/`. No push/merge without explicit approval. CS-018 stays last.

- CS-039 local implementation ready for Your review: 214 regression tests pass; controlled browser checks cover all four card types, real form/claim/rule commits, cancellation, three lost-ack uncertain states, empty-next correction, owner isolation and rate-limit message retention. Real-provider review shows 7 assigned employee hours and a valid manager draft; 320px card fits without overflow and keyboard/Escape focus verified. Preview3028. No push or merge without explicit approval.

User explicitly approved CS-039 Summary cards push and merge on 2026-11-23. Approved scope is issue #61 and its verified UI/documentation increment. CS-018 remains the final deployment/submission task.

- CS-039 is complete: issue #61, merged PR #64. CS-021 Demo preparation selected on 2026-11-23: issue #65, `codex/CS-021-demo-preparation`, Todo verified then In Progress. Local repeatable fictional demo, two-role launcher and generated walkthrough; 223 tests pass and browser rehearsal/reset documented in `docs/acceptance/cs021/`. Ready for Your review; no push/merge without explicit approval. CS-018 remains the very last step. Demo commands: `npm run demo:prepare`, `npm run demo:start`; isolated `.covershift-demo/`, default port3035. Preserve normal accounts and previous runs.

- User requested backlog additions on 2026-11-24: CS-041 Employee time-off requests (#66), CS-042 Show employee availability (#67), CS-043 Daily shift duties and employee task list (#68), CS-044 Monday publication of a two-week schedule (#69). Acceptance criteria/open decisions are in GitHub issues. Planning only; no feature implementation started. Suggested order 041→042→043→044. Confirm publication window and manual/automatic policy before implementing CS-044. CS-018 remains last.


- Authoritative backlog renumbering (2026-11-24, user requested): CS-045 tests (#62, formerly040), CS-046 time off (#66, formerly041), CS-047 availability (#67, formerly042), CS-048 duties (#68, formerly043), CS-049 Monday two-week publication (#69, formerly044), CS-050 conversational refinement (#57, formerly035), CS-051 chat rule management (#60, formerly038), CS-052 explanations (#55, formerly033), CS-053 alternatives (#56, formerly034), CS-054 batch creation (#58, formerly036), CS-055 summaries (#59, formerly037). Old unstarted IDs are retired aliases; same issue numbers/history, no duplicate tasks. All remain Todo; planning only. Implement in 045→055 order after CS-021 review decision, one increment at a time. Baseline tests first, then core scheduling before AI expansion. Existing AI/manual paths must respect approved leave and publication within those core increments. Completed IDs stay unchanged, CS-021 remains Your review, CS-018 stays last. See current mapping in docs/implementation-plan.md.

- User explicitly approved CS-028 demo preparation (issue #65, former CS-021) for push/merge on 2026-11-24. Scope includes the reviewed demo implementation/evidence and user-requested backlog numbering documentation. Current branch renamed `codex/CS-028-demo-preparation`; historical `cs021` evidence paths remain valid. Next planned task is CS-029 AI conversation acceptance tests; no authorization to start it yet. CS-040 deployment stays last.


- CS-029 selected on 2026-11-24: issue #62 acceptance scope recorded, Todo verified then In Progress; branch `codex/CS-029-ai-acceptance-tests`. Local offline corpus now ready for Your review: 18 scenarios / 137 checks, 243 full tests pass. Command `npm run ai:acceptance` generates safe HTML/JSON reports using recorded provider replies, temporary fictional storage and real protected HTTP workflows. No paid calls or normal data changes; real-model semantic/browser limitations explicit. Evidence: docs/acceptance/cs029/USER-STORIES.md; local report preview3036. No push/merge before explicit approval. Next is CS-030 time off; CS-040 stays last.

- User requested merging CS-029 on 2026-11-24 after reviewing the completed baseline. Approved scope: issue #62, offline corpus/report/docs, 243 passing checks; no new product behavior. Next planned increment is CS-030 Employee time-off requests (#66), which still needs a start instruction. CS-040 remains last. Consult issue #62 / its linked PR for final merge status.


- CS-029 completed: issue #62 closed/Done, merged PR #72. CS-030 selected 2026-11-24, issue #66: Todo verified then In Progress, branch `codex/CS-030-employee-time-off`. User confirmed full/partial days, future pending/approved cancellation and approval blocked by unresolved shifts/pending claims. Ready for Your review: schema9/history, both-role pages/recovery, shared leave-aware create/edit/claim/matching/approval/AI guards, offboarding retention. 268 tests and 19 offline AI scenarios / 148 checks pass. Browser full/partial/multi-day, blockers, approve/reject/cancel, real lost-ack/read retry and 320px/keyboard verified; evidence docs/acceptance/cs030. Fictional preview3037, normal data preserved. No push/merge until explicit user approval. Next CS-031 availability; final CS-040 stays last.

- User explicitly approved CS-030 push/merge on 2026-11-24. Approved scope: issue #66, time-off implementation, shared eligibility, offboarding, review evidence and 268 passing tests. Next planned increment CS-031 Show employee availability (#67) still needs a start instruction. CS-040 remains the final task. Issue #66 / linked PR is the source for final merge status.


CS-031 (#67), `codex/CS-031-employee-availability`: user selected separate employee availability windows on 2026-11-24. Todo verified before In Progress. Local confirmation/withdrawal and read-only manager status/reasons implemented; general windows never activate automatic rules. 284 tests pass; desktop/320px, empty, error/retry and lost-save acknowledgement checks documented in `docs/acceptance/cs031/USER-STORIES.md`. Preview3039, isolated fictional data. Ready for Your review; no push or merge without explicit approval. CS-030 is merged PR #73; CS-040 remains last.

CS-031 UI refinement approved for local implementation on 2026-11-24, explicitly requiring another review before merge. Mockup applied to manager summary/filter/compact roster and employee form/window history; 285 tests pass, browser recovery/overnight/withdrawal/320px and tablet checks documented in `docs/acceptance/cs031/USER-STORIES.md`. Status Your review. User has NOT approved push/merge of CS-031. Preview3039 remains running.

CS-031 coworker visibility extension (2026-11-24) supersedes earlier manager-only status visibility: employees may query active same-business peers, excluding self, via My availability/Coworkers. Only derived name/status/generic reasons; no private cause, raw windows or contact information. Local implementation ready for Your review: 290 tests, browser filter/own-draft/confirmation guard/read retry/320px checks. Preview3039 employee now uses fictional Alex; manager Morgan at localhost. No push/merge approval.

CS-031 next14-day extension (2026-11-24): coworker Upcoming windows automatically lists derived free intervals grouped by peer, subtracting commitments and preserving private causes. Own view uses same rest-of-today+13-local-date horizon with Later availability/history and explicit whole-record withdrawal on clipped cards. Exact-period checker retained. 296 tests pass; browser auto-list/read retry/own later/clipped withdrawal/320px documented in `docs/acceptance/cs031/USER-STORIES.md`. Your review, not pushed/merged. Preview3039 preserved, Alex employee.

User explicitly approved all current CS-031 changes for push/merge on 2026-11-24, including manager/employee UI, coworker visibility, next14-day free windows, later/history retention and acceptance evidence (296 tests). Earlier no-merge requests are superseded by this approval. After verified merge, add Request cover as a Todo planning task only; do not implement it yet. Final deployment/submission must remain last.


CS-040 (#75) selected 2026-11-24 on `codex/CS-040-request-cover`. User confirmed one pending invitation per shift, open-board competition and manager approval after coworker acceptance. Local implementation includes full-window eligibility, review/confirmation, private note/inbox/notifications, accept/decline/cancel, stale expiry and lost-ack reconciliation. 314 tests pass; real browser send/accept/approve/decline/cancel, dropped-response recovery, read retry, 320px and Escape return-focus checks documented in docs/acceptance/cs040/USER-STORIES.md. Isolated fictional previews3041/3042; normal data preserved. Board Your review, issue open. No push or merge authorized; CS-041 remains last.

CS-040 review correction: user cancelled Monday’s accepted coverage, exposing overbroad anti-repeat guard. Cancelled invitations/linked cancelled coverage now allow a fresh eligible invitation; pending uniqueness, declined/expired restrictions and quotas remain. 315 tests pass; browser Monday Nov30 2–5 selectable again, left unsent. Evidence docs/acceptance/cs040/monday-cancelled-retry.jpg. Still Your review, no push/merge.

CS-040 December1 review: previous QA invitation declined, not a time-fit failure. Composer now gives specific declined-shift reason and participant-scoped invitation link. Decline restriction unchanged; 316 tests pass including scoped reason regression and browser proof docs/acceptance/cs040/declined-explanation.jpg. No push/merge authorization.


User explicitly approved CS-040 push/merge on 2026-11-24. Completed PR #76, merge SHA `0e60396fa96479f8ee16d2dc984f04a900f2d490`; issue #75 closed/completed and board Done verified. 316 tests pass; clean Dec3 browser send→accept→approve→persisted transfer passed. This approval/completion supersedes earlier local-review snapshots. CS-032–039 remain Todo; next planned task CS-032 Daily shift duties (#68), not started. CS-041 deployment/submission remains last.


Authoritative update 2026-11-24: User selected Quiet Workspace implementation. New CS-041 issue #77; deployment issue #70 is now CS-042 and remains last, superseding earlier deployment041 aliases. Branch `codex/CS-041-quiet-workspace`, Todo verified then In Progress. Shared responsive shell/icons/typography and compact cover cards/Active-History/progress implemented locally. 316 tests pass; desktop/mobile320px/keyboard/confirmation and manager shell checks documented in docs/acceptance/cs041/USER-STORIES.md. Preview3041 employee/localhost3041 manager. Your review; no push/merge authorized.

User explicitly approved CS-041 merge on 2026-11-24. Merged PR #78 (`041bb66baf0f4bc467eb1da8f0dff1469d485008`), issue #77 closed/completed and board Done verified. 316 tests pass. Earlier review-only snapshots are superseded. CS-042 deployment remains last. Notification redesign suggestions requested only; no implementation selected.


Authoritative 2026-11-24 update: CS-042 Quiet notification panel (#79) selected after approved Bell panel concept; Todo verified then In Progress. Local grouping/current-status metadata, compact anchored/mobile panel, All/Unread, loaded-history/paging/read recovery implemented. 322 tests pass; browser desktop320px/keyboard/uncertain saved read/GET retry/manager/logout checks in docs/acceptance/cs042/USER-STORIES.md. Your review; no push/merge authorized. Deployment #70 now CS-043 and remains last; earlier CS-042 deployment references are superseded.

User explicitly approved CS-042 merge on 2026-11-24. PR #80 merged as `af00c3d95c5313cf0aa9e76e5f8865889d9c89c5`; issue #79 closed/completed and board Done verified. 322 tests pass. Earlier local-review notes are superseded. Recommended next CS-032 Daily shift duties (#68), not started. CS-043 deployment remains last.


CS-032 (#68) selected 2026-11-24: Todo verified then In Progress, branch `codex/CS-032-shift-duties`. Manager optional shift duties (10×160 plain-text), employee business-date view including overnight continuation, safe legacy DTOs/schema12, preserved assignment/coverage locks and duties retained after approved transfer. 327 tests pass; fictional create/edit/validation/day/transfer/320px browser evidence in `docs/acceptance/cs032-duties/USER-STORIES.md`. Preview3046 manager/Alex,3047 Jamie. Ready for Your review; no push/merge authorized. CS-033–039 remain Todo; CS-040–042 complete; CS-043 deployment (#70) remains last. Earlier conflicting status snapshots are historical.


CS-032 approved and completed on 2026-11-24: user authorized push/merge after local review. PR #81 merged as `cd2412d17f88d2b9d292b30b80b47c6d8e8260dc`; issue #68 closed/completed and project Done verified. 327 tests pass. Earlier local-review status is superseded. Next planned task CS-033 Monday publication of a two-week schedule (#69), still Todo and not started. Confirm publication window and manual/automatic policy before implementation. CS-043 deployment remains last.


CS-033 (#69) selected on2026-11-24: user confirmed following-Monday14-day window and manual Publish with Monday due/overdue indicator. Todo verified then In Progress; branch `codex/CS-033-schedule-publication`. Local schema13 private staging, reviewed atomic publication, scoped employee receipts, audit/retry/conflict handling and legacy-preserving activation ready for Your review.337 tests pass; real browser private/read/publish/edit/notification/lost-ack/320px evidence in `docs/acceptance/cs033-publication/USER-STORIES.md`. Preview3048 manager/Alex,3049 additional login. No push/merge approved. CS-034–039 remain Todo; CS-043 deployment remains last.


User explicitly approved Week planner implementation and combined CS-033 push/merge on2026-11-24. Refined both create/edit forms within issue#69;341 tests and desktop/320px preset/validation/overnight/edit checks pass. Preserve the exact scope and verify issue closed/board Done after merge. No extra confirmation required.


CS-033 and the user-selected Week planner refinement are complete: user approved combined implementation/push/merge on2026-11-24; PR #82 merged as `5070caa85007b7f9818fe0acef75f50d5353c82f`. Issue #69 closed/completed and project Done verified.341 tests pass; create/edit preset/validation/overnight/320px checks passed. Earlier review-only notes for this scope are superseded. Next planned task CS-034 conversational AI draft refinement (#57), still Todo, not started. CS-043 deployment remains last.
