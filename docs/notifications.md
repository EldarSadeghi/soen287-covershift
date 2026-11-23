# CS-031D: employee and manager notifications

In-app only. Every authenticated workspace has a bell, unread total, private inbox, older-page navigation, and explicit individual/displayed-page read controls. The badge refreshes every 30 seconds while visible and on returning to the tab; opening the inbox or Refresh retrieves current details. Background polling preserves inbox contents/focus. Notifications do not refresh or overwrite schedule forms. No email, push, SMS, provider calls, or notification subscriptions.

## Events and recipients

| Event | Employee | Active business managers |
| --- | --- | --- |
| Manual or automatic claim | Claimant: submitted, awaiting manager approval | Needs approval |
| Approval | Claimant: assigned; original worker: released | Existing request receipt shows current approved status |
| Rejection | Claimant: rejected; original worker: still assigned, coverage reopened | Existing request receipt shows current rejected status |
| Original worker cancels a pending claim | Claimant: cancelled, not assigned | Cancellation receipt |

An unclaimed open request has no claimant to notify. Pausing/cancelling an availability rule does not withdraw a submitted claim. Alerts retain their dated event text alongside the current request status; linked History is authenticated and scoped, filtered to that exact request, and offers managers the pending approval queue when appropriate. Expiry is a derived current status; this increment does not create time-expiry alerts.

## Atomic delivery and upgrade

The authoritative `withAvailabilityMatching` transaction records preexisting history keys, applies the workflow and automatic matching, then projects new coverage events into notifications before the validated atomic storage commit. Startup/periodic reconciliation uses the same projection under its exclusive lock. Failures roll back the workflow and notifications together. Stable event/recipient IDs plus unique event validation prevent duplicate alerts. Existing histories are not backfilled; upgrading or restarting does not flood users.

Schema 8 adds `notifications`: `id`, `businessId`, `userId`, `requestId`, `action`, `createdAt`, nullable `readAt`. It retains availability arrays required by versions 6/7, even if empty. Validation checks unique event/recipient identity, canonical times and same-business request/event/recipient references. Versions 1–7 continue to read without rewriting. Offline imports using the raw store are not live workflows: integrations should use the transaction adapter. Never delete notifications/coverage references behind the validated store.

`GET /api/notifications[?before=<owned-notification-id>]` returns 20 records, exact total unread count, and a stable older-page cursor. `POST /api/notifications/read` accepts exactly `{ids:[...]}` (1–100 unique IDs). Only selected owned records are marked; new/unseen arrivals stay unread. The UI shows one page at a time, so “displayed” is at most 20. Writes require session, CSRF, same origin and JSON, are throttled, and are idempotent. No automatic mutation retry. A lost acknowledgement reports uncertainty; Refresh reconciles server state. Notifications/read markers survive restarts; logout clears client state and polling. Accounts and businesses cannot select each other's inboxes.

## Review

See `acceptance/cs031d/USER-STORIES.md` for automated/browser evidence and the fictional local review accounts. Deployment (CS-018) remains last; CS-031D needs explicit approval before push/merge.
