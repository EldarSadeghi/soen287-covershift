# CS-032 / issue #68 — Daily shift duties review

2026-11-24. Branch `codex/CS-032-shift-duties`. Local implementation only; no push or merge approved. Historical `../cs032/` evidence belongs to schedule questions (#54 / current CS-026) and is preserved.

## Automated verification

`npm run verify`: **327 tests pass, zero failures**. Full output: [verification.txt](verification.txt). Five new tests cover transactional schema12 upgrade and normalization; legacy no-write reads and omitted/cleared duties; malformed payloads and stale no-write edits; coverage transfer with edit locks; business-day overnight and exact-midnight boundaries. Existing full suite covers protected HTTP authentication, role/business scoping, CSRF, AI workflows and coverage conflicts. After the final focus-only frontend change, Node syntax checks and `git diff --check` pass.

## Browser walkthrough — isolated fictional data

| Story | Observed result |
| --- | --- |
| Manager adds duties | An 11-line list showed validation and did not save. Corrected three-line Café opening duties shift saved for Alex on Nov30, 09:00–12:00. |
| Manager edits duties | Saved list prefilled. Added fourth duty, saved and displayed in schedule and Alex's view. |
| Employee chooses a day | Nov30 showed the matching shift and four duties; unrelated shifts excluded. |
| Coverage retains work | Alex requested coverage; Jamie saw all four duties on Open shifts, confirmed claim; Morgan approved. Jamie's Nov30 My shifts retained all four duties. Alex's Nov30 view became empty. |
| Legacy display | Existing shifts on schedule/open board explicitly showed no duties. |
| Overnight display | Created Overnight café close Dec1 22:00–Dec2 02:00 with three duties. Alex's Dec2 filter included it with full start/end dates. Hours are labeled across listed shifts. |
| Responsive layout | Jamie's actual 320px viewport had document width305px, no horizontal overflow. Date control, All upcoming and full duty list fit. Native date segments remain keyboard reachable. Viewport override reset. |

Evidence: [employee desktop](employee-desktop.jpg), [employee mobile](employee-mobile.jpg), [manager edit](manager-desktop.jpg).

## Review preview

Fictional server3046 (same isolated JSON file also served on3047); normal accounts/data are untouched. Manager at `http://localhost:3046/workspace/manager/schedule`; Alex at `http://127.0.0.1:3046/workspace/worker/shifts`; Jamie at `http://127.0.0.1:3047/workspace/worker/shifts`. Manager is Morgan Chen; Alex Morgan is an employee. Select Dec2 for Alex's overnight duties, Nov30 for Jamie's transferred duties. Login emails are `manager_morgan@example.test`, `worker_alex@example.test`, `worker_jamie@example.test`; fictional password `CoverShift demo access!`.

## Limits

Manual lists only; no completion toggles/templates. My shifts filters upcoming/current assignments rather than completed history. Existing started/coverage-linked edit locks are intentional. No new live-provider or lost-response fault-injection run was performed for duties; existing save uncertainty behavior and AI acceptance suite passed unchanged. Applying AI drafts preserves manual duties; no AI-generated duties scope was added.
