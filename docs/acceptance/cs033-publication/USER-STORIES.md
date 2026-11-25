# CS-033 / issue #69 — Local review

2026-11-24. Branch `codex/CS-033-schedule-publication`. User selected following-Monday14-day window and manual publication with a Monday due/overdue indicator. Todo verified before In Progress. No feature push/merge authorized.

## Automated evidence

`npm run verify`: **337 tests, zero failures**. Full output: [verification.txt](verification.txt). Ten new tests cover:

- Draft isolation from employee reads/details, read-only AI schedule answers, coverage creation/open board, matching and notifications.
- Legacy visibility, private edit/removal, atomic release and before/after audit snapshots.
- Stale no-write rejection, durable idempotent replay and simultaneous duplicate publication.
- Approved-leave and pending-claim blockers; coverage changes after staging and safe discard. Coverage approval cards retain the live published title/time despite a separate staged edit.
- Business-local Monday selection,14-calendar-day DST boundary, due/overdue status and overlapping weekly windows.
- Real protected HTTP method/role/session/CSRF/query guards and create→publish→employee read.
- Foreign business isolation, forged draft validation and honest private-draft AI completion text.

The327 existing tests and offline AI acceptance scenarios continue to pass. No live provider calls were needed; publication is deterministic.

## Browser verification

| Story | Observed result |
| --- | --- |
| Draft privacy | Manager saw two unpublished shifts for Nov30–Dec13. Alex's Nov30 view was empty; existing published shifts stayed visible. |
| Explicit release | Review publication showed the dated window and change count. Confirm publication made Alex's Monday shift visible with duties and published period/time. |
| Employee notice | Bell displayed Schedule published; View schedule link was correct. Mark shown as read cleared the unread receipt. |
| Later edit | Manager changed Monday title/duties privately. Alex refresh still showed the original title/two duties until the next release. |
| Failed read | Owned proxy injected a single503 period read. View period recovered the current revision. |
| Lost acknowledgement | Owned proxy dropped a successfully saved publication response. UI showed uncertainty and the saved publication time. Check previous publication result returned Publication was already saved; history remained2 releases. |
| Private form save | Wednesday café service created through the real form produced Private draft saved feedback and stayed unpublished. |
| Keyboard/mobile | Escape returned review focus to Review publication. At actual320px the document width was305px with no horizontal overflow; date, draft summary and controls fit. Temporary viewport reset. |

Evidence: [manager review](manager-review.jpg), [320px manager](manager-mobile.jpg), [employee published](employee-published.jpg). Screenshots show the walkthrough state; subsequent read-only late-publication badge refinement is also covered by syntax/regression checks.

## Review preview and limitations

Isolated fictional server: manager `http://localhost:3048/workspace/manager/schedule`, Alex `http://127.0.0.1:3048/workspace/worker/shifts`. Password `CoverShift demo access!`; emails `manager_morgan@example.test` / `worker_alex@example.test`. Manager is Morgan Chen, Alex Morgan is an employee. Published Nov30 Monday and Dec1 Tuesday shifts exist; Wednesday Dec2 is a private draft ready to review. Normal data and old demo runs are preserved.

Activation is explicit via Prepare this schedule. Legacy shifts stay published and existing workflows retain their old behavior until activation; after activation all subsequent manager shift-form changes stage privately. No automatic release, external reminders, schedule optimization or removal of existing coverage locks. Monday is a due-date indicator; late publication remains allowed. Post-publication snapshots are retained on the server; the UI history shows manager/time/change count. No new paid/live-model semantic run was performed.

## Approved Week planner refinement and combined merge

User selected Week planner and explicitly authorized implementing it and merging it together with CS-033 on2026-11-24. Same increment/issue#69: create/edit forms now use a two-week day picker, Morning/Afternoon/Evening presets, separate From/Until selectors, Ends next day and an elapsed duration preview in the business timezone. Exact existing minutes and longer finish dates are preserved, AI application refreshes the visible planner, reset clears the planner, and server validation/uncertain-save protections remain.

Final `npm run verify`:341/341 pass (four new boundary/duration/DST tests), [full result](week-planner-verification.txt). Browser selected Dec10 and Morning preset, rejected a reversed interval, saved Sam's22:00–02:00 private draft, reopened its unchanged overnight range, then changed it to09:00–12:00 through the edit planner. Publication staging remained private. At320px, day buttons reflow to four columns and remain readable without overflow. Screenshots: [desktop](week-planner-desktop.jpg), [mobile](week-planner-mobile.jpg). This refinement and CS-033 are authorized for the combined push/merge; earlier no-merge instructions for this scope are superseded. No paid/live-model run was added.
