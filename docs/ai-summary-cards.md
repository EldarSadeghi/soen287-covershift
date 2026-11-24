# CS-039: Summary cards and response guidance

Current task identities were renumbered on 2026-11-24. See [the consecutive register](implementation-plan.md#current-consecutive-task-register). Historical task IDs in this document and evidence filenames are aliases; use GitHub issue numbers for traceability. Deployment is CS-040 and remains last.

User selected **Summary cards** and approved implementing the four example response types on 2026-11-23. Issue #61; branch `codex/CS-039-summary-cards`. This is presentation and navigation refinement, without changes to provider prompts, models, scheduling rules, authorization or business schemas.

Every response uses a short heading, textual status, labeled fields or compact values, a separate consent/pending note, and a clear next action. Colors supplement explicit text. Schedule hours show assigned hours and shift count, with pending claims separate. Next-shift cards show date/duration plus exact saved shift fields. Calculations and older long replies use native expandable details; checked-at time/timezone remain visible. Empty answers are explicit.

Manager draft cards identify employee, title, local dates/times and timezone. **Review shift** continues through the existing editable Schedule form; the existing **Create and assign shift** action performs the save. Correlated successful saves show actual edited saved fields; uncertain saves show Check saved schedule with no resubmit action. No new direct chat save endpoint was added.

Employee availability cards show full window, title filter, maximum requests and timezone. Consent to automatic requests and manager approval remains visible before confirmation. Saved and uncertain receipts remain distinct; saved rules retain pause/resume/cancel controls. Existing confirmation IDs, revisions and matching semantics are unchanged.

Coverage search cards show eligible openings and exact saved shift fields. Review still calls current eligibility preflight; explicit confirmation submits the protected claim. Successful submission is **Pending manager approval**, never Assigned. Uncertain replies point to My requests rather than claiming success or restoring confirmation. Fresh checks, idempotency and late-response isolation retain their existing service implementations.

The latest structured response replaces the duplicated visible assistant paragraph; the bounded underlying conversation remains available for follow-up interpretation. Earlier long assistant replies are expandable. No answer is fabricated from hidden/missing records. Existing tab-session ownership/TTL and logout cleanup remain intact. Role/task-specific sample buttons fill the composer without sending or taking action. Privacy text moves into a native disclosure; it remains accessible from the composer.

A shared renderer builds DOM with `textContent`, native definition lists, text status badges, native details and links. No raw model HTML rendering. The dialog remains at the bottom-left on desktop and reflows at mobile widths. Reading space increases through a wider desktop card, shorter composer and collapsed privacy notes; the scroll container reveals the result heading without moving the underlying workspace. Focus stays in the composer after replies and returns there if a completed/cancelled action removes the focused button. The modal trap includes native summaries; completion headlines are announced through the existing status region.

See `acceptance/cs039/USER-STORIES.md` for checked scenarios, evidence and review login. CS-032 is complete in PR #63; CS-033–038/040 remain suggestions. CS-018 deployment/submission remains last. Explicit user approval is still required before pushing or merging CS-039.


Backlog update (2026-11-24): former unstarted AI IDs were renumbered into CS-045 and CS-050–055. See the authoritative old-to-new mapping and dependencies in [implementation plan](implementation-plan.md). Completed feature IDs and evidence remain unchanged.
