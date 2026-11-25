# CS-033 — Monday publication of a two-week schedule

Managers publish manually on Monday for the following Monday through the Sunday13 days later. Dates/deadlines use the business timezone; each Monday's14-day window can overlap the previous one. The default view selects next Monday. Early preparation/publication and late publication are supported; first publication after the due Monday is labeled late. No automatic publisher, email reminder or external scheduler is added.

## Prepare, draft, review, publish

Open Schedule and choose the two-week start Monday. **Prepare this schedule** enables private draft staging for this business. Existing visible shifts stay published; subsequent manager shift-form creations, edits and removals save privately, including a form filled from AI. A shift's start date must fall in a prepared period. There is no implicit activation on read and no forced rewrite of old data.

The publication panel lists additions, updates and removals with names and times. Drafts may be discarded without changing the published schedule. Review publication opens a separate confirmation; only Confirm publication releases changes. Future published shifts remain editable under the existing restrictions: started shifts and shifts with linked coverage history are locked. Changes involving a move across the window boundary require a prepared14-day window containing both old and new start dates. Overnight shifts belong to their start date, even if they end beyond the window.

Private records are stored separately. Employee schedule/details, AI schedule questions, opening searches, coworker free-window calculations, coverage claims, rule matching and notifications continue using published `shifts`. Managers see a draft overlay in Schedule; manager AI schedule questions continue reporting published assignments. Drafts do not reserve employees' time. Approved leave, pending claims, current membership and assignment conflicts are checked again at publication under the storage lock.

Publishing atomically replaces the affected live shifts, retains before/after snapshots and records manager/time/review revision. Existing published shifts outside these changes are preserved. Affected employees receive private in-app receipts; My shifts shows published period dates/time. The original and new assignee are both notified after reassignment. Coverage approvals remain their own already-authorized workflow; they are not postponed to schedule publication.

## Retry and conflict behavior

Publication requires a fresh revision covering the period, pending drafts, current published assignments, team membership, coverage and leave. Stale review cannot overwrite new data. The same published revision replays its receipt across restart without creating duplicate notices. A lost-response UI keeps the original receipt request and provides Check previous publication result; reads can be retried with View period. If coverage changes after draft preparation, publication fails and the manager can discard/rebuild that draft.

Schema13 adds `schedulePeriods`, `scheduleDrafts`, `schedulePublications` and `scheduleNotifications`. Older schemas remain readable without a write. Normal account data is never reseeded. Deployment/rollback must account for schema13; older binaries cannot read it after activation. See acceptance evidence for the isolated fictional review.
