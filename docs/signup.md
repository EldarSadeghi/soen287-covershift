# CS-004: Manager signup and business creation

Status: reviewed and approved by the user for push and merge. Issue: https://github.com/EldarSadeghi/soen287-covershift/issues/7

## Review locally

Start the app with `npm run dev` and open http://127.0.0.1:3000/signup. The login page has a Create a business link.

The form collects your name, business name, email, password, and business timezone. Use a fictional review account if you are testing. A successful submission saves a new business and its manager account, then shows confirmation with a Sign in link. `npm run data:inspect` can display the saved business and user IDs without printing password hashes. These runtime records are ignored by Git.

Signup is real persistence, not a simulated button. The demo workspace remains separate and shows fictional presentation data. Login, logout, sessions, and authenticated route access are implemented in CS-005; signup deliberately does not create a session. Its success page now links to login.

## Behavior and boundaries

- Name: 2–80 characters after trimming. Business name: 2–100 characters after trimming.
- Email: normalized by trimming and lowercasing, maximum 254 characters, unique across accounts.
- Password: 15–128 characters, preserved exactly rather than trimmed. No composition rules; a passphrase is allowed.
- Timezone: server-validated IANA identifier; the form offers common Canadian/North American zones and UTC.
- The server generates fresh IDs and always creates a manager in a new business. It rejects extra input fields, including client-specified role and business IDs.
- Business and manager creation happens in one JSON transaction. Duplicate checks run again inside that transaction, preventing orphan businesses or duplicate emails under concurrent requests.
- Passwords use Node's asynchronous scrypt with a random 16-byte salt, N=131072, r=8, p=1, and a 64-byte derived key. The versioned hash string records parameters and salt for later verification. This follows the [OWASP scrypt baseline](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#scrypt); see [Node crypto documentation](https://nodejs.org/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback). At most two password derivations run simultaneously to bound memory use.
- The signup endpoint accepts same-origin JSON POSTs only, rejects cross-site requests and payloads over 8 KiB, and limits each remote IP to five attempts per ten minutes. The limiter is in memory and resets on restart; this matches the current single-server local deployment. It does not trust forwarded IP headers.
- Responses contain safe business/manager identity fields, never passwords or hashes. Errors do not log submitted data. API responses and pages use no-store caching; browser headers restrict scripts, framing, and MIME sniffing.
- No email is sent. The form does not accept or create memberships in existing businesses.

Direct local HTTP is supported. Hosting behind HTTPS termination/proxies requires explicit trusted origin/proxy configuration as part of deployment; do not weaken origin checking to accommodate a proxy. Existing JSON storage limitations still apply.

## Verification

Run `npm run check` and `npm test`. The full suite has 15 tests, including real salted scrypt verification, normalized email storage, input/role/business-ID rejection, concurrent duplicate signups, rollback on hashing failure, rate limiting, HTTP request protections, and the previous storage checks. HTTP tests need permission to bind a temporary local port in restricted environments; tests use temporary data.

Browser checks covered blank-field validation, password visibility, successful creation, duplicate-email feedback, demo-to-signup navigation, keyboard skip focus, and a 390px layout without horizontal page overflow. Browser mutation checks used an isolated server/data directory on port 3001; the user's normal development data was not changed by those checks.
