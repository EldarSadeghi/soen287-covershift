# Working agreement

1. Choose one task ID from the implementation plan, create its GitHub issue with acceptance criteria, and assign an owner before work starts. Add it to [the project board](https://github.com/users/EldarSadeghi/projects/1) in Todo, then move it to In Progress when implementation starts. Coordinate shared-file changes with the teammate.
2. Work on a local feature branch named `codex/CS-xxx-short-name`; use the same ID in commits, GitHub issues, and pull requests.
3. Implement the increment and run checks appropriate to it. Update setup instructions and the AI collaboration log when relevant.
4. Provide a running preview, acceptance checklist, and check results. Move the board task to Your review.
5. Wait for explicit user approval. Revise and preview again if changes are requested. Do not push any branch before approval.
6. Following approval, push and open a PR targeting main with `Closes #<issue-number>`. Merge only when approval includes merging and required checks pass. Verify the issue closes as completed and the enabled Item closed workflow sets its board status to Done. Keep `main` at the last accepted version.

Repository: https://github.com/EldarSadeghi/soen287-covershift. Teammate access and available main-branch protections still need verification. Never commit `.env`, credentials, sessions, or personal data.

CS-001 was tracked retrospectively in [issue #2](https://github.com/EldarSadeghi/soen287-covershift/issues/2), closed as completed and linked to [merged PR #1](https://github.com/EldarSadeghi/soen287-covershift/pull/1).

## CS-001 review checklist

- A fresh checkout with Node.js 24+ starts with `npm start`.
- The browser displays the CoverShift foundation page at `http://127.0.0.1:3000`.
- README setup, folder organization, and this review workflow are understandable to both teammates.
- No application feature is presented as finished beyond this foundation.
