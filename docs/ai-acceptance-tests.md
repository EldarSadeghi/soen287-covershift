# CS-029: Repeatable AI workflow acceptance

Run this from the CoverShift project folder with Node.js 24 or newer:

```sh
npm run ai:acceptance
```

The command runs 19 stable fictional conversation scenarios, prints PASS/FAIL by ID, and prints paths to a self-contained HTML report and machine-readable `results.json`. Open the printed `index.html` in a browser. Each run uses a new folder under the ignored `.covershift-ai-acceptance/`; earlier reports are retained. Open a failed scenario to see its check IDs and expected behaviors. Exit status is 1 on any failed scenario or runner error; all-pass exits 0. It needs permission to bind temporary loopback HTTP servers. Port conflicts with your normal website are avoided by requesting ephemeral ports.

For one scenario:

```sh
npm run ai:acceptance -- --case CS029-C03
```

The same corpus and scorer run as part of `npm test` / `npm run verify`. The full suite also retains the existing focused service, UI-state and security tests. No third-party dependency is added.

## Exactly what this verifies

Each scenario starts with its own temporary validated JSON database, a fixed January 7, 2030 clock, fictional manager/worker accounts, current assignments, pending/open coverage and a paused availability rule. It runs the real protected HTTP application and production AI services, JSON validation, eligibility, transactions, matching and notification projection. Synthetic authenticated sessions represent already-signed-in accounts; login/password setup has its separate regression tests. Cleanup stops each server and removes only that run’s temporary storage, including its synthetic usage ledger. This command does not import configured storage, load `.env`, read real account records, send API keys, or contact the real provider. Only loopback HTTP requests are made.

**Provider replies are paired recorded fixtures, not a working AI model.** The runner verifies that each expected task, latest message and conversation reach the provider adapter, that the strict structured-output/private-storage contract is preserved, and that the application handles that reply correctly. It does not prove that the actual model will produce the recorded interpretation, ask a good clarification, resist every prompt injection, or preserve every detail in a real conversation. Fake replies deliberately include invalid output, invented worker references, refusal and unavailable/timeout cases so validation and failure paths are exercised. None of these are production fault hooks.

The report labels this `offline-recorded-provider-replies`. There is no language-accuracy percentage. A finite passing corpus is regression evidence, not proof of perfect AI behavior.

| Stable ID | Conversation / expected result |
| --- | --- |
| CS029-C01 | Manager clarification, short follow-up and basic correction remain drafts; explicit save creates one shift; overlapping duplicate rejected. |
| CS029-C02 | Employee date/hour clarification and search return a saved opening; review/explicit claim stays pending until manager approval. |
| CS029-C03 | Seven employee assigned hours exclude a pending claim; fresh approved answer becomes ten hours; next shift is grounded. |
| CS029-C04 | Availability stays unsaved until confirmation; identical retry is idempotent; changed confirmation/stale lifecycle revision rejected. |
| CS029-C05 | Resuming the prepared confirmed rule matches once; original assignment remains; manager/employee receipts and approval transfer agree. |
| CS029-C06 | Own schedule/rule scope and foreign business isolation; question parsing context has no saved records, emails or hashes. |
| CS029-C07 | Invented worker reference and action-like extra fields cannot authorize saved changes. |
| CS029-C08 | Transport, HTTP error and timeout are safe failures; explicit retry works; composer storage retains text and stays account-scoped. |
| CS029-C09 | Provider refusal is a recoverable interpretation failure with no mutation. |
| CS029-C10 | Authentication, role, CSRF, origin and identity tampering rejected before provider work. |
| CS029-C11 | Another employee claims after search; stale confirmation cannot take the opening or transfer assignment. |
| CS029-C12 | Intentionally discarded availability acknowledgement reconciles by read; no automatic POST; explicit same-confirmation retry saves no duplicate. |
| CS029-C13 | Missing AI configuration leaves manual schedules and manager approval usable; unavailable AI is reported honestly. |
| CS029-C14 | Impossible calendar date, nonexistent Toronto DST time and excessive answer window rejected without mutation. |
| CS029-C15 | Account revoked during inference cannot receive a saved schedule answer. |
| CS029-C16 | Recorded unsupported recurrence/batch/“yes” clarifications cannot execute anything. |
| CS029-C17 | Manager team and exact-person totals, server Monday anchors and empty employee answer are grounded/read-only. |
| CS029-C18 | Intentionally discarded claim acknowledgement reconciles pending status; explicit stale retry produces no duplicate claim event. |
| CS029-C19 | Added with CS-030: approved time off constrains AI search/draft validation and direct claims; private notes stay out of provider context; cancellation restores eligibility. |

Lost acknowledgements are simulated **in the test client after the server has processed the request**. These cases verify server reconciliation/idempotency, not TCP disconnect timing, a browser’s visual uncertain state or button behavior. Composer persistence is tested through the real storage module; no browser typing/error UI is simulated. Existing browser acceptance evidence remains under the historical cs031a/cs031b/cs039 directories. A new browser walkthrough is still required when future increments change UI.

## Extending this baseline

Add a stable `CS029-Cxx` scenario in `scripts/ai-acceptance/scenarios.js`, with explicit expected model reply, exact messages/history and named checks on saved results. Do not implement a keyword fake model and call it language evaluation. Exercise both successful and denied/uncertain paths; assert read-only drafting separately from explicit commits. Use existing shared services and temporary fixtures. Keep scenario IDs stable so reports remain comparable; changing an expected result must be justified by an approved behavior change. Do not weaken assertions just to get green results.

CS-030–033 must add cases for time off, availability, duties and draft/published visibility across both manual and existing AI paths. CS-034–039 add their own conversation and confirmation cases as implemented. This baseline tests existing short follow-ups/corrections only; it does not claim the future full refinement, alternative-search or atomic batch features are complete. Run the expanded corpus at each increment and again before final CS-040 release.

The scorer itself has negative tests: a broken assertion, a swallowed assertion error, an empty scenario and an unused recorded turn must fail. Provider contract errors cannot be hidden by a service returning a safe 503. HTML report text is escaped. Reports contain outcome/check metadata, not cookies, CSRF tokens, private keys, model payloads, actual record dumps or exception stacks. Setup/contract errors are deliberately sanitized; locate the named fictional scenario locally to investigate.

## Optional real-model evaluation — paid and separate

No live evaluation is run by this command or by the default test suite. To evaluate real-model wording, use fictional conversations in the demo and compare interpretations/clarifications against the scenario expectations before confirming anything. Stop after a small pre-agreed number of calls; a request count is a bound on attempts, not a guaranteed dollar price. Actual charges depend on the configured model and usage. Existing account/project daily and attempt limits still apply.

For an existing scripted **two-request manager follow-up check**, the project already provides:

```sh
node --env-file=/absolute/path/to/private/.env scripts/evaluate-ai-shifts.js --chat-only
```

This is explicitly opt-in and bounded to two provider attempts, each with the existing 1,200-output-token and 16,000-byte request-body bounds. It uses a fixed November 20, 2026 interpretation clock and fictional read-only records, and consumes the existing configured usage allowance. It only measures those two manager cases, not all 19 workflows. Never run it automatically, paste the key into chat, or combine its results with offline counts. For wider evaluation, separately document date/clock, model, number of attempted calls, per-message semantic expectations and observed failures; provider variability and manual assessment remain limitations. No paid evaluation was performed for the CS-029 offline baseline.
