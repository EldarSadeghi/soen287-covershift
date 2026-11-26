# Multi-turn request status acceptance

November 26, 2026. Browser run against main at `92010c2`. All four planned scenarios passed. An exploratory exact-time reply exposed a gap.

## Reproduce locally

Run `node docs/acceptance/cs029-request-status/preview.mjs` from the repository root. The preview uses a new temporary fictional database, a fixed Toronto clock, and no AI provider. Sign in as Jamie (`worker_jamie@example.test`) at `http://127.0.0.1:3068/login` and Morgan (`manager_morgan@example.test`) at `http://localhost:3068/login`. Both use the fictional demo passphrase `CoverShift demo access!`. The two hostnames keep the logins separate. Restart the preview for a fresh fixture.

| Scenario | Steps and expected result | Observed |
| --- | --- | --- |
| Switch topics | Ask “Was my Thursday time off approved?” and “Did anyone accept my request to cover Thursday?” in the same chat. The answers should use the time-off request and cover invitation respectively. | Pass. Time off showed Awaiting manager approval and the cover invitation showed Waiting for coworker response. |
| Resolve ambiguity | Ask “Was my Friday time off approved?” and reply “the Friday evening one.” Both evening requests should remain available. Reply “the second one” to select the displayed second request. Separately, ask “Was my time off approved?” and reply “the Thursday evening one” for a unique descriptive match. | Pass. Friday kept both options and asked for more detail. The ordinal selected the 6:30 PM Friday request. The Thursday reply selected the 6:00 PM request. |
| Read a fresh decision | Ask Jamie’s Thursday question while it is pending. In Morgan’s Time off page, approve Jamie’s December 3 request from 6 to 7 PM. Ask the same question again in Jamie’s existing chat. | Pass. The answer changed from Awaiting manager approval to Approved without reloading Jamie’s page. |
| Reset context | After asking about time off, select New chat and ask “What about Saturday?” | Pass. The assistant asked what to check and did not reuse the previous time-off topic. |

## Exploratory finding

With both Friday evening options visible, “the Friday one at 8 PM” left both options visible and repeated the clarification even though one request starts at 8 PM. A numbered reply works. Recognizing exact local start times would let employees resolve this case in their own words.
