# CS-016 security and workflow verification

Reviewed 2026-11-17 on Node v24.21.0 / npm 11.19.0, starting from main `60c9e1c` (CS-015). Issue #33, local branch `codex/CS-016-security-workflow-verification`. Implementation is ready for user review; no push or merge yet.

## Result and reproduction

`npm run verify` runs syntax checks and the complete Node test suite. Result: **101 tests passed, 0 failed**, including **9 new HTTP integration tests** in `tests/security-workflow.test.js`. To run only the new checks: `node --test tests/security-workflow.test.js`. `git diff --check` also passed.

These checks found no authorization bypass or partial-write defect in the tested flows, so this increment adds regression coverage, a repeatable verification command and this report; it does not change production behavior. This is a focused code review and local verification, not a claim that every possible attack has been tested.

Tests use temporary isolated JSON files, ephemeral loopback HTTP servers, fictional identities and controlled clocks. The new HTTP tests use a cheap injected password verifier to exercise login/session/workflow behavior; the existing authentication tests independently exercise real salted scrypt hashing and verification. No user database or credentials are used.

## Evidence matrix

| Area | Evidence | Result |
| --- | --- | --- |
| Complete lifecycle | New HTTP test adds employee, consumes one-time setup, logs in, requests/claims, rejects/reopens, reclaims/approves, requests again and cancels; reopens storage and checks assignment and complete actor/event sequences | Pass |
| Business boundaries | Foreign managers try edit/delete/approve/reject with actual IDs; foreign employees try request/cancel/check/claim; foreign role views omit record IDs and shift content; disk bytes unchanged | Pass |
| Role and CSRF boundaries | Matrix covers team/setup, create/edit/delete, approve/reject, request/cancel/check/claim with opposite role, missing or other-session CSRF, missing/null/foreign Origin, cross-site Fetch Metadata, non-JSON type and query scope | Pass |
| Claims and races | Two HTTP claimants yield one pending claimant; simultaneous approval/cancellation yields one success and one conflict with exactly one terminal event and consistent assignment; existing tests cover one worker racing overlapping claims | Pass |
| Fresh approval checks | New assigned overlap after claim blocks approval without writing; reject/reclaim makes the old approval stale; new claimant can be approved; existing tests cover pending conflicts, expiry and adjacency | Pass |
| Strict input and private files | Malformed JSON, null/array, prototype-shaped body and >8 KiB body rejected; data/lock, .env, .git, source and traversal paths unavailable | Pass |
| Failure handling | Deliberately corrupted temporary database returns generic 503 without source stack/private marker and is never reset or overwritten | Pass |
| Session lifecycle | Login rotates token and CSRF; old CSRF denied; duplicate/forged cookies denied; idle and absolute expiry checked at boundaries; disabled account loses session permanently even after re-enable; logout invalidates | Pass |
| HTTPS/origin policy | Secure session cookie uses __Host prefix, Path=/, HttpOnly, SameSite=Lax, Secure, no Domain; canonical PUBLIC_ORIGIN rejects spoofed forwarding headers; HSTS/CSP/nosniff/no-store and no permissive CORS checked | Pass |
| Abuse bounds | New HTTP test confirms shared coverage mutation limiter rejects attempt 31 with 429/Retry-After and unchanged storage; existing tests cover login/signup throttling and bounded session capacity | Pass |
| Input rendering | Source review: stored user/shift text is rendered with textContent; browser shows an HTML-like shift title literally, with no alert dialog. Static innerHTML templates and navigation use developer-defined strings/validated role choices | Pass in checked views |
| Persistence/history | Existing tests cover cross-store serialization, exclusive lock, atomic replacement, rollback/queue release, corrupt-file refusal, schema history actors/times, legacy snapshots, participant-only history and setup compatibility | Pass |

## Source review

- `src/app.js`: static asset allowlist prevents arbitrary file serving; protected routes reload account role/business; mutations enforce method, JSON, Origin/Fetch Metadata and CSRF before service calls; strict revision bodies and server-selected identity are enforced by services. Request bodies are bounded to 8192 bytes. Errors do not serialize input, database, stack traces or credentials.
- `src/auth/`: passwords use salted scrypt; unknown/malformed accounts still incur verification cost. Sessions are random opaque tokens stored by digest, with random session-bound CSRF, fixed idle/absolute lifetimes and bounded capacity. Login rotates a presented session. Password hashes and setup tokens are not returned in normal account/coverage DTOs.
- `src/manager/workers.js` and `public/setup.js`: manager setup link is a bearer credential shown only in its authorized setup response, stored as a hash, expired and consumed atomically; its URL fragment is removed from the address bar before setup requests. Completion rechecks expiry/token after hashing. There is no reset or role self-selection flow.
- `src/shifts/` and `src/requests/`: authorization, current ownership/status/revision/time and conflict checks run within exclusive mutations. No assignment transfer occurs at claim; only approval transfers. Rejection preserves a reviewed record and reopens with a new request ID. History writes share the successful transaction; failed actions add nothing.
- `src/storage/`: validation guards references, schema and event roles/time; writes are serialized and use same-directory atomic rename with owner-only file permissions. Reads do not reset damaged storage.
- Repository inventory: tracked data contains only `data/README.md`; `.env.example` is tracked, local `.env` and runtime data are ignored. No runtime third-party packages are declared. This inventory is not a scan of Git history or the user's unrelated files.

## Local browser review

Isolated fictional server: http://localhost:3010. Manager `manager_morgan@example.test`, employee `worker_jamie@example.test`, fictional password `Fictional security review access!`. The review server uses its own temporary database; the normal local account database is untouched.

Browser verified the manager confirmation for Verified morning service, saved approval, updated pending count, Jamie's assignment in Schedule and the requested → claimed → approved timeline in History. Expired seeded pending claims keep their unavailable actions. An HTML-like synthetic shift title is displayed literally in Schedule. The preview remains on approved history; Weekend preparation remains pending for user testing. Screenshot: `/tmp/covershift-cs016-review.png`.

## Deployment limits to carry into CS-018

- Supported deployment is one server process on persistent local storage with HTTPS PUBLIC_ORIGIN behind a configured proxy. Proxy/TLS/hosting and backup/restore are not deployed or verified here.
- Sessions and rate-limit counters live in process memory; restart signs users out and resets counters. Multiple replicas would require shared sessions/rate limits and a different persistence coordination design.
- File locks protect writers but abrupt termination may leave a stale lock; follow the documented stop/back-up/inspect recovery process. Atomic replacement is not a backup or a full power-loss durability guarantee.
- Legacy records cannot reconstruct event actors/times that were never recorded. Current user names are resolved when history is read.
- Permission decisions operate on current stored membership. There is no employee role-change, offboarding, password reset, notification or audit-log administration UI in this MVP. Accessibility/responsive polish remains CS-017.

User approval is required before pushing this branch or merging it into main.

User explicitly approved CS-016 push and merge on 2026-11-17.
