# CS-032: schedule questions through AI chat

Current task identities were renumbered on 2026-11-24. See [the consecutive register](implementation-plan.md#current-consecutive-task-register). Historical task IDs in this document and evidence filenames are aliases; use GitHub issue numbers for traceability. Deployment is CS-040 and remains last.

Issue #54, branch `codex/CS-032-schedule-questions`. Both roles select **Ask about schedules** from Chat task. Employees ask about their own assigned shifts. Managers ask about the entire team or one exact full employee name. Examples: “When is my next shift?”, “Am I working Thursday?”, “How many hours am I working this week?”, “Show Alex Morgan’s schedule next week.”

The provider only extracts a bounded question: next upcoming shift, assigned schedule, or hours over a 1–31-day date window. The server supplies current business time and calendar anchors for today/tomorrow and Monday-based weeks, validates interpretation, and calculates answers from a fresh authorized JSON snapshot. No schedule records, team roster, account identifiers, passwords or returned answers are automatically sent to the model; the user's text and bounded conversation may contain names they type. Existing configured model and shared persistent allowance/concurrency/timeout protections remain in use. No automatic inference retries.

Next excludes an already-started shift and means earliest assigned start at/after the checked time. Date windows use business-local midnight boundaries with inclusive start/exclusive end; UI displays the inclusive calendar dates. Overlapping overnight shifts are included, but hours count only the portion inside the requested window. Actual elapsed hours handle DST; manager team totals sum employee hours. These are scheduled elapsed hours, not payroll/break-adjusted wages. Results cap rendered shift cards at 20 **after** computing full counts/hours. Future pending claims are counted separately, never treated as assigned hours. For next-shift questions that count covers all future pending claims in scope; range questions restrict it to overlapping dates.

Answers include scope, timezone, checked-at time, honest empty results and saved-shift links. `GET /api/schedule-shifts/:id` revalidates the current account, business and assignment. The linked schedule page shows a selected read-only saved detail, including past shifts; reassigned/foreign records fail closed. The usual schedule's existing controls retain their own validation and explicit save flow. The new detail and question services never transact on business data. Only provider usage accounting persists during a question.

`POST /api/ai-schedule-question` requires authenticated session, origin, JSON, CSRF, no query overrides, existing AI rate/usage limits, strict chat input and structured result validation. Ambiguous dates, missing periods, unsupported actions/filters and ambiguous manager names produce clarification/refusal rather than invented answers. Employees cannot name another person's schedule; managers cannot select another business. Provider output is not a fact source and cannot grant access or choose an account ID.

Chat task persists in the existing private per-tab state. Changing task resets its conversation/draft, New chat clears answers, and logout clears state. Rendered answer cards are intentionally fresh-response-only; reloaded conversation text remains a dated snapshot, and the user asks again for current results. Existing create/search/availability tasks remain separate. Read-only questions do not confirm or save any shift, claim, rule or notification.

Implementation follows the official [Structured Outputs documentation](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses), using strict JSON schema and independent server validation/calculation. See `acceptance/cs032/USER-STORIES.md` for checks and known limits. CS-033–040 remain unstarted proposals; CS-018 stays last.


Backlog update (2026-11-24): former unstarted AI IDs were renumbered into CS-045 and CS-050–055. See the authoritative old-to-new mapping and dependencies in [implementation plan](implementation-plan.md). Completed feature IDs and evidence remain unchanged.

## Manager lookups

The manager chat can read team availability, approved and pending time off, coverage, and schedule publication. Schedule questions about who is working or on the rota continue through the existing schedule-question route.

- Availability uses the Availability page’s rules and shows each matching employee’s status and reason. Ask “Is Alex Morgan available on December 3?” or “Who is free tomorrow afternoon?”
- Time off shows approved leave and pending requests in the requested local date or date range. The chat response includes names, dates and status. Notes and request history stay on the Time off page.
- Coverage shows open, claimed and awaiting approval, or covered requests for a date or shift title. Quote a shift title such as “Afternoon coverage” to match it exactly.
- Publication shows the two-week period, its Monday due date, publication status and unpublished shift changes. “Has the next schedule been published?” checks the same period the Schedule page opens by default.
- The manager attention summary includes pending time-off requests across the business and the next publication when due or overdue. Coverage counts still use the selected week.

When chat needs a date, reply with a business-local date such as “Friday” or “December 3.” The data reads use manager-only GET routes and consume zero AI allowance. Unmatched phrasing may use the intent classifier once. A read-only intent does not receive an intent pass.

See [CS-059 acceptance evidence](acceptance/cs059/USER-STORIES.md) for the test baseline and browser results.
