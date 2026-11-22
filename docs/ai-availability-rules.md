# CS-031B-2 — Confirmed employee availability rules

Tracking: [issue #48](https://github.com/EldarSadeghi/soen287-covershift/issues/48). Branch: `codex/CS-031B-2-availability-rules`. Implementation is local pending user review; no push/merge without explicit approval. CS-031B-1 was merged in PR #47. Deployment CS-018 remains last.

## Try it

Open the employee **AI assistant** from any worker workspace page. **Chat task** separates **Find existing shifts** (the existing CS-031B-1 flow) from **Save availability**. Changing tasks starts a fresh conversation so search history cannot silently become an instruction to save a rule.

In Save availability mode try:

- “I can take up to 2 shifts next Thursday between 9 AM and 5 PM.”
- “I can take any shift next Thursday.”
- “I can take one Night service shift on November 26, 2026 from 10 PM overnight until 6 AM on November 27.”

The AI prepares a draft with exact dates, hours, timezone, optional title keyword and maximum claim count. Review it, then **Confirm availability** or **Cancel draft**. Generating or replying “yes” does not save. Whole-day availability means local midnight through next midnight; when no count is specified, the conservative default is **one**, always shown before confirmation. A weekday means the next occurrence strictly after the current business date; next week means the next Monday–Sunday calendar week. Missing dates, ambiguous “9 to 3”, recurrence, multiple days, dayparts without explicit hours and unsupported constraints receive clarification. Only one future window within 90 days and up to 24 local hours is supported; explicit overnight is allowed. Maximum claims is an integer from one to five.

**Saved availability** loads the authoritative saved list without another AI call. Use **Pause rule**, **Resume rule**, or **Cancel rule → Confirm cancellation**. Keep rule cancels that confirmation without changing the saved record. Expired/cancelled rules cannot resume. Expiry is derived at the window end. Saved rules are private to the signed-in employee and remain through navigation/restart.

**Automatic matching is not running in this increment.** Saving availability does not request or assign a shift, reserve time, or send a notification. CS-031C will implement matching against eligible openings with manager approval; CS-031D will implement notifications. All relevant draft/list/receipt states disclose this boundary.

## Confirmation, storage and recovery

Version 6 adds `availabilityRules` only on the first confirmed write. Older v1–v5 data remains readable without changing its records; confirmation upgrades atomically and preserves prior collections. A rule stores business/worker scope, UTC window, timezone snapshot, optional title keyword, claim maximum, confirmation nonce and immutable server confirmation order. Details: [data model](data-model.md).

A repeated employee-scoped confirmation nonce with identical normalized values returns the original rule. It cannot duplicate, reactivate cancelled/expired rules or authorize another employee. A different payload using the same nonce is rejected. The server independently validates current account, business timezone, dates/DST, future horizon and count. Writes and changes run under the existing store transaction lock. Pause/resume/cancel require an opaque current revision. Team removal revisions include rules; rule history prevents hard deletion, and successful deactivation cancels all of the worker’s rules atomically.

There are limits of 20 current rules and 100 total records per worker. Cancelling a current rule releases current capacity; it retains history. Whole-day DST windows can last 23/25 elapsed hours while remaining 24 local hours. Nonexistent or repeated local input times are rejected. Paused rules cannot resume after a business timezone change; cancel and confirm new dates instead. Windows and confirmation timestamps remain unchanged by pause/resume.

The client persists a save-not-confirmed state before sending a write. Transport timeout/5xx/malformed-success responses never claim success and remove the confirmation button. **View saved availability** reconciles with server state; no write automatically retries. A definitive validation rejection clears the draft and asks for a fresh one. Unconfirmed proposals are not restored as live controls after reload. Bounded same-tab history/mode/receipts use the existing account+business ownership and eight-hour idle expiry; logout clears them, and New chat invalidates late replies.

## Service and safeguards

- `POST /api/worker/ai-availability-draft`: bounded read-only strict-schema interpretation through GPT-6 Luna. Current business time/timezone and bounded messages only; no database records, employee roster, IDs, emails or credentials are supplied as context. User-entered text is sent as written, with the existing privacy notice. Membership/timezone are rechecked after inference. No tools or provider-managed history; `store:false`, 1,200 output tokens, 16 KB input, 64 KB response and an 11-second deadline follow the established [official Structured Outputs documentation](https://developers.openai.com/api/docs/guides/structured-outputs).
- `GET /api/worker/availability-rules`: private, server-scoped saved list; no AI request.
- `POST /api/worker/availability-rules`: explicit confirmation only.
- `POST /api/worker/availability-rules/:id/pause|resume|cancel`: current-revision status changes.

All routes require a current worker session and reject account/business overrides. POST requires same-origin JSON and CSRF. Existing paid HTTP throttling and shared persistent AI allowance cover this new provider service too; each service permits at most two concurrent calls and one per user. The ledger caps attempts rather than exact dollar spend. The API key stays server-side. Manual existing-shift controls and manager drafting remain unchanged.

## Local review

[Employee preview](http://localhost:3022/workspace/worker/shifts) uses an isolated temporary database with fictional records. Employee `worker_jamie@example.test`, manager `manager_morgan@example.test`; fictional review password `Fictional chat review access!`. Normal checkout: configure private `.env`, run `npm run dev`, sign in as your employee and choose Save availability. This unmerged increment is currently in the Documents checkout, not GitHub main or the Desktop checkout.

Acceptance report: [user stories and evidence](acceptance/cs031b-2/USER-STORIES.md). Natural-language extraction is verified on finite examples, not guaranteed for every possible wording; exact review and explicit confirmation remain essential.

## CS-031C update

CS-031B-2 was merged in PR #49. The separate CS-031C increment enables automatic matching for confirmed active rules, with successful-submission usage and current match status shown in Saved availability. Pause/cancel stops future submissions, not existing pending requests. The original B-2-only no-matching notes above document that increment; current behavior is described in [automatic matching](automatic-matching.md). Notifications remain CS-031D.
