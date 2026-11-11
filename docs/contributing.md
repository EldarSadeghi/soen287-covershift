# Working agreement

1. Choose one task ID from the implementation plan and assign an owner before work starts. Coordinate shared-file changes with the teammate.
2. Work on a local feature branch named `codex/CS-xxx-short-name`; use the same ID in commits, GitHub issues, and pull requests.
3. Implement the increment and run checks appropriate to it. Update setup instructions and the AI collaboration log when relevant.
4. Provide a running preview, acceptance checklist, and check results. Set the task to `ready for user review`.
5. Wait for explicit user approval. Revise and preview again if changes are requested. Do not push any branch before approval.
6. Following approval, push and open a PR. Merge only when approval includes merging and required checks pass. Keep `main` at the last accepted version.

The repository owner will configure teammate access and available main-branch protections when the GitHub repository is identified. Never commit `.env`, credentials, sessions, or personal data.

## CS-001 review checklist

- A fresh checkout with Node.js 24+ starts with `npm start`.
- The browser displays the CoverShift foundation page at `http://127.0.0.1:3000`.
- README setup, folder organization, and this review workflow are understandable to both teammates.
- No application feature is presented as finished beyond this foundation.
