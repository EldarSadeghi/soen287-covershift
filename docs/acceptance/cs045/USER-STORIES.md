# CS-045 Chat intent routing and search context

[Issue #89](https://github.com/EldarSadeghi/soen287-covershift/issues/89)

| Browser prompt | Observed result |
| --- | --- |
| Could you tell me when I work next? | Jamie’s next assigned shift appeared. |
| Would you show my saved availability? | Jamie’s saved availability appeared. |
| Can you put me down as available Friday? | Chat asked for hours or explicit all-day availability. |
| Find an open shift Thursday from 2 PM to 8 PM | The card showed the date and 2–8 PM search limits. |
| Why did the second opening match? | The explanation resolved to Evening backup, the second opening from that search. |
| What else is available? | Alternatives kept the same date and 2–8 PM limits, excluded Evening backup, and showed Afternoon backup for review. |

Routing tests cover the previously failing paraphrases, focused clarification replies, and references that cannot be uniquely resolved. Selection still requires the server to confirm visibility. Reviewing a suggestion is separate from submitting a claim. The preview runs on port 3055 with fictional data and scripted provider replies. Live-model interpretation remains unverified.
