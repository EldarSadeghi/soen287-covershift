# CS-031A user stories and acceptance audit

Task: [CS-031A / issue #44](https://github.com/EldarSadeghi/soen287-covershift/issues/44). Audited application commit: `f95cc9c97235a7c5d6701f0cfaf293b9036c97ad`, branch `codex/CS-031A-ai-shift-drafts`. Date: 2026-11-20. This is an audit of the unmerged chat revision; writing stories is not approval to push or merge.

## Scope and interpretation

CS-031A provides the persistent chat shell and **manager single-shift drafting**. Employee availability rules, automatic coverage claims and notifications are CS-031B/C/D, not missing CS-031A functionality. Manager approval for coverage remains required. Deployment CS-018 remains last.

**Result: 13 stories pass; 1 is partially met (US05). CS-031A does not yet meet every criterion below.** Saving works, but chat does not acknowledge the successful save. No application code was changed during this audit.

| ID | Story summary | Result |
| --- | --- | --- |
| CS-031A-US01 | Reach assistant throughout the workspace | Pass |
| CS-031A-US02 | Open/close chat without losing page work | Pass |
| CS-031A-US03 | Describe a single shift and receive a validated draft | Pass |
| CS-031A-US04 | Answer follow-ups and correct prior details | Pass |
| CS-031A-US05 | Review/edit, explicitly save, and see consistent completion status | **Partial** |
| CS-031A-US06 | Protect existing manual entries | Pass |
| CS-031A-US07 | Continue bounded chat across navigation/reload | Pass |
| CS-031A-US08 | Reset chat without late-response interference | Pass |
| CS-031A-US09 | Recover from AI failure with manual scheduling available | Pass |
| CS-031A-US10 | Protect business scope, accounts and private keys | Pass |
| CS-031A-US11 | Bound requests and preserve allowances across restarts | Pass |
| CS-031A-US12 | Use full-screen chat at the tested mobile size | Pass |
| CS-031A-US13 | Read/scroll/operate chat with the keyboard | Pass in tested browser |
| CS-031A-US14 | Explain employee capability limits honestly | Pass |

A story is **Pass** when its stated criteria are supported by the tests, current source and the browser checks identified below. **Partial** means at least one criterion needs improvement. Passing finite examples does not establish that an AI will interpret every possible sentence correctly. The stories below express the agreed experience; the keyboard-reading criterion makes the accessibility expectation explicit beyond the earlier button-focus checks.

## User stories

### CS-031A-US01 — Find the assistant

**Result: Pass within the checked scenarios.**

**As a signed-in user, I want an AI assistant button available throughout my workspace, so I can reach it without leaving my current page.**

Acceptance criteria:
- One labelled sparkle/chat launcher remains at the bottom-left.
- Available on every manager page and the worker workspace shell, after authentication.
- Scrolling and page navigation do not remove the launcher.

Evidence: fresh browser inspection found one launcher on Overview, Team, History, Approvals and Schedule. Shared workspace mounting runs before role/page-specific views. Previous worker-shell evidence verifies the launcher there.

### CS-031A-US02 — Open and close chat

**Result: Pass within the checked scenarios.**

**As a user, I want to open a chat panel and close it when I need the page, so I can ask for help without losing my work.**

Acceptance criteria:
- Launcher opens a named dialog; desktop page remains visible behind it.
- Close/Escape returns focus to the launcher and leaves the current page intact.
- Closing alone does not clear conversation or require another paid request to reopen it.

Evidence: browser dialog/close/Escape checks and cached conversation rendering; no provider call occurs on open or close.

### CS-031A-US03 — Describe one shift

**Result: Pass within the checked scenarios.**

**As a manager, I want to describe one shift in ordinary language, so I do not have to enter every form field myself.**

Acceptance criteria:
- A complete request yields a card with title, active worker, exact start/end dates and business timezone.
- No saved assignment is changed during generation.
- Unknown/foreign/inactive workers, malformed output and invalid times cannot bypass server validation.

Evidence: fresh real-provider request for Jamie Lee / Opening service / December 17 / 09:00–15:00 yielded the matching card. `tests/ai-shift-draft.test.js` verifies no data writes and validation/DST/membership/overlap checks.

### CS-031A-US04 — Answer questions and correct details

**Result: Pass within the checked scenarios.**

**As a manager, I want to answer follow-up questions and correct earlier details naturally, so I do not need to repeat the entire request.**

Acceptance criteria:
- Missing/ambiguous details yield clarification rather than a saved shift.
- A short reply completes earlier details; a later correction overrides the changed details.
- The current roster and business timezone remain authoritative each turn.

Evidence: committed live evaluation evidence covers short-answer completion and hour correction retaining worker/date; prior browser evidence covers request -> question -> short answer -> draft. Fresh audit also checks missing hours. Conversation unit tests verify bounded history and current context.

### CS-031A-US05 — Review and explicitly save

**Result: Partial — F01 below.**

**As a manager, I want to review and edit the proposed shift, explicitly save it, and see its completion status, so I remain in control and know whether the task is finished.**

Acceptance criteria:
- Review shift opens the existing editable Schedule form, including from another manager page.
- Generating, reviewing and applying do not save the shift.
- Only explicit Create and assign shift saves; current permissions and conflicts are rechecked at that point.
- After a successful save, the assistant clears or marks the handed-off draft as completed rather than continuing to say nothing was saved. This criterion makes the expected end-to-end completion feedback explicit; it was not covered by the earlier button/hand-off checks.

Evidence: prior browser cross-page handoff/input-focus/no-save check; service and HTTP creation tests verify explicit save, duplicate/overlap rejection and persistence. Fresh audit completed the chat-to-save path: saved the edited fictional title “CS-031A acceptance — Opening service” for Jamie Lee on November 26, 09:00–15:00, and saw the manager count increase from 1 to 2. Schedule confirmed success, but reopening chat still displayed “DRAFT · NOT SAVED,” “Nothing has been saved,” and Review shift. Therefore this story is **Partial**, not a save failure. See finding CS-031A-F01 below.

### CS-031A-US06 — Protect manual entries

**Result: Pass within the checked scenarios.**

**As a manager, I want existing manual form entries protected, so an AI suggestion cannot silently replace my work.**

Acceptance criteria:
- A nonempty form prompts Replace with AI draft / Keep my entries.
- Until replacement is explicitly selected, existing fields remain unchanged.
- Keeping entries or starting a new chat dismisses the replacement prompt safely.

Evidence: committed browser replacement/Keep evidence, `public/create-shift.js` confirmation and cancellation handlers. No automatic form filling on generation.

### CS-031A-US07 — Continue the same tab conversation

**Result: Pass within the checked scenarios.**

**As a manager, I want my current conversation to survive closing the panel, reload and workspace navigation, so I can continue the same task.**

Acceptance criteria:
- Same account/business restores bounded tab-session messages and unsent composer text.
- No silent transcript truncation: a full chat asks for a new chat.
- Idle history and carried drafts expire; blocked storage has a usable in-memory fallback and an explicit cross-page handoff limitation.

Evidence: browser navigation/reload checks, `tests/ai-chat.test.js` restoration/expiry/blocked-storage checks and source context guards. Browser chat stores at most five completed exchanges; another send is blocked at that limit. Server independently accepts at most ten prior messages / 4,500 serialized UTF-8 bytes, and bounds the full request.

### CS-031A-US08 — Start over safely

**Result: Pass within the checked scenarios.**

**As a user, I want New chat to clear the current conversation, so an earlier request cannot interfere with a new task.**

Acceptance criteria:
- Clears transcript, composer, suggestion and unconsumed carried draft.
- A late response from the earlier chat cannot populate the new chat or erase newly typed text.
- Resetting does not replenish request allowances or automatically retry a paid request.

Evidence: state reset tests and committed delayed fake-provider browser evidence; revision checks guard late responses, while usage reservations are independent server files.

### CS-031A-US09 — Recover when AI is unavailable

**Result: Pass within the checked scenarios.**

**As a manager, I want a clear error and my unsent text retained when AI fails, so I can retry deliberately or continue manually.**

Acceptance criteria:
- Missing key/provider failure/refusal/timeout/rate limits have safe feedback.
- Composer text is retained and no fake successful assistant turn is appended.
- Manual scheduling remains operational; no automatic paid retries occur.

Evidence: provider/deadline/allowance tests, request-recovery tests, committed browser failure/timeout evidence and safe client error handling. Abort cannot prove the provider did not bill the request; this is disclosed.

### CS-031A-US10 — Keep accounts and secrets protected

**Result: Pass within the checked scenarios.**

**As a business owner, I want AI actions limited to my authorized business and private credentials kept server-side, so the assistant cannot expose or modify another business's data.**

Acceptance criteria:
- Current manager session, Origin, JSON, CSRF and fixed business scope required.
- History cannot supply system/developer/tool roles or authorize a worker/assignment.
- No API key/passwords/stored emails/other businesses are included in model context or browser state; user-entered text is disclosed as sent to OpenAI.
- Logout removes local chat state; another account/business does not restore it.

Evidence: HTTP guard/private-path tests, minimized provider payload assertions, history validation and state isolation tests, committed logout/worker browser evidence. User-typed sensitive data would still be sent; the UI warns against it. No claim of zero provider retention.

### CS-031A-US11 — Bound usage

**Result: Pass within the checked scenarios.**

**As the project owner, I want AI requests bounded, so repeated conversations cannot consume an unlimited grading budget.**

Acceptance criteria:
- Persisted lifetime and per-manager daily reservations count failed attempts too.
- Concurrency, route-attempt, history/input/output/body and deadline limits apply.
- New chat and app restart do not reset persisted allowances; exhaustion leaves manual scheduling usable.

Evidence: reservation concurrency/reopen/day/exhaustion/corruption tests; service/route bounds. Defaults: 500 attempts per data directory lifetime, 20/manager/UTC day, five route attempts/ten minutes. This is a conservative request cap, not an exact dollar cap: provider billing limits remain separate, as documented.

### CS-031A-US12 — Use chat on a phone

**Result: Pass within the checked scenarios.**

**As a mobile user, I want the chat to fit my phone with usable controls, so I can describe and review shifts on a small screen.**

Acceptance criteria:
- Full-screen dialog at the mobile breakpoint.
- At 320×760, no horizontal overflow and composer/close/send controls remain visible.
- Transcript can scroll within the dialog; the page does not need horizontal panning.

Evidence: committed mobile screenshot and measured 320×760 viewport, document width305 / dialog height760; fresh browser recheck where noted. Physical device virtual-keyboard behavior is not represented by viewport emulation alone.

### CS-031A-US13 — Read and operate chat with the keyboard

**Result: Pass within the checked scenarios.**

**As a keyboard user, I want to open, read, scroll and operate the conversation without a mouse, so I can use the complete chat workflow.**

Acceptance criteria:
- Named/labelled controls, usable focus indication, Tab/Shift+Tab containment, Escape and focus return.
- Older overflowing messages can be reached and scrolled while the assistant is asking a question, even when no draft card exists.

Evidence: control/focus checks pass. Scrollable `.ai-chat-body` is not explicitly focusable and the custom focus loop includes only buttons, textarea and links. Fresh clarification-state browser check confirmed that Tab from Close focuses the overflowing chat body automatically in the tested Chromium-based browser; Page Up moved scrollTop from 154 to 0. With a draft, Page Up from Review shift also scrolled the conversation after the browser animation settled. Thus this criterion passes in this browser. The lack of an explicit tabindex is not reported as a reproduced defect; other browser/screen-reader behavior remains additional verification.

### CS-031A-US14 — Understand employee limits honestly

**Result: Pass within the checked scenarios.**

**As an employee, I want the assistant to clearly explain which actions are currently available, so I am not misled into believing a claim or assignment was created.**

Acceptance criteria:
- Employee shell explains that availability/automatic claims are later increments.
- No manager composer/draft action or paid AI request is presented to workers.
- Direct worker requests to the manager AI endpoint are rejected server-side.

Evidence: worker-scope screenshot/source and HTTP role test. Employee rules/matching/notifications remain future work, not failed requirements of this increment.

## Evidence boundaries

Automated and browser checks use fictional records. The 141-test suite is rerun for this audit; prior screenshots and live evaluations are reused only where the audited implementation is unchanged. No new feature behavior is implemented by this audit. No full VoiceOver/screen-reader certification, exhaustive language evaluation or real-device keyboard certification is claimed. Findings/results below distinguish product defects from additional verification suggestions.


## Finding and proposed correction

### CS-031A-F01 — Chat retains an unsaved draft after successful manual creation

**Affected story:** CS-031A-US05. **Priority:** usability improvement to complete before merging CS-031A. No unauthorized assignment, lost saved record or duplicate write was observed.

Reproduction:
1. Ask the manager assistant for a shift and answer any missing-hours question.
2. Select Review shift, edit the title if desired, and explicitly Create and assign shift.
3. Confirm the Schedule success banner, saved shift and incremented count.
4. Reopen AI assistant.

Expected: the assistant acknowledges that its handed-off draft was created (using the final reviewed details), or clears that actionable draft and explains where to see the saved shift.

Observed: the assistant still shows the original draft as “DRAFT · NOT SAVED,” repeats “Nothing has been saved,” and offers Review shift. It is not linked to the successful save. Source confirms the normal form's success handler refreshes the dashboard but sends no success event/state update to the chat.

Proposed correction (not implemented by this audit): carry an opaque draft/handoff identifier through the review flow; after a confirmed successful save, update only the matching chat card to “Shift created” with the returned actual title/worker/times and a relevant link, or remove its Review action. Manual unrelated shift creation must not mark another AI suggestion as created. If a save is uncertain, retain uncertainty until reconciliation instead of claiming success. Add a regression check for successful edited draft, unrelated manual save, and failed/uncertain save outcomes.

Evidence: [saved Schedule confirmation](saved.png), [chat still says not saved](post-save-chat.png). The first is a full-page screenshot, the second shows the reopened assistant after that save.

## Fresh audit execution

- `npm run verify`: **141 tests passed, 0 failed**; JavaScript syntax checks passed. Raw output: [verification.txt](verification.txt).
- Current application revision was clean before the audit (`f95cc9c`). Only audit documentation/evidence is added; product behavior is unchanged.
- Fresh launcher check: exactly one launcher on all five manager routes (Overview, Team, History, Approvals, Schedule).
- Three small real-provider calls using fictional records: complete December 17 draft; incomplete next-Thursday request correctly asked for hours and identified November 26; reply “9 AM to 3 PM” retained title/worker/date and yielded a complete card. No training or real employee records were used.
- Fresh manual-entry check: entered “Manual acceptance draft,” selected Review shift, saw Replace/Keep, selected Keep, and verified the field was unchanged and prompt removed.
- Fresh explicit-save check: edited the reviewed title, saved one November 26 shift; count changed 1 -> 2 and Schedule confirmed Jamie's assignment. No new saved shift existed during generation/review. Found F01 on reopening chat afterward.
- Fresh mobile check: innerWidth320, document scrollWidth305, dialog305×760, composer bottom639, send bottom693, close top16.84. [Mobile screenshot](mobile.png).
- Fresh keyboard check in clarification state: scrollHeight464 > clientHeight309, initial scrollTop154; Tab focused `.ai-chat-body`; Page Up ultimately moved scrollTop to0. Earlier immediate reads during scroll animation were not treated as failure.
- Prior same-commit evidence supplies reset/late response, provider failure/timeout, worker isolation, cross-page handoff and live correction cases: [chat evidence directory](../../cs031a-chat-evidence/verification.txt). Automated state/security/recovery tests were rerun today.

## Additional verification suggestions

These do not represent reproduced failures: VoiceOver/screen-reader walkthrough, Safari/Firefox keyboard scrolling/focus checks, and a physical-phone virtual-keyboard walkthrough. Consider an explicit named focusable chat-history region for consistent keyboard access across engines, but the existing region was keyboard-scrollable in this audit's browser. AI language coverage remains finite; retain human review and deterministic server validation.

## Decision

**Does CS-031A meet every story? Not completely: 13 pass and US05 is partial because completion status in chat is stale after saving.** Recommend fixing F01 and rerunning that story before merge. The 141 automated tests passing does not cover the missing chat-completion behavior. Task remains Your review, with no source push or merge. CS-031B/C/D remain separate, and CS-018 remains last.
