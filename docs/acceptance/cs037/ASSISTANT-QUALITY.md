# CoverShift assistant quality review

## What passed

The offline acceptance suite covers end-to-end workflow handling with fictional records and recorded provider replies. It includes saved schedules, manager drafting, employee availability and coverage, matching, authorization, recovery, leave, and eligible alternatives. CS-037 also received a browser walkthrough from conflict explanation to pending claim.

## What failed in conversation probes

Six employee messages were checked against the chat router, with three passes and three failures.

| Message | Observed | Expected |
| --- | --- | --- |
| Could you tell me when I work next? | Generic clarification. Reproduced in the browser. | Answer from the employee’s assigned schedule. |
| Can you put me down as available Friday? | Generic clarification in the router. | Ask for the missing hours or clarify the availability scope. |
| Would you show my saved availability? | Generic clarification in the router. | Load the employee’s saved rules. |

Canonical messages for next shift, opening search and an explanation routed correctly. The offline acceptance corpus supplies provider replies, so it cannot establish live interpretation accuracy. No live provider configuration was available in this work session. Browser checks used the isolated fixture.

## Proposed follow-up tasks in priority order

| Task | Completion criteria |
| --- | --- |
| Improve intent routing and clarification | Recognize common phrasing, polite prefixes, and safe requests with several intents. Ask a focused question when competing interpretations could lead to different actions. Add the three failed probes and paraphrases to the regression suite. |
| Preserve conversational context across workflows | Carry the reviewed search limits and selected shift from search to explanation to alternatives. Handle references such as “the second one” after intervening messages and require a fresh review if the referent changes. |
| Improve result, clarification, and recovery messages | Use consistent status text and one primary next action for empty, ambiguous, stale, or uncertain results. Add keyboard, mobile, and screen-reader acceptance checks for each state. |
| Add live-model acceptance | Use a separately configured test account and fictional data, track prompt interpretation by intent and paraphrase, and run repeated checks for dates, timezones, multi-turn context and side-effect boundaries. Publish observed failures and run settings alongside the offline results. |
| Finish planned assistant capabilities | Review CS-038 batch shift creation and CS-039 working-week summaries as their own increments, with explicit batch review, grounded summaries and role-based data access. |
