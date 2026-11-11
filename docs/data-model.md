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

The existing browser screens still use CS-002's presentation fixtures. CS-003 adds backend storage, not authenticated data access. CS-005 adds authenticated account identity and protected workspaces; worker shift data wiring follows in CS-006.

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
