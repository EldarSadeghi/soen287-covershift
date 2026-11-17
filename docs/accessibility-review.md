# CS-017 accessibility and responsive polish

Issue #35; branch `codex/CS-017-accessibility-responsive`. Local user review, 2026-11-17. No push or merge yet.

## Changes

- Shared last-loaded accessibility stylesheet on login, signup, setup, protected workspace and public demo. Visible dark-green focus rings cover links, buttons, inputs, selects and focused feedback. Secondary text/placeholder contrast is darker; small explanatory text is larger.
- Buttons and form controls have a 44px minimum height. Phone fields use 16px text. Navigation wraps into visible rows instead of requiring sideways scrolling. Summary cards stack at narrow widths; long business/worker names, titles and confirmation text wrap. Forms, history filters, panels and top bars reflow.
- Reduced-motion styles remove animation/transitions when requested. Forced-colors rules retain visible focus and control boundaries. These media rules were reviewed in source; no operating-system preference was changed.
- Worker setup gains a skip link; password toggles have explicit Show password / Hide password names and controls relationships. Mismatched setup passwords identify the confirmation field as invalid and describe it with the error.
- Create/edit shift forms associate field errors with inputs and expose focused summaries for client/server validation. Start/end creation inputs also reference the business timezone. Invalid client entries stay in the form.
- Inline request/cancel, claim, manager review and shift management are named groups. Escape closes them using the existing non-destructive cancel behavior and returns focus to the trigger; it does nothing while a mutation is pending. They remain inline, with normal Tab navigation and no modal focus trap.
- User-triggered refresh/retry restores focus to the persistent Refresh button across manager, team, worker and history views. Mutation-success callbacks keep their existing focused success messages. Status/count updates replace large list live regions so assistive technology is not asked to reread every replaced record.

Authorization, persistence and coverage decisions are unchanged. No new dependencies.

## Verification

`npm run verify`: syntax checks and **101 tests passed, 0 failed**. `git diff --check` passed. These regression tests cover existing server behavior; browser checks below verify this frontend increment.

| Check | Observed result |
| --- | --- |
| Empty login submission | Focused error summary and associated email/password messages |
| Skip link using Tab then Enter | Focus moves to the main landmark |
| Empty create-shift submission | Focused summary, four invalid fields with descriptions; next Tab reaches Shift title |
| Empty edited title | Focused edit summary and associated title error; no request submitted |
| Escape in shift editor | Editor closes and Edit trigger receives focus |
| Refresh in manager Schedule / worker Open shifts | Persistent Refresh button receives focus after data replacement |
| Worker request confirmation | Keep as is initially focused; Escape closes and returns to Request coverage |
| Worker claim preflight | Keep browsing initially focused; Escape closes and returns to Check & claim |
| Manager approval confirmation | Keep pending initially focused; Escape closes and returns to Approve trigger |
| Employee views at 320px | Navigation targets measured 44px tall; login input text 16px; document has no horizontal overflow; request/open/history reflow |
| Manager Schedule at 320px | All five navigation items visible in wrapped rows, 44px targets; form fields measured 223px wide with 16px text; no page horizontal overflow |
| Manager Schedule/Approvals at 390px | No horizontal overflow; long worker name wraps in assignment/confirmation; buttons remain reachable |
| Desktop long content | Long business name, worker name and 94-character shift title wrap without hiding actions |

Measured contrast for changed palette pairs: secondary #526258 on white 6.47:1 and on #f6f7f3 6.01:1; eyebrow #526344 on #f6f7f3 6.05:1; focus #214d3d on white 9.57:1; placeholder #657267 on white 5.05:1. Ratios were calculated from sRGB relative luminance; they are selected-pair checks, not an audit of every rendered pixel.

Checks used browser accessibility trees, real keyboard input, DOM measurements and screenshots. A complete screen-reader session, every browser/device, and full zoom/text-spacing conformance were not tested. Narrow 320px reflow was checked directly. Viewport overrides were restored after checking.

## Local review

Open http://localhost:3011/workspace/manager/approvals. Fictional manager: `manager_morgan@example.test`; employee: `worker_jamie@example.test`; password: `Fictional accessibility review access!`. Data is isolated in a temporary directory; normal user accounts are untouched.

Try Tab, Shift+Tab and Escape in Approvals, request/claim confirmations and the long-title shift editor. Submit an empty create form, then Tab through its fields. Resize to phone width and inspect wrapped navigation, larger controls and stacked summaries. History filters announce concise counts. The preview leaves Weekend preparation pending for user testing.

Screenshots: `/tmp/covershift-cs017-review.png` (desktop), `/tmp/covershift-cs017-mobile.png` (390px). Await explicit approval before push/merge.

User explicitly approved CS-017 push and merge on 2026-11-17. CS-018 remains the final step after CS-019 and remaining implementation work.
