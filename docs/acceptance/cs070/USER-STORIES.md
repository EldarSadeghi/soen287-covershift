# CS-070 record matching in chat

| User story | Acceptance |
| --- | --- |
| As a manager, I can name an employee and a shift title so I review the intended shift. | Duty and replacement lookups share name and title matching. Tests cover a full name, a title with multiple words, a conflicting title, and multiple matching shifts. |
| As an employee, I can identify a request by the employee or shift it refers to. | Follow-through shares the same name and title matching and keeps its existing request-type and visibility checks. |
| As a manager, I can identify a copy source and destination by dates. | Week-copy lookup shares date parsing with replacement and duty lookups. Tests cover explicit invalid dates and day ordinals. |

The handlers still decide which records are eligible for their task. Existing review and save endpoints enforce the corresponding validation. The offline evaluation measures routing, while the record matching tests assert the records returned by the lookups.
