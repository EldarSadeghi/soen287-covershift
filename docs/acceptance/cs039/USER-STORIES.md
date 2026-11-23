# CS-039 acceptance report

2026-11-23. Issue #61. Branch `codex/CS-039-summary-cards`. User approved the Summary cards direction and four response examples. No feature push/merge before separate explicit review approval.

| ID | Story / acceptance criterion | Result |
| --- | --- | --- |
| US01 | Read schedule hours and next-shift answers without a duplicated long paragraph. | PASS: shared card headings, assigned values, labeled dates/timezone, shift rows, native calculation disclosure; latest duplicated bubble is hidden while its card is shown. Earlier long replies remain expandable; underlying conversation unchanged. |
| US02 | Review manager draft, then see an honest actual saved/uncertain outcome. | PASS: controlled interpretation → real editable Schedule handoff → explicit save → correlated saved card. Edited recovery shift saved once despite a deliberately lost acknowledgement; uncertain card survives reload without Review/submit action. |
| US03 | Understand availability window, consent and lifecycle states. | PASS: labeled date/from/until/limit/title/timezone; cancellation saves nothing; real confirmation creates saved card and actual rule details; saved list pause works. Deliberately lost save acknowledgement produces uncertain card and a link to inspect saved rules. |
| US04 | Review/request coverage and distinguish confirmation from pending assignment. | PASS: real preflight, cancellation, fresh review and explicit claim. Pending card states original worker remains assigned; store check verifies this. Deliberately lost claim acknowledgement produces Request not confirmed with My requests link; no restored confirm control. |
| US05 | Use empty/error/limited states and retain private, safe recovery. | PASS: next-shift empty state explicitly shows 0 assigned and pending requests separately. An initial empty-next rendering bug was found in browser checking and corrected; fresh browser recheck passes. Existing rate limit preserves typed text. QA logout/account change clears previous conversation. All model/user strings use safe DOM text construction. |
| US06 | Read/interact by keyboard and on mobile, with no backend workflow regressions. | PASS within checked scenarios: status/field labels, native expandable notes, summary focus trap, Escape/focus return, response/composer focus, 320px reflow, samples only fill text. Full syntax/security/workflow regression suite remains passing. See evidence below. |

## Verification approach

Full `npm run verify`: **214 tests pass**, zero failures; syntax and diff checks pass. Existing suites cover permissions, provider transport/schema/allowance, date calculations, confirmation/correlation, uncertainty, concurrent claims, matching, notifications and storage. No new paid inference capability or automatic retries were added. UI interactions were verified in the browser rather than implementation-mirroring snapshot tests.

Controlled QA port3029 uses deterministic interpretation outputs and **real application services and JSON commits** for draft handoff/save, coverage preflight/claim, availability lifecycle and receipts. It does not evaluate language interpretation. A temporary local proxy on3034 discarded successful POST acknowledgements to check all three uncertain receipt types; these fault hooks are outside product code. A second fictional employee avoids the existing per-account request throttle during recovery checking; protections were not weakened. Saved-record checks confirm one recovery shift, one evening claim and preserved original assignments. Seeded historical records remain separate.

A separate real-provider review on3028 verifies the same UI with the existing configured model. No prompt/model changes were made. Screenshots: hours, next-shift, draft, shift-saved, request-review, request-pending, availability-draft, availability-saved, three uncertain states, empty, mobile and final review.

## Local review

Employee: `http://127.0.0.1:3028/workspace/worker/shifts`; manager: `http://localhost:3028/workspace/manager/overview`. Fictional employee `worker_jamie@example.test`, manager `manager_morgan@example.test`. Fictional passphrase: `Fictional chat review access!`. Separate temporary data, not the desktop user's real accounts. Fixture clock fixed at November23, 2026, 11AM Toronto; production uses current time.

Try **Ask about schedules** → **My hours this week** or **My next shift**. Other tasks: Create a shift for Sam on Sunday 9AM–12PM; find an existing Thursday opening; prepare availability for Thursday 2PM–6PM. Confirming an availability rule may immediately submit the matching opening for manager approval, so use separate conversations/scenarios for manual-request and automatic-match demonstrations.

## Limits

This increment changes presentation; supported capabilities and date/confirmation rules remain those of CS-031/032. Long result lists require scrolling inside the dialog; native details reveal calculations and older long replies. Restored schedule transcript is a dated snapshot until queried again. Some saved/uncertain employee receipts show only title and a link after reload because the prior bounded cache intentionally retains no reusable authorization. Screen-reader semantics are inspected, not a full external assistive-technology certification.

Final review checks: real-provider employee answer is 7 assigned hours across 2 shifts; real-provider manager draft identifies Sam Rivera, Sunday November29, 9AM–12PM. At actual 320px viewport: document/dialog305px, card256px with scrollWidth256px, no duplicated visible assistant bubble. Shift+Tab from Close reaches the native Privacy disclosure; Escape returns focus to `ai-launcher`. A completed action removing its button returns focus to `ai-chat-message`. Short placeholders and textarea padding prevent an empty composer from wrapping/clipping. Final live previews remain open for review.
