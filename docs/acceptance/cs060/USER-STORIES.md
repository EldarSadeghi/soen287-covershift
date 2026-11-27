# CS-060 · Draft changes to existing shifts

[Tracking issue #141](https://github.com/EldarSadeghi/soen287-covershift/issues/141)

## Baseline

On main at `939c165`, 472 tests and 22 offline scenarios passed (179 checks). Offline routing matched 167 of 202 prompts, with 54 classifier candidates and zero incorrect write-capable routes. The previous live reference was 200/202.

## Acceptance

| As a manager, I want to… | Observed result |
| --- | --- |
| Find a shift by employee and date | The server scopes matching to the signed-in manager’s business and active team. One match produces a preview, multiple matches offer up to five choices, and no match produces an explanation. |
| Know whether a change is allowed | Started and coverage-linked shifts are locked. Invalid times, overlaps and approved leave are rejected using the save path’s validators. |
| Review the change safely | “Move Jamie’s Friday shift to 10 AM” showed 2–6 PM before and 10 AM–2 PM after. Review opened the existing Schedule editor with the proposed values and original duties. Save updated the schedule. |
| Correct the proposal | “Actually make it 11 AM” retained the same target and changed the proposal to 11 AM–3 PM. Deletion stayed blocked in chat. |
| Avoid overwriting unrelated updates | The preview and correction left business storage byte-for-byte unchanged. A stale save through the existing endpoint returned 409. |
| Keep draft schedule changes private | A test verified that an unpublished shift could be previewed and saved as a private draft with its duties intact. |
| Review on a narrow screen | In the fictional Morgan session the corrected card fit at 320 CSS pixels, with no horizontal overflow. |

## Verification

- 478 tests passed. The edit preview requires manager sign-in, a valid session security token and the application origin.
- 23/23 offline scenarios passed with 189 checks. The new scenario covers proposal, standard save and stale-save rejection.
- Offline routing matched 181/217 labels. Fifteen new prompts were added. Zero incorrect write-capable routes and zero provider calls.
- Live evaluation awaits separate approval. The offline run identified 55 classifier candidates.

## Browser evidence

- [Desktop before and after](desktop-edit-preview.jpg)
- [320 px correction](mobile-correction.jpg)
