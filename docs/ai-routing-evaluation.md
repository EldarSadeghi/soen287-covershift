# AI routing evaluation (CS-054)

`npm run ai:eval` measures how well the chat routes real wording. It uses the same first-message routing as the browser: the local rules in `public/ai-chat-routing.js` first, then the server intent classifier only when the chat would otherwise ask its generic "What would you like me to check" question (`needsIntentFallback()`).

## Message set

`scripts/ai-eval/messages.json` holds 173 fictional messages: 165 single-turn messages (114 employee, 51 manager) and 8 follow-ups with one earlier turn and the chat's current topic (CS-056). Each one is labelled with the route a person sending it would want, decided before looking at routing output. They cover typos, slang, indirect wording, mixed requests, out-of-scope and unsafe messages. Names are the fictional demo employees. Edit `scripts/ai-eval/build-messages.mjs` and regenerate:

```bash
node scripts/ai-eval/build-messages.mjs
```

`tests/ai-eval.test.js` checks the file: unique IDs, labels valid for the role, at least 150 messages, at least 3 per route, no contact details.

## Running it

| Command | What it does | Paid calls |
| --- | --- | --- |
| `npm run ai:eval` | Local rules only. Messages that would need the classifier are reported as "not classified". | None |
| `npm run ai:eval -- --live` | Also sends each fallback message to the real classifier (default cap 200 calls). | One short classifier call per fallback message |
| `npm run ai:eval -- --live --max-calls 50` | Same, with a lower cap. | At most 50 |

Live runs read `OPENAI_API_KEY` and `OPENAI_MODEL` from the environment or `.env` and never print them. They use a separate usage ledger in `.covershift-ai-eval/usage` (lifetime cap 500), so they never consume the application's grading allowance in `DATA_DIRECTORY/ai-usage`. The provider account still bills the calls. Reports are written to `.covershift-ai-eval/run-*/summary.md` and `results.json`. The folder is ignored by Git.

## Measures and targets

| Measure | Meaning | Target |
| --- | --- | --- |
| Routed correctly | The route matches the label. | At least 95% |
| Unhelpful generic clarification | The user sees the generic "What would you like me to check" question, whether or not the classifier ran, although the message had a real route as its label. The report also shows all generic replies, including correct ones such as a reply to "hello". | At most 5% |
| Write-capable wrong route | Sent to `draft`, `availability` or `search` when that was not the label. These can lead to a saved change after the user confirms. | 0 |

Exit codes: 0 when the run passes, 1 when a target is missed, 2 for bad options or a missing key. Offline runs fail only on write-capable wrong routes, because those come from the deterministic local rules. A live run fails if any target is missed or any fallback message was not classified.

CS-055 changed the generic target from all generic replies to unhelpful ones. All generic replies are still reported. The CS-054 results in `docs/acceptance/cs054/` use the original definition.

The classifier can return only its own intents, so labels that only the local rules reach (`explanation`, `rules`, `alternatives`) are counted as misses whenever the local rules miss them.

## CS-059 manager lookups

The evaluation retains all 181 existing prompt IDs and adds 21 manager prompts covering availability, time off, coverage, publication and schedule look-alikes. The offline run covers 202 prompts with 55 classifier candidates and zero incorrect routes into write-capable features. For the approved live run, use `npm run ai:eval -- --live --max-calls 55`. Compare the 181 existing prompts with the previous live run by ID. The existing cohort must score at least 98.8%, in addition to the overall 95% accuracy, 5% maximum unhelpful generic reply rate and zero incorrect write-capable routes.
