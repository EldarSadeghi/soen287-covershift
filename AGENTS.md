# CoverShift working instructions

- Track every implementation task with its CS-xxx ID in a GitHub issue and on https://github.com/users/EldarSadeghi/projects/1.
- Status flow: Todo -> In Progress -> Your review -> Done.
- Implement one increment at a time on a `codex/CS-xxx-short-name` branch. Include acceptance criteria in the issue before implementation.
- Provide a local preview and relevant check results; move the task to Your review. Wait for explicit user approval before pushing any feature branch or merging it into main.
- After approval, open a PR targeting main with `Closes #<issue-number>`. Merge only within the approved scope. Verify the issue closes and its board status becomes Done.
- CS-001 is complete: issue #2, merged PR #1. CS-002 is complete: issue #3, merged PR #4. CS-003 is issue #5, approved by the user for push and merge. Consult docs/implementation-plan.md and docs/contributing.md for details.
- The GitHub connector has denied writes. Local Git authentication works; never print, persist, or expose credentials. GitHub Projects API access lacks project scopes; the signed-in browser can manage the board.
