# CS-071 short chat replies

- As a manager, I can reply with a day when a duty request needs a date, or give two weeks when the copy workflow asks for them.
- As a manager, I can refer to the current shift choices by position, title, employee or time of day. A reply that fits several shifts or none leaves the choices available. Read-only replacement lookup rechecks business, date and original filters for the selected shift.
- As a worker or manager, I can answer a summary clarification with “this week” or “next week.” Existing status and coworker follow-ups retain their routing.
- Explicit new requests and unsupported actions take precedence over a choice. Changes still require the existing review forms. Ordinals refer to the currently displayed card and must be reissued after a page reload.

In the fictional manager browser, “Add ‘sweep’ to the opening shift” → “Thursday” opened the duty review card. A four-result replacement lookup followed by “the second” opened the Afternoon coverage result. The duty chooser also surfaced the existing linked-coverage lock for that shift.

## PR review follow-up

- An unmatched request with a visible chooser proceeds through normal routing. Recognizable selections that are ambiguous or out of range keep the list open. “Never mind” dismisses it. Position replies also accept “the last one” and “#2.”
- Duty date replies accept month abbreviations and standalone day ordinals. Week-copy replies can fill in one missing week at a time and preserve a source or destination already supplied in the current chat.
- The fictional browser confirmed a new rota question was recorded and handled while a list was open, “never mind” dismissed a list, “#2” selected Afternoon coverage, “Dec 3” produced a duty review card, and “to next week” opened batch review after “Copy this week to.”
- 545 tests and 25 offline scenarios passed. Offline routing remained at 275 of 327 with zero wrong routes into save-capable features. The fictional browser used scripted settings, and no live routing evaluation ran.
