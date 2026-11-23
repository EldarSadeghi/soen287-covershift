# CS-021: Prepare a presentation demo

Use Node.js 24 or newer. Open this project folder in VS Code and run:

```sh
npm run demo:prepare
npm run demo:start
```

Keep the terminal running. No package installation is required. This launches the full protected application with fictional accounts and saved workflows, separate from the public `/demo` pages and your normal business records.

| Role | Open in browser | Email |
| --- | --- | --- |
| Manager, Morgan Chen | http://localhost:3035/login | manager_morgan@example.test |
| Employee, Jamie Lee | http://127.0.0.1:3035/login | worker_jamie@example.test |

Both use the **fictional local demo passphrase: `CoverShift demo access!`**. Keep the hostname as printed: `localhost` and `127.0.0.1` keep the two role sessions separate in the same browser. Demo cookies also have a different name from normal application sessions. Accounts are local test identities; these are not real email inboxes.

Preparation prints a dated `WALKTHROUGH.md` path under `.covershift-demo/runs/<run-id>/`. Open that file for the exact dates and example prompts. Prepare shortly before presenting: dates are generated for the next Thursday–Saturday in America/Toronto. The clock is real. The launcher rejects a scenario whose Thursday has started.

## What to demonstrate

1. Manager Overview has four employees, five future shifts and one pending coverage claim. Jamie starts with two assigned shifts totaling seven hours.
2. Employee AI assistant → **Ask about schedules** → **My next shift**. The structured answer shows the assigned shift, date, time and duration; pending claims are excluded from assigned hours.
3. Employee **Find existing shifts**: use the exact Thursday date from the walkthrough and ask for an opening between 2 PM and 6 PM. Review Afternoon coverage and explicitly confirm the request. Without AI, use **Open shifts → Check & claim**.
4. Manager **Approvals**: approve the claim and confirm. Employee notifications show approval; refresh My shifts to see the assignment. Alternatively, approve the prepared Friday Morning coverage claim.
5. Optional: employee chat → **Saved availability → Resume rule** for Saturday Weekend service. This submits an automatic matching request. Refresh manager Approvals: Alex stays assigned until the manager approves. Both roles receive saved notifications.
6. History already includes an approved and a cancelled example. Optional manager shift drafting uses Sam Rivera on Sunday, as specified in the generated walkthrough; review and explicitly save the draft.

Close chat before opening notifications or navigating. Use Refresh after changes in the other role. Notifications display saved updates; they do not arrive by email or operating-system push.

## Rehearse and restore a fresh scenario

Stop with Ctrl+C, then run the same two commands again. Every `demo:prepare` selects a **new run**, preserving earlier populated runs. Sign in again in both tabs. Each run has a unique business and session identity so prior chat/session state does not cross into the new scenario. `demo:start` resumes the selected run; restarting alone does not reset it.

Storage is fixed to this checkout’s ignored `.covershift-demo/` directory. It does not use `DATA_DIRECTORY` or overwrite `data/`, another checkout, or existing business accounts. Unknown directories, symlinks and invalid run selections are rejected. Production mode is rejected. The server binds only to `127.0.0.1`; use a browser on this Mac. This is local demo preparation, not deployment or submission. CS-018 remains last.

If port 3035 is occupied, stop your previous demo or use `DEMO_PORT=3036 npm run demo:start`; replace both browser URLs with that port. Do not stop unrelated servers. Preparation never deletes old runs; disk cleanup is a separate manual decision.

## AI setup and backup

The commands load an existing private `.env` in this checkout. Keep it out of Git. To use an existing private configuration elsewhere without copying it:

```sh
node --env-file=/absolute/path/to/your/.env scripts/demo.js start
```

No key is printed, added to fixtures, or included in the walkthrough. The real provider is used when configured; an API key, provider access, credit and network connection are required for live AI. Without configuration, schedules, manual claims, approvals, rules, notifications and history still work. There is no fabricated AI fallback.

Existing AI limits apply: five attempts per account per ten minutes, twenty per UTC day, within the project allowance. Persisted demo usage is stored outside individual runs, so preparing again does not reset it. Rehearse only a few messages and use manual controls for repeated practice. Before the presentation, save a short screen recording of one successful walkthrough as a backup; recording is not generated automatically by this task.

Verification and browser evidence: [acceptance report](acceptance/cs021/USER-STORIES.md).
