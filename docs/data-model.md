# CS-003: JSON data model and storage

Status: reviewed and approved by the user for push and merge.
Issue: https://github.com/EldarSadeghi/soen287-covershift/issues/5

## Local review

From the project folder:

```sh
npm run data:seed
npm run data:inspect
npm test
```

The seed creates fictional records only when every collection is empty. Running it again preserves existing records. Inspect is read-only and prints IDs, names, roles, times, and request statuses; it does not print email addresses or password hashes. Tests use temporary directories and do not edit development data.

Expected seed totals: 1 business, 5 users (1 manager, 4 workers), 5 shifts, and 2 coverage requests (1 open, 1 pending). The fixed sample week is November 12–16, 2026. Records retain the same IDs after restart. New application records use UUIDs from `createRecord`.

`npm start` validates the data file or initializes an empty one. It never seeds demo records automatically. The file defaults to `data/covershift.json`. `DATA_DIRECTORY` in `.env` can select another directory; relative paths resolve from the process working directory. Runtime files are ignored by Git and are not served by HTTP.

The public demo uses CS-002 presentation fixtures. CS-005 adds authenticated account identity and protected workspaces; CS-006 connects the worker shift view to assigned saved records, and CS-007 joins business-scoped records for the manager dashboard.

## Schema version 1

One document contains `schemaVersion: 1` and four arrays. Every record has an immutable-by-convention `id`, plus canonical UTC `createdAt` and `updatedAt` timestamps. Services must preserve IDs and update `updatedAt` when changing records. The validator checks required/allowed fields, references, duplicate IDs, and timestamps; it does not replace authorization or application workflow checks.

| Collection | Other fields | Relationship |
| --- | --- | --- |
| businesses | name, timezone | Timezone is a valid IANA identifier. |
| users | businessId, name, role, email, passwordHash | Belongs to a business; role is manager or worker; normalized emails are unique across accounts. |
| shifts | businessId, assignedWorkerId, title, startsAt, endsAt | Assigned to a worker in that business; end must be after start. |
| coverageRequests | businessId, shiftId, originalWorkerId, claimantId, reviewerId, status | Shift and all participants must belong to the same business; reviewer must be a manager. |

Demo users initially have `passwordHash: null` and cannot be used as authenticated accounts until the explicit local demo-accounts setup enables the two review identities. Never treat a null hash as successful login. Password hashing and signup are implemented in CS-004; session authentication and authorization are implemented in CS-005. Never persist plaintext passwords or serialize complete user records to a browser.

Coverage status is open, pending, approved, or cancelled. Open requests have no claimant; pending requests have another worker as claimant; approved requests also need a manager reviewer. Open/pending requests retain the original shift assignment and have no reviewer; only one active request can exist for a shift. Rejection will reopen the request and record its outcome/history when that workflow is implemented. Claim/approval permissions, conflict checks, and audit history remain future tasks.

## Server access

- `store.read()` loads and validates a detached snapshot from disk.
- `store.transaction(async draft => { ... })` serializes a read-check-change-write operation. Throwing or failing validation aborts it. Do not call another transaction from inside a transaction.
- `createRepositories(store)` returns business-scoped read repositories for all four collections, with `list(businessId)` and `findById(businessId, id)`.
- `createRecord(fields)` generates a fresh UUID and creation/update timestamps. The completed database must pass schema validation.

Future services will use a single transaction for related writes, such as creating a business and its manager together. They must derive business identity from the authenticated session, enforce permission checks inside the transaction where needed, and return safe response fields. Repository scoping alone is not authorization.

## Write safety and deployment limits

Transactions share an in-process queue keyed by absolute filename, including across store instances. Each writer also acquires an exclusive `.lock` file; another process gets a clear busy error instead of writing concurrently. Reads continue using the last complete file while a write is prepared.

Writes serialize all collections, create a same-directory temporary file with owner-only permissions, flush it, close it, and atomically rename it over the previous file. Ordinary failures before rename leave the existing file intact. Readers see the old or new complete document. Temporary files are cleaned up on handled failures. This is a local filesystem design, not a distributed database or a backup system; sudden power loss and filesystem-specific durability are not fully covered.

Use one server instance with a persistent local disk. Do not deploy to ephemeral storage or network filesystems that cannot guarantee these file operations. A process killed during a write can leave a lock/temp file. Stop all writers, verify none remain, back up and inspect the JSON, and only then manually remove the stale `.lock`/temporary files. Never delete a lock while a writer may be active. Corrupt or unsupported-schema files cause startup/inspection to fail; they are never automatically reset or overwritten.

Keep backups of important records before future migrations. Schema changes require an explicit migration rather than silently accepting a different version.

### CS-008 worker setup metadata

Readers accept schema versions 1 and 2. The first add-worker or setup-link replacement transaction upgrades the document to version 2 atomically, preserving existing records. Version 2 allows an optional `setup: { tokenHash, expiresAt }` on workers whose `passwordHash` is null. The token hash is SHA-256 of a random 32-byte bearer token; expiry is canonical UTC. Completion stores a salted scrypt password hash and removes setup metadata in the same transaction. Version 1 seed data remains supported. Do not run older code against a version 2 file.

## CS-014 schema v3

Readers accept v1/v2/v3. First rejected claim upgrades to v3 atomically, retaining all existing records and optional v2 worker setup metadata. `rejected` coverage records require a claimant and manager reviewer. Rejection closes that claim and creates a new `open` request for the same shift/original worker in the same transaction. This preserves the decision actor/time without erasing the claimant or allowing old revisions to act on the reopened request. Adding/reissuing workers never downgrades schema v3. See manager-decisions.md.

## CS-015 schema v4

Readers accept v1–v4. Successful coverage request/claim/cancel/approve/reject mutations upgrade to v4 and write `history` on the affected request inside the same exclusive transaction. Entries contain only `action`, `actorId`, `at` (canonical UTC), and resulting `status`. Action/status, same-business actor role/identity, field shape and chronological timestamps are validated. New reopened requests begin with a manager-authored reopened event. Rejected records retain their own events. Existing records are not rewritten on reads; their UI shows a legacy saved-status snapshot with unknown actor and no invented transition times. On first mutation of an older record, that snapshot is retained before the new event. Versions and worker setup are never downgraded. Names in history views resolve from current same-business user records; timestamps are saved event times, not name snapshots.

## CS-019 schema v5

Versions 1–5 remain readable. Deactivation upgrades atomically to v5, adding optional worker `deactivation: { at, managerId }`. Validation requires a same-business manager, canonical timestamp, null password hash and no setup metadata. Existing work/history references remain intact. Null credentials revoke protected reads/mutations through current-account checks; setup issuance/completion and new assignment reject inactive employees. Demo account enablement cannot resurrect them. Normal account creation/setup and coverage writes never downgrade v5. Physical deletion is permitted only without any assigned shift, coverage participant or history-actor reference.

## CS-031B-2: schema version 6 availability rules

Legacy v1–v5 files remain readable and unchanged on reads. First confirmed availability upgrades atomically to v6 and adds `availabilityRules: []`; all prior collections/records are preserved. A rule stores server ID, business/worker scope, canonical UTC startsAt/endsAt, confirmed timezone, optional literal title keyword, maximum 1–5 claims, employee-scoped confirmation nonce, active/paused/cancelled status, and immutable server confirmedAt/createdAt plus updatedAt. Confirmation timestamps are strictly ordered under the store transaction lock for later FIFO matching. Expiry is derived when the end is reached; cancelled stays cancelled. No claims or assignments are created by this schema.

Server confirmation accepts a future window starting within 90 days, at most 24 local hours (UTC duration can be 23/25 hours across DST). Nonexistent/repeated local times are rejected. Same employee+nonce+exact normalized values returns the existing rule, including after expiry or cancellation; differing payload cannot reuse the nonce. At most 20 current and 100 lifetime rules per worker are allowed. Status changes require fresh opaque revisions. Current account/business scope is always server-derived. Rule history prevents hard employee deletion; normal deactivation atomically cancels their rules and blocks further employee access. Team revisions include rules so intervening confirmations/changes require refreshed review.

Rules are private to the employee in this increment. Matching/claim count consumption and notifications are separate CS-031C/D work; clients explicitly show matching is not running yet. Back up the JSON data before future deployment/migration; no destructive reseed is part of this change.

## CS-031C: schema version 7 automatic match ledger

First successful automatic request atomically adds `availabilityMatches` and raises the version to7. Records are immutable: id, businessId, ruleId, workerId, shiftId, requestId, createdAt and updatedAt (equal to creation). References must resolve to the same business/worker/shift/claim; a matched claim cannot be open. Unique request and worker/shift identities prevent repeats across reopened coverage and overlapping rules. Per-rule record count may not exceed maxClaims. Rejection/cancellation retains the ledger; consumed submission capacity is not refunded. Current request status is joined at read time rather than copied into the ledger. Rule updatedAt changes with consumption so stale controls require refresh. Legacy files remain readable; no forced migration on a no-match read/sweep. All match/claim/history changes commit together under the existing exclusive lock.

## Schema 8: in-app notification receipts (CS-031D)

`notifications` stores private event/recipient receipts: `id` (SHA-256 identity), `businessId`, `userId`, `requestId`, `action` (`claimed`, `approved`, `rejected`, `cancelled`), canonical `createdAt`, nullable canonical `readAt`. Same-business foreign keys, a matching coverage history event, valid recipient, unique ID/event/recipient and read-time ordering are enforced. Upgrade initializes required empty availability arrays where needed. Existing versions 1–7 remain readable; live new events upgrade atomically with delivery; no historical backfill. See [notifications.md](notifications.md).

## CS-030: schema9 time-off requests

Versions1–8 remain readable without a rewrite. First explicit leave submission initializes missing availability/match/notification arrays and atomically adds `timeOffRequests`, preserving earlier records. Each request stores `id`, `businessId`, `workerId`, UTC `startsAt`/`endsAt`, saved `timezone`, `allDay`, trimmed private `note` (≤500), employee-scoped UUIDv4 `submissionId`, pending/approved/rejected/cancelled `status`, nullable `reviewerId`, canonical creation/update timestamps and chronological `history` events (`action`, `actorId`, `at`, `status`). Requested/cancel events belong to the employee; approve/reject and deactivation-cancel events require the appropriate same-business manager. Final history status/time must equal the record. Duplicate submission IDs, overlapping pending/approved intervals, invalid scope/actors/status transitions and malformed records are rejected. Full-day endpoints must be local midnight. No private note is copied to commitment/AI/coverage receipts.

Creation enforces future/one-year and366-day local duration bounds, with ambiguous/nonexistent wall times rejected. Identical submission retries return the same record; different values cannot reuse the nonce. Future employee cancellation and manager decisions require fresh revisions and exclusive checks. Assigned shifts and pending claims block leave approval; approved leave blocks new work through shared eligibility. Deactivation cancels actionable leave with retained audit events, and any time-off history prevents physical employee deletion. See [time-off workflow](time-off.md).

## CS-031 general availability (schema 10)

`availabilityWindows` stores independently confirmed employee windows with scoped owner/business references, canonical UTC endpoints, source timezone, unique employee submission UUID, confirmed/withdrawn status and timestamps. Schema 1–9 files remain readable; first save initializes the newer collections without losing history. General windows do not participate in matching. Deactivation withdraws them, while history prevents hard deletion. See [employee availability](employee-availability.md).

## CS-040 directed cover invitations (schema 11)

`coverInvitations` stores same-business worker participants, immutable shift snapshot/timezone/fingerprint, sender-scoped submission UUID, optional plain-text note, pending/accepted/declined/cancelled/expired state, linked coverage request ID and strict actor/timestamp history. One pending record per shift; snapshots preserve history after shift deletion. `coverNotifications` stores uniquely scoped event delivery/read receipts. Older schemas stay readable and are upgraded atomically on first send. Accepted coverage retains the existing manager approval and history model. See [Request cover](request-cover.md).

## CS-032 shift duties (schema 12)

Optional `shifts[].duties` is an array of up to10 trimmed, nonempty plain-text strings, each at most160 characters and without ASCII control characters. Older shifts may omit it; DTOs expose an empty list. Versions1–11 remain readable without rewriting. A manager create/edit that supplies duties atomically upgrades to12 and initializes any missing prior-version collections. Omitting duties on edit preserves existing values; an explicit empty list clears them. Duties remain on the same shift when coverage transfers its assignee. Existing revision checks and started/coverage-history edit locks apply. See [shift duties](shift-duties.md).
