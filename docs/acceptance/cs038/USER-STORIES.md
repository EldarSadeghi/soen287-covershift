# CS-038 Manager batch shift creation through chat

[GitHub issue #58](https://github.com/EldarSadeghi/soen287-covershift/issues/58)

## Review walkthrough

Sign in as fictional manager Morgan Chen at [the local preview](http://127.0.0.1:3062/login). Open the assistant and use **Draft multiple shifts** or send a message asking for two to five dated shifts. The preview uses a scripted provider.

One example is “Draft two shifts: Opening service for Sam Rivera December 8 from 9 AM to noon and Closing service for Alex Morgan December 9 from 9 PM to 1 AM the next day.” Verify both rows, edit a title, worker, date, or time, then use **Confirm and save 2 shifts**. The Dec 7 schedule period is prepared in the preview. The first successful save response is deliberately dropped to exercise **Check batch receipt** after a reload. For a fresh proposal after the first batch has saved, ask for **two different shifts**.

## Acceptance

- The manager can edit exact worker, title, start, and end values. The business timezone is shown. Enter in an edit field keeps the batch in review.
- Save checks the current roster, business timezone, approved leave, assignments and other rows inside one transaction. An invalid row prevents the entire batch from saving. Overnight shifts need an explicit next-day end. Ambiguous or missing DST wall times are rejected.
- A business with schedule publication enabled saves private drafts in prepared periods. The existing schedule publication action makes them visible to employees. The batch follows the same publication setting as single-shift creation.
- The confirmation ID and batch receipt are scoped to the signed-in manager and business. Retrying the same confirmation returns the original receipt. A different payload using that ID is rejected. After an interrupted response, the chat preserves the exact batch in the current tab for receipt lookup or an explicit retry.
- Browser checks covered editing, keyboard confirmation, a 320px layout, and receipt recovery after a reload. The preview uses fictional data. Live-model parsing was not tested.
