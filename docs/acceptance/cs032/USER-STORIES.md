# CS-032 acceptance report

2026-11-23. Issue #54; `codex/CS-032-schedule-questions`. Local review only, awaiting explicit approval before push/merge.

| ID | Story and acceptance check | Result |
| --- | --- | --- |
| US01 | Employee asks about next shift, dated schedule and hours. | PASS in automated and real-provider checks: next Thursday 3h; current week 7h; next week 8h. |
| US02 | Manager asks about own business team or an exact named employee. | PASS: team 10h current week; Alex Morgan 3h. Foreign business returns no data; unknown/duplicate full name asks clarification. |
| US03 | Answers use current authorized assignments, business dates/timezone, and distinguish pending claims. | PASS: pending employee claim excluded, approval changes next answer, current assignment revalidated for saved detail; exact date boundaries, clipped overnight and DST checks. Business JSON bytes unchanged by question reads. |
| US04 | Empty and ambiguous questions are honest and linked shifts are real. | PASS: automated empty next result, live missing-period clarification, mutation request clarification, browser saved-shift detail link. Invalid/excessive dates rejected; full totals despite 20-card bound. |
| US05 | No unauthorized access or mutation through AI/questions. | PASS: scoped services and HTTP auth/CSRF/origin/JSON/no-query checks, unknown fields, private detail denial, account revocation after inference, provider output validation, shared allowance/timeout/concurrency checks. No mutation tools or action controls on answer cards. |
| US06 | Both-role chat works without regressing existing tasks; recover and use keyboard/mobile. | PASS within checked scenarios: employee/manager task selector, real replies, preserved composer after simulated 503 and reload, explicit retry, persisted private mode, New chat, saved detail link, 320px fit, keyboard/Escape focus return. Full regression suite covers existing drafting, confirmation/completion, availability, matching and notifications. |

## Verification

`npm run verify`: **214 passing tests**, zero failures; syntax/diff checks pass. Fourteen new tests in `tests/ai-schedule-questions.test.js`. See `verification.txt`.

`provider-cases.json` preserves the initial 7/8 result: next-week inference returned unavailable. An explicit recheck subsequently asked for a date range despite “next week” being supplied. Added server-calculated business calendar anchors plus explicit supported-question guidance; `provider-recheck.json` records the successful 8h recheck. `provider-final.json` records **8/8 passing final cases**, including both roles, day/week/next, missing period and unsupported mutation. No automatic retries were added. One passing run does not guarantee all future provider replies; safe failure/clarification remains necessary. Live checks used fictional inputs and existing bounded configured provider allowance.

Browser evidence: `employee-question.png`, `manager-question.png`, `mobile.png`, `recovery.png`, `selected-shift.png` and `review-preview.png`. Provider unavailable simulation was a temporary preview-only wrapper; no test hook was added to product routes. Scope/error/DST/concurrency verification is automated; this is not an exhaustive accessibility audit.

## Local review

Manager: `http://localhost:3027/workspace/manager/overview`; employee: `http://127.0.0.1:3027/workspace/worker/shifts`. Different hostnames isolate cookies. Fictional manager `manager_morgan@example.test`, employee `worker_jamie@example.test`, passphrase `Fictional chat review access!`. Dedicated temporary JSON, separate from real desktop data.

Open AI assistant, select **Ask about schedules**, then send “How many hours am I working this week?” Employee has 7 assigned hours and one additional pending claim excluded from hours. Next week is 8 assigned hours. Manager team current week is 10 assigned hours. Fixture clock is fixed at November 23, 2026, 11 AM Toronto for repeatable relative-week checks; real server uses current time. Historical seed shifts intentionally remain separate from these upcoming fixtures.

## Limits

Read-only questions only. No open-shift recommendations, availability mutation, match explanations, batch creation, payroll or staffing recommendations in this task. Explicit dates support up to 31 days; a week is Monday–Sunday. Exact employee names can require clarification. Interpretation can fail or ask for clarification; saved schedule stays usable. Cached transcript is a dated snapshot, not a live schedule. Pending next-question count covers future claims, not just the next shift. CS-018 remains last.
