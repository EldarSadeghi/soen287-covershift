# CS-029 acceptance — 2026-11-24

Issue #62; local branch `codex/CS-029-ai-acceptance-tests`. Implementation ready for user review, not pushed or merged. Current prior increment CS-028 merged PR #71; final deployment remains CS-040.

| Story | Acceptance result |
| --- | --- |
| CS029-US01 — Run a repeatable baseline without paying for inference or using real records. | Pass. `npm run ai:acceptance` completed 18 independent fictional scenarios against real protected HTTP services, using fixed clock and recorded provider replies. No `.env` or configured storage import. |
| CS029-US02 — Cover the current manager and employee conversation workflows with traceable expectations. | Pass. Stable C01–C18 span clarification/follow-ups/basic corrections, drafts versus explicit saves, existing-opening claims, availability/lifecycle/matching, grounded schedule hours, pending distinctions and notifications. Full matrix in `docs/ai-acceptance-tests.md`. |
| CS029-US03 — Catch unauthorized, stale, duplicated and uncertain operations. | Pass within checked scenarios. Role/business/account scope, CSRF/origin/session and identity tampering, stale claims/revisions, duplicate rule/shift/claim attempts, revoked account, provider refusal/failure/timeout and intentionally discarded client receipts asserted. |
| CS029-US04 — See actionable pass/fail results and fail the command when a scenario fails. | Pass. HTML details and JSON include scenario/check IDs, expectations, outcomes and safe failure summaries. 18/18 scenarios, 137 checks. Negative scorer tests fail on a broken assertion, a swallowed assertion failure, no assertions and unconsumed replay; CLI unknown scenario and blocked production fixture both exit1. |
| CS029-US05 — Protect normal data and secrets. | Pass. Workspace and Desktop database fingerprints unchanged before/after actual CLI/full suite. Reports contain metadata only; no cookies/tokens/model payloads or normal records. No real-provider calls or credit used. `runner-verification.json`. |
| CS029-US06 — Keep tests running as future increments are added. | Pass. Same corpus is part of `npm test`/`npm run verify`; documented stable-ID extension and per-increment integration rules. Full verification: 243/243 tests plus syntax. |
| CS029-US07 — Understand what a green report does and does not demonstrate. | Pass. Report and guide prominently distinguish recorded-reply workflow handling from real-model language evaluation, manual UI testing and future feature completion. Optional bounded live procedure is separate and was not run. |
| CS029-US08 — Inspect results locally. | Pass. Browser at http://127.0.0.1:3036/index.html displayed 18/18 and 137 checks. Expanded C01 showed per-check outcomes for clarification, correction, explicit save and duplicate prevention. Screenshot `report.png`; HTML and JSON also open directly from disk. |

## Baseline artifacts

- `results.json` and `index.html`: generated all-scenario offline baseline.
- `cli.txt`: actual command summary (project path normalized).
- `verification.txt`: full 243-test/syntax result.
- `runner-verification.json`: CLI failure exits, zero live provider calls and normal-data preservation.
- `report.png`: browser proof of report summary/details.

Initial targeted checking exposed two test-harness mistakes: the preflight route was written as `/check` instead of the existing `/claim-check`, and a helper’s default argument made an undefined-field expectation incorrect. Those expectations were corrected against the existing application contract; no production workflow was changed to make tests pass. All final targeted cases passed before running the full suite and baseline CLI. A subsequent scorer review added a guard against false passes when production error handling catches a failed replay-contract assertion; a swallowed-error negative case verifies the guard. The final suite and CLI were regenerated after that correction.

## Practical limits

The provider is a deterministic recorded-reply adapter, not an AI model or language evaluator. Clarification quality, actual model interpretation/correction/injection resistance and semantic generalization remain unmeasured here. Matching/assertions run real services and saved transactions with fresh temporary fixtures and synthetic already-signed-in sessions. Login/password setup has existing separate tests. The UI composer case uses the real state module, not a simulated browser interaction. Lost acknowledgements are test-client receipt discard after server processing, not actual TCP faults or proof of visual browser recovery. Report rendering was checked in a desktop browser; no product UI was changed.

Current short follow-ups/basic correction handling are exercised; the full future CS-034 refinement feature is not claimed implemented. Future leave/publication/duties/batch features require new cases alongside their implementation. The CLI retains local report runs and does not provide automatic cleanup. Passing 18 scenarios or 243 tests is bounded evidence, not a guarantee of bug-free AI. No live provider evaluation was performed in this increment.
