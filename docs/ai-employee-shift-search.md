# CS-031B-1 — Find and request an existing shift through chat

Tracking: [issue #46](https://github.com/EldarSadeghi/soen287-covershift/issues/46). Local branch: `codex/CS-031B-1-chat-shift-requests`. CS-031A is merged in PR #45. This increment requires its own review before push/merge.

## Employee workflow

1. Sign in as an employee and open the bottom-left **AI assistant** on any worker workspace page.
2. Try **Find an open shift next Thursday**. Optional criteria: **Find an open shift next Thursday between 9 AM and 3 PM**, or **Find a Night service shift on November 26, 2026**.
3. The assistant shows real saved coverage openings you can currently request. A bare weekday means its next occurrence strictly after today in the business timezone. The exact calendar date is displayed before confirmation. Missing dates, ambiguous hours, dayparts without explicit hours, multiple days and unsupported future-watching requests receive clarification.
4. Choose **Review request** for one shift. This checks current availability without reserving or submitting anything. Read its exact dates, hours, timezone and approval requirement. **Cancel** leaves the request unchanged.
5. **Confirm request** explicitly submits the existing claim workflow. Your time is reserved while the manager reviews it; the original worker remains assigned. **View My requests** shows the authoritative current status. Existing manager approval/rejection controls remain unchanged.

Search is for a single business-local start date; an overnight shift belongs to its start day. Optional bounds include only shifts entirely within those hours, including an explicit next-day overnight end. Title matching is a case-insensitive substring. Up to ten eligible results appear in chat, with the full count and **Open shifts** fallback if there are more. Filtering runs before this rendering limit. **Refresh matches** repeats the deterministic search without another provider request. Reload/navigation retains search criteria, requiring a fresh refresh rather than restoring stale claim controls.

The assistant does not save future availability rules or watch openings (CS-031B-2), automatically match/claim later (CS-031C), or add notifications (CS-031D). Chat text alone, including “yes,” never submits a claim.

## Implementation and boundaries

`src/ai/shift-search.js` uses GPT-6 Luna to extract strict search criteria. The provider receives the current business timezone/time and bounded user/assistant messages, not the shift database, worker roster, emails or record IDs. User-entered text can itself contain information; the composer explains this. `store:false`, no tools, bounded input/output and an 11-second provider/body deadline follow the same official [Structured Outputs documentation](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses) used by manager drafting. The shared transport is in `structured-response.js`; existing manager tests protect its behavior.

`POST /api/worker/ai-shift-search` is the paid interpretation + deterministic search. `POST /api/worker/shift-search` is a free refresh of validated criteria. Both require an active worker session, same-origin JSON, CSRF and server-derived business scope; query overrides and extra fields are rejected. They never write a shift or claim. Current membership is checked after inference. Matching uses the current open board, excludes own/started/closed/claimed/foreign openings and assigned/pending-claim conflicts, and returns saved revisions.

Confirmation calls existing `claim-check` then explicit `claim`; the exclusive store transaction rechecks revision, current state, time and conflicts. Competing claims cannot both succeed. The AI never authorizes or selects an arbitrary record for a mutation. The API key stays server-side. Manager and worker requests share the persistent 500-attempt total / 20-per-user-per-UTC-day ledger for a data directory; each role's provider service has at most two concurrent calls and one per user. HTTP paid attempts are also throttled. These are request caps, not a dollar ledger. Manual Open shifts works when AI is unavailable.

`public/ai-employee-state.js` caches bounded same-tab conversation and criteria under business+user ownership with an eight-hour idle expiry. It restores no request/revision controls. `ai-employee-request.js` renders current matches and explicit controls; `ai-shift-draft.js` shares the existing dialog/composer. New chat invalidates late search results. While preflight/refresh/submission is pending, chat actions are disabled; closing the panel remains available. Before sending a mutation, uncertainty is persisted so reload during a pending write cannot restore a live Confirm button. Confirmed success shows a submission receipt; a transport/5xx/malformed-success failure shows **Request not confirmed**, links to My requests and removes confirmation controls. No mutation retries automatically. A definitive rejection preserves a clear error and requires refreshed review.

## Local review

The current isolated real-provider preview is [CoverShift employee preview](http://localhost:3020/workspace/worker/shifts). It uses fictional accounts and a separate temporary database; the user's existing Mac data is unchanged.

- Employee: `worker_jamie@example.test`
- Manager: `manager_morgan@example.test`
- Both use the fictional review password: `Fictional chat review access!`
- Seeded date: Thursday, November 26, 2026. Opening service 9 AM–3 PM, Evening service 4–8 PM, Night service 10 PM–6 AM next day (America/Toronto). The opening shift was requested during verification; remaining shifts can be reviewed. Sample accounts are local review fixtures only.

For a normal checkout with the private `.env` configured, start with `npm run dev` (or `PORT=3002 npm run dev` if needed), sign in with your existing employee account and search an actual saved open coverage request. This unmerged increment is currently in the Documents working checkout, not yet on GitHub main or the Desktop checkout.

Acceptance evidence and limits: [user-story report](acceptance/cs031b-1/USER-STORIES.md). CS-018 deployment remains the final step.

CS-031B-1 was merged in PR #47 on 2026-11-22. CS-031B-2 adds a separate **Save availability** chat task and **Saved availability** controls; see [availability rules](ai-availability-rules.md). Find existing shifts remains the read-only search followed by explicit claim confirmation described above.
