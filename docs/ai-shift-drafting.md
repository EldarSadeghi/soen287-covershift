# CS-031A — AI-assisted manager shift creation

Issue: [#44](https://github.com/EldarSadeghi/soen287-covershift/issues/44). Branch: `codex/CS-031A-ai-shift-drafts`. Local implementation; user approval required before pushing or merging. Employee availability (CS-031B) is separate. CS-018 remains the final step.

## How it works

On manager Schedule, expand **Draft a shift with AI**. Describe exactly one shift, including title, active worker, date, and explicit AM/PM or 24-hour times. Generate a suggestion; nothing is saved. If details are unclear, edit the description to include the answer and generate again. Clarification is stateless: a bare answer like “9 AM” does not carry forward the earlier description.

Example: “Opening service for Jamie Lee on December 3, 2026 from 9 AM to 3 PM.”

A complete validated suggestion shows its worker, title, exact dates/hours and business timezone. **Apply suggestion to form** explicitly replaces the four manual fields. Review/edit them, then use the ordinary **Create and assign shift** button. Only that save writes a shift. Input edits, Escape/cancellation, roster reload and saving invalidate pending suggestions; late replies cannot auto-apply. Manual entry remains available during AI calls and failures.

“Next Thursday” is defined in the instructions/UI as the next Thursday strictly after today's business date. “Next week” means the next Monday–Sunday calendar week. Always review the exact returned dates: language models are probabilistic, and these instructions do not prove the draft faithfully reflects every possible sentence.

## Private configuration

Node.js 24+, no new runtime packages. In the checkout you run, add to the ignored `.env` beside `package.json`:

```dotenv
OPENAI_API_KEY=your_private_project_key
OPENAI_MODEL=gpt-6-luna
```

Never commit/share the real key or put it in `public/`. Use a project key permitted to write Responses. Start/restart the server with `PORT=3002 npm run dev`; Node reads `.env` at startup. A file saved in a different checkout does not configure this one. Missing/revoked/expired/restricted keys or an unsupported configured model leave manual scheduling operational and show the AI recovery message when Generate is attempted. No other model is selected automatically.

The implementation calls `POST https://api.openai.com/v1/responses` server-side with strict JSON Schema, `store:false`, reasoning effort `none`, no tools, and a 1,200-output-token cap. The AI receives only the description, server-supplied date/time/timezone, and active same-business worker names with temporary references. It receives no stored passwords, emails, actual record IDs, schedule, or other businesses. Text the manager includes in the description is sent as written; the UI asks users to omit sensitive information. `store:false` does not promise zero provider retention; see [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data).

## Budget and operational limits

- At most **500 attempted provider calls across the lifetime of one DATA_DIRECTORY**; no monthly reset.
- At most **20 per manager per UTC day**, persisted across app restarts.
- At most **5 endpoint attempts per manager per 10 minutes** (in memory).
- One active inference per manager; two total in one server process.
- 1,500-character description, at most 50 active workers, whole serialized provider request at most 16,000 UTF-8 bytes, 1,200 maximum output tokens, at most 65,536 response bytes.
- 11-second inference/body deadline inside the existing 15-second browser deadline. No automatic paid retries or provider failover. Cancel/timeout cannot prove provider processing stopped; explicit later generations may incur another charge.

Reservations are private owner-readable files in `DATA_DIRECTORY/ai-usage/`; reserve before sending. They contain only a hashed manager ID and UTC date, never the key, description or response. Failed/refused/timed-out calls consume an allowance because the provider may have billed them. Serialized writes, atomic exclusive creation, fsync and a directory lock prevent competing reservations from bypassing limits. Corrupt/unexpected records or a stale lock fail closed. Do not delete/reset the ledger during grading: doing so replenishes the allowance. Back it up with the application data. After a crash, remove `ai-usage/.lock` only after confirming no process is writing; a partial reservation needs operator inspection, never automatic deletion.

This is a conservative request allowance, **not a dollar billing ledger**. At the fetched Nov 20, 2026 Standard GPT-6 Luna rates ($0.10/M input, $0.50/M output), the bounded workload is designed to fit well below the agreed US$5 usage budget. Provider token accounting/prices can change; this is not an exact charge guarantee. Configure the separate **US$5 provider hard spend limit** and **US$3 alert**, keep auto-reload off, and check actual provider usage. November/December monthly limits reset; this application's lifetime allowance does not. Different DATA_DIRECTORY values/checkout copies have separate allowances, while the provider account bills all calls. Revoke the project key after grading is completed, not before the grader has finished.

## Validation and security

`/api/manager/ai-shift-draft` requires a current manager session, same-origin JSON, CSRF token, no query-supplied business, and exactly one description field. Scope/worker context comes from current server records. Draft validation checks the full output shape, known temporary worker reference, current same-business active membership, current business timezone, title, strict calendar dates, ambiguous/nonexistent DST times, future start, increasing end and existing assigned-shift overlaps. Authorization and membership are checked again after inference.

The normal final-save endpoint independently rechecks everything atomically against the latest records; AI cannot authorize or perform a write. Provider response text is rendered as text, never HTML, and raw provider errors/secrets are not logged or returned. Provider failures are shown with one safe recovery message. As in manual creation, pending coverage commitments are not additional creation-time overlap checks; the accepted claiming/review workflow retains its own conflict rules. No automatic employee scheduling, multi-shift batches, recurring shifts, availability persistence, training or fine-tuning is included.

## Verification

- `npm run verify`: syntax checks and 136 tests, including 11 new AI tests covering minimized payload, no-write drafts, output shape/clarification, scoping, dates/DST/overlap/overnight, changed membership, provider refusal/failure/oversize/incomplete JSON, full-body deadlines/ignored abort, concurrency, persisted daily/lifetime limits, corrupt/stale ledger, and HTTP guards/rate limits/private paths.
- Optional **paid** evaluation: `node --env-file=/path/to/private/.env scripts/evaluate-ai-shifts.js`. Uses six fictional cases and the normal configured allowance; never reads actual business records. Not run by `npm test`. All six passed Nov 20, 2026: complete shift, next Thursday, overnight, ambiguous hours, unknown worker, availability rather than assignment. These examples establish observed behavior, not universal language accuracy.
- Real-provider browser preview on port 3017 with isolated fictional records: generate without saving, apply to editable fields, edit title and save exactly one shift, manager count/list updates, assigned employee sees same shift, clarification, Escape/focus and 320px reflow (innerWidth 320, document scrollWidth 305).
- Evidence: [suggestion](cs031a-evidence/suggestion.png), [applied draft](cs031a-evidence/applied.png), [saved](cs031a-evidence/saved.png), [employee](cs031a-evidence/worker.png), [clarification](cs031a-evidence/clarification.png), [mobile](cs031a-evidence/mobile.png). Separate temporary fake-provider QA checks cover [failure](cs031a-evidence/failure.png), [timeout](cs031a-evidence/timeout.png) and [cancelled late replies](cs031a-evidence/cancelled.png) without paid retries or real user data.

Official implementation references: [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses), [Responses create](https://developers.openai.com/api/reference/resources/responses/methods/create), [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna), [spend limits](https://developers.openai.com/api/docs/guides/spend-limits).
