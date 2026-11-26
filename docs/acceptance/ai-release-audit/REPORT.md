# CoverShift AI assistant acceptance audit

November 26, 2026 · `main` at `4453d69` · America/Toronto

| Verification layer | Result |
| --- | --- |
| Natural-language routing, date and reference probes | 41 passed, 13 failed across 54 probes |
| Recorded-provider workflow acceptance | 20 passed across 164 checks |
| Whole repository | 389 passed, 2 failed across 391 tests |
| Live-model cases | 3 blocked because this environment has no configured API key |

These tests measure different things and overlap. Routing tests verify the chosen workflow or date. Recorded-provider tests exercise real local workflow and persistence with fixed AI replies. Browser spot checks used isolated fictional data and verified two failed coworker prompts and a successful week summary. Live accuracy, live latency and hosted behavior remain unverified.

## Findings and proposed fixes

1. **Fix silent date changes first.** “Tomorrow or December first” silently checks December 1. A prompt with two ISO dates also silently chooses the first. “This Thursday” on Thursday resolves to the following Thursday. “Next Friday” on Thursday resolves to tomorrow without checking which Friday the user means. A summary for “two weeks from now” silently shows this week. Resolve explicit dates in the business timezone, preserve multiple candidates, and ask a focused question when the date is unsupported or ambiguous. Display the resolved day before consequential review.
2. **Route ordinary phrasing to the right feature.** “Is anyone free?”, “When am I on next?”, “Anything I can pick up?”, “Did my claim get approved?”, and manager approval shorthand miss their intended workflows. Add paraphrase families and nearby negative cases for roles, negation and mixed requests. For narrow claim questions, lead with the relevant saved status or ask which claim. A weekly summary is only the first step toward answering those questions well.
3. **Improve rate-limit recovery.** The reported employee schedule screenshot showed “Too many AI drafting attempts.” The shared server limit uses that copy for multiple AI workflows. Keep the budget, name the affected action, tell users when to retry if known, and link to a saved-record path. Basic own-schedule reads can use existing deterministic data paths and remain available during a provider outage. The original paste issue was not reproduced as a clipboard bug.
4. **Freeze the notification test clock.** The two failing tests create future shifts relative to a fixed November 22 fixture, then call notification reads without supplying that same clock. Once November 26’s shift starts in real time, the reads correctly show expired. Fix the tests to use the fixture clock, and keep the separate explicit expiry test. This is a test defect rather than evidence of a production expiry defect.

## Feature ideas after the fixes

- **Coverage status lookup.** Ask whether a particular claim was approved or why it is pending. Return the saved status, the shift, a link and the next step. If several claims match, list the choices.
- **Date and time follow-ups.** Carry an exact date across a lookup and allow a user to narrow to “after 5 PM” or compare two explicit days. Show the effective filters. Preserve privacy by using derived free windows.
- **Guided cover preparation.** From an eligible saved shift and coworker free window, prepare a cover invitation for review. Keep explicit send confirmation, current eligibility checks and approval rules.
- **Deterministic daily briefing.** Answer “What do I need to do today?” with assigned shifts, duties and the user’s pending items. Add links to the current records and make the date and timezone visible.

## Release gate

Turn the 13 failing prompts into regression checks. Require zero silent date substitutions, correct routing or a focused clarification for the agreed prompt set, and successful privacy, confirmation and recovery checks. Rerun the offline suite with fixed fixture clocks. On staging, run the three opt-in live cases and both browser role walkthroughs. Measure visible progress and completed answers separately, including rate-limited and unavailable responses. Use repeated measurements before setting a latency target.

## Natural-language user stories

E means employee. M means manager. Dates are anchored to November 26, 2026. Reference probes start with two displayed openings. A route pass means the message reached the expected feature. It does not establish that the feature produced a correct live answer.

| ID | Role | Scenario | Prompt | Context | Expected | Observed | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| P01 | E | Routing | When’s my next shift? | — | use the assigned schedule | use the assigned schedule | PASS |
| P02 | E | Routing | When is my shifts? | — | use the assigned schedule | use the assigned schedule | PASS |
| P03 | E | Routing | What time do I start tomorrow? | — | use the assigned schedule | ask a focused question or explain the limit | FAIL |
| P04 | E | Routing | When am I on next? | — | use the assigned schedule | ask a focused question or explain the limit | FAIL |
| P05 | E | Routing | Show my working week | — | show a saved-record summary | show a saved-record summary | PASS |
| P06 | E | Routing | What about next week? | summary | show a saved-record summary | show a saved-record summary | PASS |
| P07 | E | Routing | Did my claim get approved? | — | show a saved-record summary | ask a focused question or explain the limit | FAIL |
| P08 | E | Routing | Show my pending requests | — | show a saved-record summary | show a saved-record summary | PASS |
| P09 | E | Routing | Is there any availbility for my coworkers on December first? | — | check confirmed coworker free windows | check confirmed coworker free windows | PASS |
| P10 | E | Routing | Who could fill in Friday? | — | check confirmed coworker free windows | check confirmed coworker free windows | PASS |
| P11 | E | Routing | Is anyone free on December first? | — | check confirmed coworker free windows | ask a focused question or explain the limit | FAIL |
| P12 | E | Routing | Is anybody free Thursday? | — | check confirmed coworker free windows | ask a focused question or explain the limit | FAIL |
| P13 | E | Routing | Find an unclaimed shift on Thursday | — | find eligible openings | find eligible openings | PASS |
| P14 | E | Routing | Anything I can pick up Thursday? | — | find eligible openings | ask a focused question or explain the limit | FAIL |
| P15 | E | Routing | Find an open shift Thursday and show my saved availability | — | ask a focused question or explain the limit | ask a focused question or explain the limit | PASS |
| P16 | E | Routing | I can work Thursday | — | ask a focused question or explain the limit | ask a focused question or explain the limit | PASS |
| P17 | E | Routing | Put me down as available Thursday | — | prepare an availability draft | prepare an availability draft | PASS |
| P18 | E | Routing | Show my saved availability | — | show or review a saved rule action | show or review a saved rule action | PASS |
| P19 | E | Routing | Pause my Friday rule | — | show or review a saved rule action | show or review a saved rule action | PASS |
| P20 | E | Routing | Why can’t I take the second one? | search | explain the referenced opening or request | explain the referenced opening or request | PASS |
| P21 | E | Routing | What else is available? | search | offer filtered alternatives | offer filtered alternatives | PASS |
| P22 | E | Routing | Any alternatives after 4 PM? | search | ask a focused question or explain the limit | ask a focused question or explain the limit | PASS |
| P23 | E | Routing | Draft two shifts for Alex | — | ask a focused question or explain the limit | ask a focused question or explain the limit | PASS |
| P24 | E | Routing | What is the weather? | search | ask a focused question or explain the limit | ask a focused question or explain the limit | PASS |
| P25 | M | Routing | Could you draft Closing service for Alex? | — | prepare a manager shift draft | prepare a manager shift draft | PASS |
| P26 | M | Routing | Put together two shifts for Alex and Sam | — | prepare a manager shift draft | prepare a manager shift draft | PASS |
| P27 | M | Routing | Show shifts for Alex | — | use the assigned schedule | use the assigned schedule | PASS |
| P28 | M | Routing | Show the whole team’s schedule this week | — | use the assigned schedule | use the assigned schedule | PASS |
| P29 | M | Routing | What needs my attention this week? | — | show a saved-record summary | show a saved-record summary | PASS |
| P30 | M | Routing | Pending approvals next week | — | show a saved-record summary | ask a focused question or explain the limit | FAIL |
| P31 | M | Routing | Which shifts still need cover? | — | show a saved-record summary | show a saved-record summary | PASS |
| P32 | M | Routing | Is anyone waiting for my approval? | — | show a saved-record summary | ask a focused question or explain the limit | FAIL |
| P33 | M | Routing | Do not draft a shift | draft | ask a focused question or explain the limit | ask a focused question or explain the limit | PASS |
| P34 | M | Routing | Schedule Alex and show pending approvals | — | ask a focused question or explain the limit | ask a focused question or explain the limit | PASS |
| P35 | M | Routing | 2 PM | draft | prepare a manager shift draft | prepare a manager shift draft | PASS |
| P36 | E | Coworker date | Who is free today? | — | 2026-11-26 | 2026-11-26 | PASS |
| P37 | E | Coworker date | Who is free tomorrow? | — | 2026-11-27 | 2026-11-27 | PASS |
| P38 | E | Coworker date | Who is free December first? | — | 2026-12-01 | 2026-12-01 | PASS |
| P39 | E | Coworker date | Who is free 2026-02-30? | — | Ask which date/window or result | Ask which date/window or result | PASS |
| P40 | E | Coworker date | Who is free Tuesday or Friday? | — | Ask which date/window or result | Ask which date/window or result | PASS |
| P41 | E | Coworker date | Who is free tomorrow or December first? | — | Ask which date/window or result | 2026-12-01 | FAIL |
| P42 | E | Coworker date | Who is free on the 1st, 2026-12-01 or 2026-12-02? | — | Ask which date/window or result | 2026-12-01 | FAIL |
| P43 | E | Coworker date | Who’s free this Thursday? | — | 2026-11-26 | 2026-12-03 | FAIL |
| P44 | E | Coworker date | Who is free next Friday? | — | Ask which date/window or result | 2026-11-27 | FAIL |
| P45 | E | Coworker date | Who is free January 2? | — | 2027-01-02 | 2027-01-02 | PASS |
| P46 | E | Summary dates | Show this week and next week | — | Ask which date/window or result | Ask which date/window or result | PASS |
| P47 | E | Summary dates | Show my working week today | — | Ask which date/window or result | Ask which date/window or result | PASS |
| P48 | E | Summary dates | What about next week? | — | next | next | PASS |
| P49 | E | Summary dates | Show my working week | — | this | this | PASS |
| P50 | E | Summary dates | Show my working week two weeks from now | — | Ask which date/window or result | this | FAIL |
| P51 | E | Reference | Why can’t I take the second one? | — | two | two | PASS |
| P52 | E | Reference | Why not that one? | — | Ask which date/window or result | Ask which date/window or result | PASS |
| P53 | E | Reference | Why not the first or second one? | — | Ask which date/window or result | Ask which date/window or result | PASS |
| P54 | E | Reference | Why not the fourth one? | — | Ask which date/window or result | Ask which date/window or result | PASS |

## Recorded-provider workflow user stories

Each story ran with the actual local HTTP workflow and temporary fictional storage. The provider reply was recorded.

| Scenario | User story and acceptance outcome | Checks | Result |
| --- | --- | ---: | --- |
| CS029-C01 | Manager clarification → follow-up draft → explicit save | 13 | PASS |
| CS029-C02 | Employee clarification → existing opening → confirmed claim → manager approval | 10 | PASS |
| CS029-C03 | Grounded employee hours exclude pending claims and refresh after approval | 9 | PASS |
| CS029-C04 | Availability draft → confirmation → idempotent retry → lifecycle revision checks | 10 | PASS |
| CS029-C05 | Confirmed rule matching, manager approval and notifications stay coordinated | 7 | PASS |
| CS029-C06 | Private schedules, roster context, foreign business and own-rule boundaries | 9 | PASS |
| CS029-C07 | Malicious or invalid provider fields never become save authority | 5 | PASS |
| CS029-C08 | Provider failures and retry preserve safe errors and the user’s message | 14 | PASS |
| CS029-C09 | Refusals never submit claims | 3 | PASS |
| CS029-C10 | Authentication, CSRF, origin, role and account-tampering checks | 8 | PASS |
| CS029-C11 | Opening changes after search: stale employee confirmation cannot steal a claim | 5 | PASS |
| CS029-C12 | Lost availability acknowledgement reconciles to one rule without automatic repost | 6 | PASS |
| CS029-C13 | Missing-provider configuration preserves manual schedules and approval | 6 | PASS |
| CS029-C14 | Invalid model dates, ambiguous DST time and excessive windows fail safely | 7 | PASS |
| CS029-C15 | Fresh account checks after provider response revoke stale authority | 3 | PASS |
| CS029-C16 | Unsupported recurring/multiple actions clarify without executing | 7 | PASS |
| CS029-C17 | Manager team totals, exact person scope, empty employee answer and calendar anchors | 8 | PASS |
| CS029-C18 | Lost claim acknowledgement reconciles pending status without duplicate events | 7 | PASS |
| CS029-C19 | CS-030 approved time off constrains existing AI/manual work without exposing notes | 11 | PASS |
| CS029-C20 | CS-037 alternatives retain approved limits and require fresh review and explicit claim | 16 | PASS |

## Live-model stories awaiting verification

| Role | User story | Acceptance outcome | Result |
| --- | --- | --- | --- |
| Employee | As an employee, I want to ask when I clock in and how many hours I’m scheduled for. | Earliest authorized assignment and correct business-week hours, with pending coverage excluded from assigned hours. | Blocked |
| Employee | As an employee, I want to search Thursday openings and revise the start-time filter. | Revised eligible results retain Thursday. No claim is submitted. | Blocked |
| Manager | As a manager, I want to draft a shift for tomorrow and correct its start time. | Correct local day and worker. The correction retains title, worker, date and end time. No shift is saved. | Blocked |

Run the offline scenarios with `npm run ai:acceptance` and the full suite with `npm run verify`. The opt-in live command is `npm run ai:live-check -- --live` with a configured provider key. The adjacent probe script prints the full expected-versus-actual results and exits nonzero when a probe fails.

## Prompt-fix retest

The original audit results above are the baseline. On the local prompt-reliability branch, all 54 probes passed. The browser demo also verified that a two-date coworker question asks which date to check, “Is anyone free on December first?” shows the December 1 lookup, and “Did my claim get approved?” opens the employee’s saved weekly coverage summary. That summary is the existing weekly view. A separate per-claim answer remains a feature proposal.
