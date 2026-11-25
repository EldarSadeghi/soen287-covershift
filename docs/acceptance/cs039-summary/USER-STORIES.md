# CS-039 Working-week and attention summaries

[GitHub issue #59](https://github.com/EldarSadeghi/soen287-covershift/issues/59)

## Review walkthrough

Open the [isolated local preview](http://127.0.0.1:3063/login). As Jamie, ask **“Show my working week.”** The fictional November 23–29 week contains two upcoming assignments, one claim awaiting approval, and one other coverage outcome. **“What about next week?”** switches to November 30–December 6 and shows the empty state.

As Morgan, ask **“What needs my attention this week?”** The summary shows one pending approval and two open requests for cover. **Refresh summary** reads the latest snapshot. **Open Approvals** and **Open Schedule** link to the existing workspaces.

## Boundaries

- The windows run Monday through Sunday in the business timezone. Coverage is grouped by the associated shift's dates, including overnight overlaps. The upcoming assignments count omits completed work.
- Employees see only their published assignments and coverage requests they opened or claimed. Managers see active pending and open coverage for their business. Draft assignments and other businesses' records are excluded.
- Open cover means an existing assignment has a coverage request. The summary derives no staffing demand or shortages. A new read recalculates expiry and displays the last checked time. The feature works without an AI provider.
- Verified in the browser for Jamie and Morgan, including empty next week, refresh, keyboard use, and a 320px viewport.
