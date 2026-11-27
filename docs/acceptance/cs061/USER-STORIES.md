# CS-061 · Employee lookups in chat

[Tracking issue #143](https://github.com/EldarSadeghi/soen287-covershift/issues/143)

## Baseline

Recorded on main at `dea0b04`. All 478 tests and 23 offline scenarios passed (189 checks). Offline routing matched 181 of 217 prompts, with 55 classifier candidates and zero incorrect write-capable routes. The previous live reference was 215/217.

## User stories and acceptance

| As an employee, I want to… | Observed result |
| --- | --- |
| Read my shift duties in chat | Jamie’s Thursday schedule answer showed ten duties from the assigned shift and marked the answer as focused on duties. Empty lists added no section. The API test verified that another employee’s duties never appeared. |
| Review my past coverage | Jamie’s November history showed one approved pickup, counts, the date and a link to History. Tests verified local month boundaries, empty periods and rejection of manager access. |
| Clarify a period | An unclear October–November request asked which period to check. Replying “November” returned Jamie’s November history. The routing test verified that an unsupported delete command stayed blocked. |
| See recent updates without clearing the bell | Jamie’s card showed the unread coverage update, its time and the related link. The bell still showed one unread after leaving chat. Tests covered account isolation, read-only storage, recent read results and no notifications. |
| Use the chat on a small screen and with a keyboard | The ten-duty card fit in a 320 CSS-pixel viewport with no horizontal overflow. Enter opened and submitted chat. Escape restored focus to the launcher. |

## Verification

- 482 tests and 23 offline scenarios passed.
- Offline routing matched 195/232 labels. Fifteen prompts were added without changing the 217 prior prompts. Zero incorrect write-capable routes and zero provider calls.
- The first live run passed all 15 new prompts and found one new incorrect route into shift creation. The existing-shift request now routes locally to edit review. A live rerun for the remaining 56 classifier candidates awaits approval.

## Browser evidence

- [Duties at 320 px](duties.jpg)
- [Coverage history](history.jpg)
- [Unread update and bell count](updates.jpg)
