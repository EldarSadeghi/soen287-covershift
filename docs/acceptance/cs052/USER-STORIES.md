# CS-052 live-model checks and speed

## Run the checks

- `npm run ai:acceptance` runs the existing offline suite with recorded replies.
- `npm run ai:live-check -- --live` runs three scenarios with up to six live provider calls. Export `OPENAI_API_KEY` in the process environment first. The runner uses the application's existing model and loopback endpoints with an isolated fictional database and temporary usage storage. It sends fictional prompts and context to the provider. Reports in `.covershift-ai-acceptance/live-*/results.json` hold case IDs, outcomes, HTTP status and latency. The runner exits nonzero on failure or a change to the fictional records.
- `npm run ai:live-check -- --preview` starts the offline timing demo at port 3061. Sign in as Jamie and ask “When is my next shift?” The delayed scripted reply exercises the real browser progress and schedule card. Other chat tasks are outside this preview's scope.

## Acceptance cases

| Case | Expected result |
| --- | --- |
| Employee schedule | Recognize “when I clock in next,” return the earliest real assignment, and report seven assigned hours and one separate pending request for the business week. |
| Employee search follow-up | Resolve Thursday in the Toronto fixture, find the 2 PM opening, then apply “only after 3 PM” while retaining the date. |
| Manager draft follow-up | Resolve tomorrow to January 8, 2030 and Sam Rivera to the correct worker. On correction, retain the worker, title, date and end time while moving the start to 2 PM. |

## Timing

The browser's AI dialog exposes `data-progress-ms` and `data-answer-ms` for its current provider-bound turn. The clock starts on submission. Progress is sampled after the browser has had a rendering opportunity. Answer timing ends when the completed reply is in the DOM. Failed requests have no answer measurement. The live JSON report times the loopback API separately, from request to JSON receipt. These values stay local and depend on the browser, network and provider.

The scripted preview verifies instrumentation independently of language understanding. Live semantic accuracy and latency require an explicitly enabled provider run.
