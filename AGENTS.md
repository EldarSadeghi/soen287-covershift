# CoverShift working instructions

- Track every implementation task with its CS-xxx ID in a GitHub issue and on https://github.com/users/EldarSadeghi/projects/1.
- Add each new task to Todo first and verify it appears there. Then move it to In Progress and tell the user implementation has started. Status flow: Todo -> In Progress -> Your review -> Done. Mark Done only after the user's confirmation and approved merge.
- Implement one increment at a time on a `codex/CS-xxx-short-name` branch. Include acceptance criteria in the issue before implementation.
- Provide a local preview and relevant check results; move the task to Your review. Wait for explicit user approval before pushing any feature branch or merging it into main.
- After approval, open a PR targeting main with `Closes #<issue-number>`. Merge only within the approved scope. Verify the issue closes and its board status becomes Done.
- CS-001 is complete: issue #2, merged PR #1. CS-002 is complete: issue #3, merged PR #4. CS-003 is complete: issue #5, merged PR #6. CS-004 is complete: issue #7, merged PR #8. CS-005 is complete: issue #9, merged PR #10. CS-006 is complete: issue #11, merged PR #12. CS-007 is complete: issue #13, merged PR #14. CS-008 is issue #17, reviewed and approved by the user for push and merge. Consult docs/implementation-plan.md and docs/contributing.md for details.
- The GitHub connector has denied writes. Local Git authentication works; never print, persist, or expose credentials. GitHub Projects API access lacks project scopes; the signed-in browser can manage the board.
