# CS-072 structured fallback

- When local rules need the classifier, it can return the date or date range, named employee, or shift title used by supported read-only lookups. The selected intent determines which kind of record is queried.
- The server accepts only route-specific fields grounded in the latest message, resolves dates in the business timezone, and rejects conflicting ranges. Lookups still use existing business and role checks. Unresolved dates or employee names use the existing clarification.
- Manager availability, time off, coverage status, shift history and replacements use relevant details. Employee coworker availability uses the date. Draft workflows keep their existing extraction, eligibility, review and allowance checks.
- In the scripted manager browser preview, “Could we get somebody to sit in for Jamie Lee at Opening service on the 3rd?” opened the replacement card for Jamie Lee’s Opening service shift. The HTTP test checks validated and invented fields and confirms the lookup does not issue a draft pass.
