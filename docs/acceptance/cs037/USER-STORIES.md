# CS-037 Eligible alternative shifts

[Issue #56](https://github.com/EldarSadeghi/soen287-covershift/issues/56)

The isolated preview is on port 3054. As Jamie Lee, ask `Why did "Afternoon coverage" not match?` and choose **Find alternatives on this date (any hours)**. The original overlaps Jamie's schedule. QA submitted Afternoon backup in the fictional run and left Evening backup available for review.

| Story | Evidence |
| --- | --- |
| Find eligible alternatives to an unavailable or conflicting shift. | The browser excluded Afternoon coverage and showed the eligible backups. If an opening changes between search and review or between review and confirmation, the search card offers alternatives with the original search criteria. |
| Preserve the employee's limits. | Recorded acceptance checks confirm exact dates, times, title filtering and an empty result within limits. An empty results card offers explicit changes to hours or title where available. |
| Require a fresh review and explicit request. | The browser showed no confirmation before review, then submitted Afternoon backup as pending manager approval. The automated scenario checks review and suggestions are read-only, and covers stale and competing claims. |
| Keep suggestions scoped and bounded. | Alternatives use the same published open board and conflict filters as normal search. Results exclude the original shift and return at most five. Existing checks cover expired openings, worker and business scope, own shifts and leave. |

The alternatives and explanation buttons use deterministic services. General AI responses in the isolated preview use scripted replies.
