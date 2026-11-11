# CS-005: Login, logout, sessions, and protected access

Status: reviewed and approved by the user for push and merge. Issue: https://github.com/EldarSadeghi/soen287-covershift/issues/9

## Review locally

Run `npm run dev`, then open http://127.0.0.1:3000/login. Use the email/password from an account created through signup. Existing CS-004 passwords use the same supported scrypt format and require no migration. New users can follow Create a business, then Sign in to your account.

A manager lands at `/workspace/manager/overview`. A worker lands at `/workspace/worker/shifts`. The workspace displays actual account/business identity and only that role's navigation. Sign out invalidates the server session and returns to login. Refresh preserves a valid session; restarting the server invalidates sessions but preserves the stored accounts.

The original seven-screen presentation preview is now at `/demo`. Its role switch controls fictional presentation content only and never changes a session, saved account, or authorization. `/` redirects to login or the current account's own workspace. Saved shift data is not wired into workspace pages until CS-006; upcoming business actions are labeled clearly.

## Optional local demo accounts

An explicit development utility enables the existing fictional manager and worker. It never automatically runs on server startup, resets an existing password, or alters real signup accounts.

1. Choose a local demo passphrase of 15–128 characters and set `DEMO_PASSWORD` in your ignored `.env` file (or your terminal environment).
2. Run `npm run data:demo-accounts`.
3. Sign in with `manager_morgan@example.test` or `worker_jamie@example.test`, using the passphrase you supplied.

The command seeds an empty database if needed. If an existing database has no fictional seed records, use a separate `DATA_DIRECTORY` for the demo rather than changing real records. It only enables the exact two seed identities with null password hashes and refuses production mode. It prints emails, not passwords/hashes. Re-running does not reset credentials. Never include demo accounts in a production data set.

## Session and request behavior

- Password verification uses the same fixed scrypt parameters as signup and a constant-time digest comparison. Unknown emails, null seed passwords, and unsupported stored hash formats perform a dummy derivation and receive the same invalid-credentials response.
- Login attempts are limited per remote IP and normalized email to ten per ten minutes, before expensive verification. In-memory rate limits reset on restart; forwarded IP headers are not trusted. Password work remains bounded to two simultaneous derivations across signup and login.
- Each successful login creates a random 256-bit opaque session ID, invalidates the presented old session, and rotates the CSRF token. Only the session ID's SHA-256 digest is retained server-side. Sessions contain a user ID and CSRF/expiry metadata, not a caller-selected role or business.
- Sessions are in memory, capped at 2,000 entries, with a 30-minute idle limit and 8-hour absolute lifetime. Expiration is enforced server-side. They intentionally do not survive a restart. This is a single-server design.
- Cookies use HttpOnly, SameSite=Lax, Path=/, and Max-Age. Local HTTP uses `covershift_session`. HTTPS uses Secure and the `__Host-covershift` cookie prefix, with no Domain attribute. No session or CSRF token is saved in browser localStorage or URLs.
- Every protected request reloads the user and business from JSON storage. Role checks happen on the server, and business identity derives from the stored user. Missing/deleted accounts or null credentials invalidate the session. Worker/manager protected pages and context endpoints reject the other role.
- `POST /api/logout` requires both the session's CSRF token in `X-CSRF-Token` and an exact same-origin JSON request. The browser gets the CSRF token from the authenticated session endpoint. Invalid CSRF requests do not invalidate an otherwise valid session. Signup/login are independent public forms with exact Origin, JSON, and cross-site checks; they do not grant access based on an existing user's business.
- Protected responses are no-store. API responses contain selected identity fields only, never password hashes or email addresses. Back/forward restoration reloads the workspace to recheck its session. A session expiring while a page is open is rejected on the next server request.

These choices follow [OWASP session management guidance](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html) and [CSRF prevention guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).

## Routes

| Route | Access / behavior |
| --- | --- |
| GET /login, /signup, /demo | Public pages. Demo only contains fictional fixtures. |
| POST /api/login | Validates credentials, rotates session cookie, returns a fixed role-specific destination. |
| POST /api/signup | Creates a separate business and manager; does not create a session. |
| GET /api/session | Authenticated safe identity plus CSRF token. |
| GET /api/manager/context | Managers only; current business/account identity. |
| GET /api/worker/context | Workers only; current business/account identity. |
| GET /api/businesses/:id/context | Current business only; another business returns 404. |
| GET /workspace/:role/:page | Authenticated role-specific shell; unauthenticated users redirect to login. |
| POST /api/logout | Authenticated, same-origin, valid CSRF token; invalidates the session and clears cookie. |

All current authenticated mutations use the CSRF guard. Future mutating service routes must also require same-origin JSON, the authenticated account, CSRF verification, and their own role/business checks. Authentication is not permission to operate on arbitrary supplied IDs.

## Deployment and verification

Set `PUBLIC_ORIGIN` to the exact public origin (for example `https://covershift.example`) without a path/trailing slash when deploying behind HTTPS termination. Production mode refuses startup without an HTTPS origin. This enables Secure cookies and HSTS and supplies the exact allowed Origin, without trusting forwarded headers. Persist the JSON data directory on a local disk and use one server instance; multi-instance shared sessions/data are outside this implementation.

Run `npm run check` and `npm test`. There are 24 tests covering the existing storage/signup behavior plus password verification, generic failures, session rotation, idle/absolute expiry, cookie flags, logout, CSRF, role denial, existing cross-business isolation, login rate limiting, signup-to-login compatibility, and explicit demo setup. HTTP tests bind temporary loopback ports and use isolated files.

Browser QA used separate temporary data on `localhost:3001`, with the normal preview at `127.0.0.1:3000` left unchanged. Checks covered invalid credentials, both role logins, navigation, refresh, logout, denied manager access for a worker, demo-role isolation, new signup-to-login, and mobile layout at 390px.
