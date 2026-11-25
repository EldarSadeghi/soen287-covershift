# CS-034 conversational draft refinement

[GitHub issue #57](https://github.com/EldarSadeghi/soen287-covershift/issues/57)

| Story | Verification |
| --- | --- |
| A manager changes the start time of a pending shift. | In Chrome, “Move it to 2” asked AM or PM and removed the earlier review action. The superseded Week planner entries cleared. An injected provider failure preserved the composer and draft context. “2 PM” produced a new review showing the original title, worker, date and 6 PM finish. Week planner showed the revised four-hour shift. |
| An employee narrows an existing opening search. | “Only after 2 PM” retained the date and showed the updated time bound, title filter and timezone. The automated test verified that only the matching later opening was returned. |
| An employee reduces the limit on a pending availability rule. | “Just one shift” retained the date and both endpoints. Chrome showed a maximum of one. Explicit confirmation saved a rule with that limit. A separate run confirmed cancellation removes the confirmation action. |
| Reloading keeps refinement context without reactivating confirmation. | A pending employee availability draft survived reload as context. The old confirmation was absent. A new follow-up produced a fresh review. |
| Chat stays private and fits on mobile. | Signing out of the manager account and signing in as a worker did not display the manager draft. The revised availability card fit within the dialog at a 320 px viewport. A manager API test rejected an out-of-business worker in the base draft. |

The suite exercises the three structured revision paths with recorded provider replies and runs existing authorization, scheduling, publication, and recovery checks. The isolated browser preview uses fictional accounts, a fixed business date, and scripted provider replies. Live-model interpretation was not verified.
