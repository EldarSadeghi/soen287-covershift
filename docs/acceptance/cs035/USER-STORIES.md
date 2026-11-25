# CS-035 Manage saved availability in chat

[Issue #60](https://github.com/EldarSadeghi/soen287-covershift/issues/60)

The isolated preview is on port 3052. In Jamie Lee’s single chat, send “Show my saved availability.” Then send “Pause my Weekend service rule” to see the exact rule and its consequences before deciding whether to confirm. Use “Resume my Weekend service rule” if the rule is paused. QA changed only the fictional preview. The Weekend service rule is active with its pause review open.

| Story | Evidence |
| --- | --- |
| Show my own saved rules and capacity. | In the browser Jamie saw Weekend service and Saturday backup with status, business-local window, usage and remaining capacity. Alex’s Thursday cover rule was absent. Automated lifecycle tests also check cross-account and role boundaries. |
| Ask to change one exact rule. | “Resume my Saturday rule” showed two matches and no confirmation. The literal title “Weekend service” opened a review with a separate confirmation and manager-approval guidance. |
| Confirm a lifecycle change. | Individually confirmed resume and pause of Weekend service and cancellation of Saturday backup in the browser. Pause and cancel copy explains that submitted requests remain in My requests. |
| Recover safely from stale or uncertain writes. | Opened the same review in two browser tabs. Confirmed one, saw the other rejected as stale, then refreshed saved availability. Request recovery tests exercise mutation deadlines and late acknowledgements. Session state persists an account-scoped refresh marker without restoring the stale review. |

The lifecycle demo uses the existing protected endpoints and fictional data. The preview’s general AI responses are scripted. Saved-rule commands do not call an AI provider.
