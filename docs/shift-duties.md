# CS-032: Daily shift duties

Managers can add an optional list of duties when creating or editing a future shift in Schedule. Enter one duty per line, up to 10 duties of 160 characters each. Blank lines are ignored; surrounding whitespace is trimmed. Duties are plain text, not HTML or completion checkboxes.

Employees see duties beneath the time on My shifts. View a day selects upcoming/current shifts that overlap that date in the business timezone, including an overnight shift continuing into the date. All upcoming clears the selection. Hours shown are the full duration of the listed shifts, not hours clipped to the selected date. Completed shifts remain in existing history rather than this view.

Duties belong to the shift. Open coverage cards show them before a coworker claims; approved coverage keeps the same duties for the new assignee. Existing shift edit restrictions still apply: started shifts and shifts with linked coverage history cannot be edited. A legacy shift without duties says “No duties added for this shift.”

Schema 12 adds optional `shifts[].duties`. Older stores are read without migration. The first create/edit containing duties upgrades atomically and initializes missing collections. Existing API clients may omit duties: creation then has no duties and editing preserves any saved list. An explicit empty array clears the list. Server validation, role/business checks, conflict checks and stale revision checks apply. AI shift drafts retain their existing shape; applying one to the manager form preserves manually entered duties. The provider does not generate duty lists in this increment.

This increment does not add completion tracking, recurring duty templates or schedule publication rules.
