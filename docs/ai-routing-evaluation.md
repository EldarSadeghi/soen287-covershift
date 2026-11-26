# AI routing evaluation (CS-054)

`npm run ai:eval` measures how well the chat routes real wording. It uses the same first-message routing as the browser: the local rules in `public/ai-chat-routing.js` first, then the server intent classifier only when the chat would otherwise ask its generic "What would you like me to check" question (`needsIntentFallback()`).

## Message set

`scripts/ai-eval/messages.json` holds 165 fictional, single-turn messages: 114 employee and 51 manager. Each one is labelled with the route a person sending it would want, decided before looking at routing output. They cover typos, slang, indirect wording, mixed requests, out-of-scope and unsafe messages. Names are the fictional demo employees. Edit `scripts/ai-eval/build-messages.mjs` and regenerate:

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
| Generic clarification | The user would see the generic question (fallback produced no route). | At most 5% |
| Write-capable wrong route | Sent to `draft`, `availability` or `search` when that was not the label. These can lead to a saved change after the user confirms. | 0 |

Exit codes: 0 when the run passes, 1 when a target is missed, 2 for bad options or a missing key. Offline runs fail only on write-capable wrong routes, because those come from the deterministic local rules. A live run fails if any target is missed or any fallback message was not classified.

The classifier can return only its own intents, so labels that only the local rules reach (`explanation`, `rules`, `alternatives`) are counted as misses whenever the local rules miss them.
