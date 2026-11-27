# CS-068 More manager drafts in chat: add an employee, copy a week, duties in edits

Issue [#157](https://github.com/EldarSadeghi/soen287-covershift/issues/157). A manager can ask the chat to prepare three more kinds of change. The chat only prepares them. The manager reviews and saves each one on Team, in the chat's batch review or in the Schedule edit form, and those keep their own checks. No paid AI call is made to prepare them.

## Baseline (main at `5bc445f`)

528 tests, 25 offline acceptance scenarios with 217 checks, offline evaluation with 0 write-capable wrong routes.

## What changed

- **Add an employee** (`addEmployee`): "Add Sam Rivera as an employee", "add a new worker called Priya Shah, priya@example.com", "onboard Dana Kim", "hire a new employee".
  - The card shows the name and email the message gives ("Add it on Team" for anything missing). It says that adding them creates a one-time setup link and sends no email.
  - "Review on Team" puts the details in this tab's session storage, never the address bar. The Team page fills in its Add a worker form, says "Prepared in chat. Check the name and email, then choose Add worker.", and focuses the next step. The handoff belongs to the signed-in manager and business, lasts 10 minutes and is used once. Nothing is saved until the manager chooses Add worker.
- **Copy a week** (`copyWeek`): "Copy this week's schedule to next week", "copy last week to this week", "duplicate next week into the week after".
  - A new read-only `copyWeek` lookup returns copies of the week's shifts in the target week. They keep the same title, employee, local times (overnight shifts stay overnight) and duties. The copies include the private drafts the manager sees on Schedule.
  - Shifts that can't be copied are listed with a reason: the employee is no longer active, the copy would start in the past, or the week has more than 40 shifts.
  - The copies open in the existing batch review ("Week copy · Not saved"). Every row can be edited there, and one confirmation saves them all.
- **The 40-shift limit for copies** (your decision). A batch sent with `copy: true` may hold up to 40 shifts, but only if every shift starts in the same Monday–Sunday week. Other batches stay at 2–5.
  - The save repeats the usual checks for every shift: conflicts, approved time off, and a prepared publication period. It is all or nothing, and it is saved as private drafts when publication is on.
  - The storage schema now accepts batch receipts of 1–40 shifts, and the chat keeps a copied batch (with its duties) across a reload, so an uncertain save can still be checked or retried.
  - Changing this is a change to the save rules, so tests cover each limit.
- **Duties in edits** (`shiftDuties`): "Add 'restock fridge' to Friday's opening shift", "add a duty to restock the fridge on Jamie's Friday shift", "add a task to Friday's closing shift: wipe tables".
  - The chat reads the duty (in quotes, after a colon, or after "duty"/"task") and the shift (date, title word, employee).
  - A new read-only `shiftDuties` lookup finds the shift. One match shows "Ready to add a duty" with the current duties and "Review on Schedule". Several matches show a list to choose from, and no match gets an honest answer.
  - The link opens that shift's existing edit form with the duty added to the list. The manager chooses Save changes, and the form's revision check still applies.
  - A locked shift (started, or with linked coverage requests), a shift that already has 10 duties, or a duty that's already on the shift gets the reason and no edit link.
  - With no date, the chat asks "Which date's shift…?". With no duty, it asks "What duty should I add?"
- **Routing.** Three manager routes, checked before shift edits and new-shift drafts. They are added to the routing log, the classifier's manager options (with examples that differ from the evaluation messages), the composer's allowed list and the evaluation's write-capable list. Employees never reach them.
  - "Add sam to the friday evening shift…" and "create a shift…" stay shift drafts.
  - "How do I add a new employee?" stays help.
  - "add jamie to the team schedule friday" isn't read as a new employee.

## Review fixes (Codex on PR #158)

- **A named destination is used, or the chat asks.** "Copy this week's schedule to December 14" used to prepare copies for the following week. The message is now read in two parts, split at "to", "into" or "onto": the week to copy, then the destination.
  - Each part may be a relative week ("next week"), "the week after", or a date ("December 14", "the 14th", "2026-12-16", "Monday"), which means that date's Monday–Sunday week.
  - The chat asks "Which week should I copy, and to which week?" in these cases:
    - a date that can't be read ("February 30");
    - two weeks in the destination ("to next week and the week after", "to December 14 next week");
    - a destination that isn't a week ("to the team");
    - a destination that is earlier, or more than 12 weeks later ("to November 2", read as next year).
  - The review and the chat reply now name both weeks.
- **A copied batch survives a reload for any team the copy flow accepts.** The chat only restored batches listing up to 50 employees, so with 51 an uncertain copied save lost its confirmation ID on reload. Copied batches now keep up to 1,000 employees (`MAX_COPY_ROSTER`, the same on client and server), and the copy lookup refuses larger teams up front. Other batches keep their limit of 50.
- **Tests.** Destination cases, including the reported one; reload of an uncertain 40-shift copied batch with 50, 51, 300 and 1,000 employees (restored with the same ID), with 1,001 (not restored), and the 50-employee limit for other batches; the lookup accepting 1,000 employees and refusing 1,001. 535 / 535 tests, 25 / 25 acceptance scenarios, routing snapshot unchanged, offline eval 0 write-capable wrong routes.
- **Browser.** "Copy next week's schedule to December 14" → "Copies of 7 of 7 shifts from the week of Nov 30 to the week of Dec 14…"; "copy next week to November 2" → the chat asks which weeks.

## A note on the issue text

The issue said duties would not be copied. The existing batch save already keeps a shift's duties, so copies now keep them, and the review says so ("1 copy keeps its duties").

## Checks

| Check | Result |
| --- | --- |
| `npm run check` | Passed (syntax and format) |
| `npm test` | 532 / 532 passed (4 new tests: routing, reading the requests and the Team handoff, copy-a-week lookup and batch limits, duty lookup with the edit save) |
| `npm run ai:acceptance` | 25 / 25 scenarios, 217 checks |
| `npm run ai:eval` (offline) | 0 write-capable wrong routes; new routes 13 / 16 local (3 paraphrases left to the classifier) |
| Evaluation set | 16 new labelled messages (327 in total); existing IDs unchanged. The evaluation refuses anything that looks like contact data, so the email example is tested in unit tests only |
| Routing snapshot vs `main` | 462 phrases (16 new), 144 follow-ups; **no existing phrase changed** |
| Live evaluation | Not run. The evaluation's 500-call lifetime cap was reached in the CS-067 run, so a live run needs that ledger cleared or the cap raised, with your approval |

## Browser check (fictional demo, manager Morgan Chen, America/Toronto)

The preview gave Opening service a fictional duty ("Unlock the doors") through the app's own edit service.

| Message or step | Result |
| --- | --- |
| Add 'restock fridge' to Thursday's opening shift | "Ready to add a duty · Opening service · Jamie Lee", duties now "Unlock the doors" |
| Review on Schedule | The edit form opens with "Unlock the doors" and "restock fridge"; Save changes → "Private draft saved"; the card shows 2 duties |
| copy next week to the week after | "Week copy · Not saved · Review 7 shifts", "Copies of 7 of 7 shifts from the week of Nov 30 to the week of Dec 7… 1 copy keeps its duties." Confirm → "7 private shift drafts saved" (more than the old 5-shift limit) |
| Add a new worker called Priya Shah, priya@example.test → Review on Team | Team form filled with Priya Shah and the email, the note shown, focus on Add worker, the handoff used up and the address cleaned. Not submitted |
| add 'check invoices' to Alex's Thursday shift (320px) | "Can't add this duty", with the coverage-lock reason and Open Schedule; no horizontal overflow |

During the check, the Team page didn't fill in at first: an editing slip had left the handoff code out of `team.js`. I added it and re-checked; the row above is the result after the fix. The AI allowance stayed at 5 of 5, and the scripted provider logged no calls.

## Out of scope

Sending setup links or invitations, approving, deleting and publishing from chat. CS-043 deployment remains last.
