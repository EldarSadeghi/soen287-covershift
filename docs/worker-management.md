# CS-008: Worker management and account setup

Issue: https://github.com/EldarSadeghi/soen287-covershift/issues/17
Branch: `codex/CS-008-worker-management`. Status: user approved push and merge on 2026-11-13.

Managers open Team to see only their business’s saved worker roster. Add a worker with name and email; the server fixes role to worker and business to the signed-in manager’s business. Email addresses remain globally unique. Existing workers display Ready to sign in, Setup pending, Link expired, or Setup needed.

After adding a worker, copy the one-time setup link and share it privately with that worker. No email is sent. The worker opens the link, confirms their name/business/email, and chooses and confirms a password of 15–128 characters. They then sign in normally. The setup flow does not sign out or replace an existing manager session. To test worker login without changing the manager session, use another browser or a private window.

Links expire after 24 hours and are shown only when issued. Generate/replace a link for a worker without a login; replacement invalidates the earlier link. A ready worker cannot have their password reset through this feature. On localhost, links work on this computer only; an accessible HTTPS deployment is needed to share with another device.

The bearer token is carried in the URL fragment, which never reaches the HTTP server, then immediately removed from the address bar and kept only in page memory. Reopening the original link is necessary after refresh. Only its SHA-256 hash and expiry persist in private JSON storage, so links survive server restarts. Roster responses omit tokens and hashes. Setup completion rechecks token, expiry, and account state inside the storage transaction after password hashing, preventing reuse and rotation races.

Manager mutations require a current manager session, exact Origin, JSON, and session CSRF token. Both manager writes and public setup endpoints are rate limited. Request bodies are bounded. All displayed worker text uses textContent. Existing account/business records survive the additive schema transition; see data-model.md.

Review: add a fictional worker, check their roster entry, open their setup link, choose a password, sign in as that worker, refresh the manager roster to see Ready to sign in, and reopen the original setup link to verify rejection. Also try a duplicate email. Tests exercise expiration, concurrent completion, replacement, role/business boundaries, real scrypt authentication, and version 1 preservation.

Out of scope: email delivery, editing/deleting workers, role changes, password resets, and shift creation (CS-009).
