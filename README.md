# CoverShift

CoverShift helps small businesses find shift coverage, with manager approval before reassignment.

## Local setup

Install Node.js 24 or newer (includes npm), clone the shared repository when its URL is available, and open a terminal in the project folder.

```sh
npm start
```

Open http://127.0.0.1:3000. No third-party dependencies or installation step are needed for CS-001. For automatic restarts during development, use `npm run dev`.

Optional: copy `.env.example` to `.env` and change the port if 3000 is occupied. Keep `.env` out of Git. Stop the server with Ctrl+C.

## Current scope

CS-007 connects manager Overview, Schedule, and Approvals to saved business records, with scoped summary counts, assigned workers, pending claim participants, and read-only coverage status. See [manager dashboard and milestone walkthrough](docs/manager-dashboard.md). Approval/rejection and worker management remain upcoming increments.

CS-006 connects the worker's My shifts page to only their own assigned current/upcoming shifts. Both roles use business-timezone dates with refresh and empty/error states. See [worker shift instructions](docs/worker-shifts.md).

Start at http://127.0.0.1:3000/login and use an account created through signup, or the explicit fictional role setup in [authentication instructions](docs/authentication.md). The public presentation demo stays at /demo and grants no account access.

## Structure

- `public/`: browser-facing pages and future assets.
- `src/`: server code and future application services.
- `data/`: ignored runtime JSON storage, implemented in CS-003.
- `docs/`: implementation plan, collaboration rules, and AI log.

## Checks

Run `npm run check` to check JavaScript syntax and `npm test` for storage verification. Start the app and verify navigation for both roles, direct-link refresh, keyboard focus, and a phone-width layout. The page, CSS, and JavaScript should load; unknown paths and private data paths should return 404. The UI still uses demo presentation data.

## JSON storage (CS-003)

The server now validates private JSON storage on startup, creating an empty database if needed. To review fictional persisted records locally:

```sh
npm run data:seed
npm run data:inspect
npm test
```

Seeding preserves existing records. Inspection prints a safe summary; tests use isolated temporary data. See [the data model](docs/data-model.md) for fields, transactional access, and recovery notes. Runtime JSON files are not served to browsers. Authenticated endpoints return safe identity fields; the separate public demo still uses fictional presentation data. Use one server instance with persistent local disk. No new dependencies are required.

## Collaboration

See [the implementation plan](docs/implementation-plan.md) and [working agreement](docs/contributing.md). Each increment needs the user's visible review and explicit approval before pushing or merging. Shared repository: https://github.com/EldarSadeghi/soen287-covershift. Teammate access still needs verification.

CS-008 local review adds a working **Team** page: manager-scoped roster, add worker, and one-time worker account setup links. See [worker management](docs/worker-management.md). Links expire after 24 hours; no email is sent. Workers set their own passwords and then sign in.
