# CoverShift working instructions

- Track every implementation task with its CS-xxx ID in a GitHub issue and on https://github.com/users/EldarSadeghi/projects/1.
- Add each new task to Todo first and verify it appears there. Then move it to In Progress and tell the user implementation has started. Status flow: Todo -> In Progress -> Your review -> Done. Mark Done only after the user's confirmation and approved merge.
- Implement one increment at a time on a `codex/CS-xxx-short-name` branch. Include acceptance criteria in the issue before implementation.
- Provide a local preview and relevant check results; move the task to Your review. Wait for explicit user approval before pushing any feature branch or merging it into main.
- After approval, open a PR targeting main with `Closes #<issue-number>`. Merge only within the approved scope. Verify the issue closes and its board status becomes Done.
- CS-001 is complete: issue #2, merged PR #1. CS-002 is complete: issue #3, merged PR #4. CS-003 is complete: issue #5, merged PR #6. CS-004 is complete: issue #7, merged PR #8. CS-005 is complete: issue #9, merged PR #10. CS-006 is complete: issue #11, merged PR #12. CS-007 is complete: issue #13, merged PR #14. CS-008 is complete: issue #17, merged PR #18. CS-009 is complete: issue #19, merged PR #20. CS-010 is complete: issue #21, merged PR #22. CS-011 is complete: issue #23, merged PR #24. CS-012 is complete: issue #25, merged PR #26. CS-013 is complete: issue #27, merged PR #28. CS-014 is complete: issue #29, merged PR #30. CS-015 is complete: issue #31, merged PR #32. CS-016 is complete: issue #33, merged PR #34. CS-017 is complete: issue #35, merged PR #37. CS-019 is complete: issue #36, merged PR #38. CS-020 is complete: issue #40, merged PR #41. CS-022 is complete: issue #42, merged PR #43. CS-031A is complete: issue #44, merged PR #45 on 2026-11-21. Consult docs/implementation-plan.md and docs/contributing.md for details.
- The GitHub connector has denied writes. Local Git authentication works; never print, persist, or expose credentials. GitHub Projects API access lacks project scopes; the signed-in browser can manage the board.

- User preference (2026-11-17): CS-018 Deployment and submission must be the very last step, after CS-019 and any remaining approved implementation work. CS-017 and CS-019 are merged. CS-020 is merged. CS-022 is merged. CS-031B-1 is merged in PR #47; CS-031B-2 confirmed employee availability rules is the current increment. CS-021 remains an unstarted suggestion for possible future consideration.

- Approved AI roadmap: CS-031A persistent bottom-left chat and manager shift drafts; CS-031B employee confirmed availability/claim rules; CS-031C deterministic matching with manager approval and earliest confirmed eligible rule first; CS-031D in-app notifications for managers and employees. Implement/review/merge one increment at a time. User approved CS-031A push and merge on 2026-11-21; later increments still need their own review and approval.

- CS-031A-US05 / F01 completion-feedback fix is implemented locally (2026-11-21): correlated confirmed-save receipts and honest uncertain-save state, 149 tests pass, user-story report records 14/14 within checked scenarios. User explicitly approved this CS-031A increment for push and merge on 2026-11-21.

- CS-031B-1: issue #46, branch `codex/CS-031B-1-chat-shift-requests`. Todo verified then In Progress on 2026-11-21. Existing open shifts through employee chat, explicit confirmation submits pending manager approval. Future availability rules (CS-031B-2), automatic matching (CS-031C) and notifications (CS-031D) remain separate. No push/merge until explicit user approval.

- CS-031B-1 is ready in Your review (2026-11-21): 161 tests pass, real-provider and browser evidence in `docs/acceptance/cs031b-1/`. Local preview port 3020. Issue #46 remains open; no push or merge without explicit user approval.

User explicitly approved CS-031B-1 push and merge on 2026-11-22. Next proposed increment: CS-031B-2 confirmed employee availability rules (view/pause/cancel); CS-031C matching and CS-031D notifications remain separate. CS-018 remains last.

- CS-031B-1 is complete: issue #46, merged PR #47 on 2026-11-22. CS-031B-2 is issue #48, branch `codex/CS-031B-2-availability-rules`. Todo verified then In Progress on 2026-11-22. Dated rule drafts require explicit employee confirmation; saved private rules support pause/resume/cancel. Matching CS-031C and notifications CS-031D remain separate. No push or merge without explicit approval.

- CS-031B-2 ready for Your review: 174 tests and eight real-provider cases pass; browser confirmation/lifecycle/recovery/mobile evidence in `docs/acceptance/cs031b-2/`. Local preview 3022. Issue #48 stays open; wait for explicit user approval before push or merge.
