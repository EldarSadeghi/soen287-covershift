# CS-031A — AI-assisted manager shift creation

Issue: [#44](https://github.com/EldarSadeghi/soen287-covershift/issues/44). Branch: `codex/CS-031A-ai-shift-drafts`. Local implementation; user approval required before pushing or merging. Employee availability (CS-031B) is separate. CS-018 remains the final step.

## How it works

Click the persistent **AI assistant** sparkle button in the bottom-left of any signed-in workspace page. It opens a desktop conversation panel; at 680px and below it fills the screen. Close or Escape returns focus to the launcher. Keyboard Tab/Shift+Tab stays inside the open dialog. Close the panel to continue using the page while a reply is pending.

For managers, describe one shift. The assistant asks for missing details; reply naturally without rewriting the whole request:

> You: Opening service for Jamie Lee next Thursday.
> Assistant: What start and end times should I use?
> You: 9 AM to 3 PM.

A validated draft card shows the exact worker, title, dates/hours and business timezone. **Review shift** opens the existing editable Schedule form, including from Overview, Team, Approvals or History. Existing form entries require **Replace with AI draft** confirmation or **Keep my entries**. Review/edit all fields, then use the ordinary **Create and assign shift** button. Generating, chatting, opening review, and applying do not save a shift. Final saving independently rechecks current records atomically.

Closing/reopening, reload and workspace navigation preserve the same account's bounded conversation in **sessionStorage**, scoped to both manager/user and business in that tab. No keys/CSRF tokens are stored there. New chat clears the transcript, composer, suggestion and carried draft; sign-out removes the state. Another account cannot restore the prior account's messages. Cached state expires after eight hours idle, and carried drafts after ten minutes. Browser-blocked storage falls back to in-memory chat; cross-page draft transfer is then unavailable and the UI asks the manager to open Schedule first. This is tab-session history, not a server conversation archive; closing the tab ends the intended history lifetime (browser session restoration can restore tab storage).

Up to ten prior messages (five user/assistant pairs), 4,500 UTF-8 bytes of serialized history, and a 1,500-character current message can be supplied. The HTTP body is capped at 8,192 bytes and the client checks 8,000 bytes before sending. The conversation is never silently truncated: when full, start a new chat and include the relevant details again. Each message sent to AI uses one allowance reservation, including follow-up answers. Errors retain the unsent composer text; they do not append fake successful assistant turns. New chat and logout invalidate in-flight replies so late results cannot overwrite a newer chat. Closing alone retains the reply for reopening.

Employee pages show the same launcher with an honest explanation that employee assistance is a later increment; no manager composer/draft actions or AI requests are available to workers. The protected manager endpoint still rejects workers.

“Next Thursday” is defined in the model instructions as the next Thursday strictly after today's business date; “next week” is the next Monday–Sunday calendar week. Always review the returned exact dates: language models are probabilistic, not a proof of the user's intended date or meaning.

## Private configuration

Node.js 24+, no new runtime packages. In the checkout you run, add to the ignored `.env` beside `package.json`:

```dotenv
OPENAI_API_KEY=your_private_project_key
OPENAI_MODEL=gpt-6-luna
```

Never commit/share the real key or put it in `public/`. Use a project key permitted to write Responses. Start/restart the server with `PORT=3002 npm run dev`; Node reads `.env` at startup. A file saved in a different checkout does not configure this one. Missing/revoked/expired/restricted keys or an unsupported configured model leave manual scheduling operational and show the AI recovery message when Generate is attempted. No other model is selected automatically.

The implementation calls `POST https://api.openai.com/v1/responses` server-side with strict JSON Schema, `store:false`, reasoning effort `none`, no tools, and a 1,200-output-token cap. The AI receives the current message and bounded previous conversation, server-supplied date/time/timezone, and active same-business worker names with temporary references. It receives no stored passwords, emails, actual record IDs, schedule, or other businesses. Text the manager includes in the conversation is sent as written; the UI asks users to omit sensitive information. `store:false` does not promise zero provider retention; see [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data).

## Budget and operational limits

- At most **500 attempted provider calls across the lifetime of one DATA_DIRECTORY**; no monthly reset.
- At most **20 per manager per UTC day**, persisted across app restarts.
- At most **5 endpoint attempts per manager per 10 minutes** (in memory).
- One active inference per manager; two total in one server process.
- 1,500-character current message, bounded transcript as above, at most 50 active workers, whole serialized provider request at most 16,000 UTF-8 bytes, 1,200 maximum output tokens, at most 65,536 response bytes.
- 11-second inference/body deadline inside the existing 15-second browser deadline. No automatic paid retries or provider failover. Cancel/timeout cannot prove provider processing stopped; explicit later generations may incur another charge.

Reservations are private owner-readable files in `DATA_DIRECTORY/ai-usage/`; reserve before sending. They contain only a hashed manager ID and UTC date, never the key, description or response. Failed/refused/timed-out calls consume an allowance because the provider may have billed them. Serialized writes, atomic exclusive creation, fsync and a directory lock prevent competing reservations from bypassing limits. Corrupt/unexpected records or a stale lock fail closed. Do not delete/reset the ledger during grading: doing so replenishes the allowance. Back it up with the application data. After a crash, remove `ai-usage/.lock` only after confirming no process is writing; a partial reservation needs operator inspection, never automatic deletion.

This is a conservative request allowance, **not a dollar billing ledger**. At the fetched Nov 20, 2026 Standard GPT-6 Luna rates ($0.10/M input, $0.50/M output), the bounded workload is designed to fit well below the agreed US$5 usage budget. Provider token accounting/prices can change; this is not an exact charge guarantee. Configure the separate **US$5 provider hard spend limit** and **US$3 alert**, keep auto-reload off, and check actual provider usage. November/December monthly limits reset; this application's lifetime allowance does not. Different DATA_DIRECTORY values/checkout copies have separate allowances, while the provider account bills all calls. Revoke the project key after grading is completed, not before the grader has finished.

## Validation and security

`/api/manager/ai-shift-draft` requires a current manager session, same-origin JSON, CSRF token, no query-supplied business, and a description with optional strictly validated conversation history (alternating user/assistant text only; no system/developer/tool roles or extra fields). Transcript text is untrusted context, never authorization. Scope/worker context comes from current server records. Draft validation checks the full output shape, known temporary worker reference, current same-business active membership, current business timezone, title, strict calendar dates, ambiguous/nonexistent DST times, future start, increasing end and existing assigned-shift overlaps. Authorization and membership are checked again after inference.

The normal final-save endpoint independently rechecks everything atomically against the latest records; AI cannot authorize or perform a write. Provider response text is rendered as text, never HTML, and raw provider errors/secrets are not logged or returned. Provider failures are shown with one safe recovery message. As in manual creation, pending coverage commitments are not additional creation-time overlap checks; the accepted claiming/review workflow retains its own conflict rules. No automatic employee scheduling, multi-shift batches, recurring shifts, availability persistence, training or fine-tuning is included. The six original AI checks and screenshots in cs031a-evidence document the superseded inline design; the chat revision evidence below is current.

## Verification — chat revision

- `npm run verify`: syntax checks and **141 passing tests**, including the original 11 AI tests plus five conversation/state tests. New coverage: strict/bounded history, follow-up context with current scoped roster, no privileged history roles, no provider conversation persistence, per-account/business tab isolation, idle/carried-draft expiry, malformed state, blocked storage, reset/logout, and explicit review registration. Existing authorization, validation, deadlines, concurrency, persistence and usage tests remain green.
- Optional **paid** evaluation: `node --env-file=/path/to/private/.env scripts/evaluate-ai-shifts.js`. Uses eight fictional cases and the configured allowance; never reads actual business records. `--chat-only` runs only the two new cases. Both new cases passed: short answer completing an earlier shift; correction preserving worker/date while changing hours. The original six extraction cases passed in the initial increment. These are finite examples, not a universal language-accuracy guarantee.
- Real-provider browser on port 3017 with isolated fictional records: launcher on Overview/Schedule; natural missing-hours question and short answer; reviewed draft carried to Schedule with input focus and no save; transcript retained across navigation/reload; existing manual title preserved until explicit replace confirmation (Keep my entries works); employee shell shows no prior manager messages or manager actions; sign-out clears state.
- Mobile 320×760: viewport 320, document scrollWidth 305, full-height 760px dialog with no horizontal overflow and composer visible. Desktop Tab/Shift+Tab wraps between first/last chat controls; Escape closes and focuses launcher.
- Separate temporary fake-provider browser preview checks failure/timeout recovery, new-chat/late-response isolation, and retained unsent text without additional paid requests. Test fixtures never change real business records.
- Current evidence: [ready preview](cs031a-chat-evidence/ready.png), [launcher](cs031a-chat-evidence/launcher.png), [conversation](cs031a-chat-evidence/conversation.png), [replace confirmation](cs031a-chat-evidence/replace-confirmation.png), [mobile](cs031a-chat-evidence/mobile.png), [worker scope](cs031a-chat-evidence/worker-scope.png). Current result summary: `cs031a-chat-evidence/verification.txt`.

## Agreed next increments (not included here)

CS-031B: employee availability and explicitly confirmed dated automatic-claim rules, with view/pause/cancel controls. CS-031C: deterministic matching and conflict checks when coverage opens, earliest confirmed eligible rule first, respecting date/hours/count/expiry and not repeatedly claiming the same rejected opening. Claims still need manager approval before assignment changes. CS-031D: both-role in-app notification bell/unread count, manager notification for automatic claims and employee notifications for submission/approval/rejection, with relevant links. No emails in the first notification increment. Each increment receives its own issue, acceptance criteria, local review and approved merge. CS-018 stays last.

Official implementation references: [Conversation state](https://developers.openai.com/api/docs/guides/conversation-state), [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses), [Responses create](https://developers.openai.com/api/reference/resources/responses/methods/create), [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna), [spend limits](https://developers.openai.com/api/docs/guides/spend-limits).

## User-story acceptance audit

[Fourteen user stories and acceptance results](acceptance/cs031a/USER-STORIES.md) were checked against application commit `f95cc9c`. The original Nov20 audit found thirteen passing stories and a partial US05 because the chat retains its unsaved draft after the manager successfully creates the shift through the review form. The normal save succeeds and Schedule confirms it. The original audit proposed F01 without changing product code; the Nov21 correction and retest below now resolve it locally.


## CS-031A-US05 completion feedback — 2026-11-21

The audited F01 gap is fixed locally. Review handoffs now carry a client-only opaque ID. Only a confirmed successful save of the current matching handoff changes chat to **Shift created**, using the server-returned final reviewed fields, and replaces Review shift with View schedule. The assistant reply is updated too, preserving bounded alternating history. The receipt is a snapshot of confirmed creation, not a live view of subsequent edits/deletion; View schedule shows the current records.

Keeping unrelated manual entries does not attach the new AI handoff; saving an unrelated form or an older draft does not complete a newer suggestion. New chat/logout/account change isolates late outcomes. Repeated success events are idempotent. Receipts restore within the existing tab-session lifetime, with safe legacy-draft identity migration and validation of cached completion fields.

Definite validation failures remain unsaved/editable. Uncertain save responses show **Save not confirmed** with a schedule link instead of claiming either success or no save. The existing form reconciliation flow remains required; no response is inferred merely from a refresh. No server schema/authorization/provider/request-budget changes were made for this fix, and it does not introduce automatic retries or writes.

Verification: 149 passing tests (eight new completion cases) plus syntax checks; browser edited title/worker/hours, persistence/navigation, unrelated Keep/manual save, rejection, committed-but-response-timed-out single save, and reset during late save. Updated user-story report: [all 14 stories pass within the checked scenarios](acceptance/cs031a/USER-STORIES.md). Current screenshots and logs: `cs031a-us05-evidence/`. Awaiting user review; no push/merge.
