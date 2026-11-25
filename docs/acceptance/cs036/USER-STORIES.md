# CS-036 Availability matches and scheduling conflicts

[Issue #55](https://github.com/EldarSadeghi/soen287-covershift/issues/55)

Employee preview on port 3053. Sign in as Jamie Lee and use the single AI assistant chat. The explanation path reads the existing schedule and coverage data and does not call an AI provider.

| Story | Verification |
| --- | --- |
| Explain how a request was submitted and why it is pending. | Asked “Why is my coverage request pending?” The browser offered scoped choices. Weekend service reported that a saved rule submitted the request and that the original worker remains assigned until manager approval. Automated checks also cover a manual submission and expiry at shift start. |
| Explain why an open shift does not currently match. | Asked “Why did ‘Afternoon coverage’ not match?” using double quotes around the title. The browser showed a current overlap and the Weekend service rule’s date window, title filter and used capacity. It identified confirmation order and linked to Open shifts. No historical cause was claimed. |
| Review a current answer safely. | Check again performed a fresh read. Tests verify the next state after matching and at expiry, no data mutation, and no retrieval of another employee’s private request. |
| Use a small screen. | At 320 px, the open dialog’s scroll width equaled its client width. |

The isolated preview uses fictional data. The branch is prepared for local review before push or merge.
