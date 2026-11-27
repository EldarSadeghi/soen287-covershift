# Chat routing layout (CS-063)

The chat decides which feature handles a message with local rules first, and asks the server-side intent classifier only when those rules would give the generic "What would you like me to check" question.

## Files

| File | Contents |
| --- | --- |
| `public/ai-chat-routing.js` | Coordinator. Sets the order routes are checked in (`explicitRoute`), handles mixed requests and follow-up replies (`routeChat`, `resolveChatTarget`), clarification text and suggestions. Re-exports every function other modules use, so importers never depend on the internal layout. |
| `public/routing/text.js` | `normalizedMessage`, `chatRequests` (splits "X and Y"), the `anyOf` helper that builds one pattern from named parts, weekday and month lists. |
| `public/routing/status.js` | Employee status lookups (claims, cover requests, time off) and short date follow-ups. |
| `public/routing/employee.js` | Employee drafts, history, updates, duties, coworkers, explanations, saved rules, availability, open-shift search, and their helpers. |
| `public/routing/manager.js` | Manager lookups, edits to existing shifts, new-shift and batch drafts, team availability. |
| `public/routing/shared.js` | Summaries and schedule questions for both roles, and the this-week/next-week reader. |
| `public/routing/unsupported.js` | Commands the chat never carries out (approve, delete, cancel a shift, …) and the reply it gives. |
| `public/routing/dates.js` | One-day and history-period readers. |

## Order of checks (`explicitRoute`)

1. Employee status lookups.
2. Manager lookups.
3. Employee drafts, history, updates and duties.
4. Summaries.
5. Manager edits, then new-shift drafts.
6. Manager team availability.
7. Employee coworkers, explanations, rules, availability and search.
8. Schedule questions (broadest wording, so last).

Unsupported commands are checked before all of these, in every part of a message, and before any follow-up continues an earlier question.

## Changing routing safely

- `tests/routing-snapshot.test.js` compares what every routing function returns for 288 phrases (both roles) and 144 follow-ups with `tests/fixtures/routing-snapshot.json`. A pure refactor must leave it unchanged.
- For a deliberate change, run `node scripts/routing-snapshot.mjs` to list the phrases that changed, check each one, then `node scripts/routing-snapshot.mjs --write` and review the fixture diff.
- `tests/routing-groups.test.js` holds must-match and must-not-match examples per group.
- The server serves public files from an explicit list in `src/app.js`. `tests/served-modules.test.js` follows every import from each page's entry script and fails if a module is not served.
- New routes also need: the routing log's `ROUTES` list, the classifier's options if it should reach them, and, if they can lead to a save, the evaluation's `WRITE_CAPABLE` list and `PAID_INTENTS`.
