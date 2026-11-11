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

CS-002 provides a responsive worker/manager navigation preview with fictional sample records. Use the Worker/Manager preview switch and navigation to explore all seven screens. Direct links such as `http://127.0.0.1:3000/#/manager/approvals` can be refreshed or bookmarked. The switch is a demo control, not authentication or authorization. Accounts, JSON persistence, and shift actions are future increments; disabled buttons are labeled Coming soon. Confirm the course's allowed backend stack before authentication work.

## Structure

- `public/`: browser-facing pages and future assets.
- `src/`: server code and future application services.
- `data/`: ignored runtime JSON storage, implemented in CS-003.
- `docs/`: implementation plan, collaboration rules, and AI log.

## Checks

Run `npm run check` to check server and frontend JavaScript syntax. Start the app and verify navigation for both roles, direct-link refresh, keyboard focus, and a phone-width layout. The page, CSS, and JavaScript should load; unknown paths should return 404. This increment contains demo presentation data and no persistent business logic.

## Collaboration

See [the implementation plan](docs/implementation-plan.md) and [working agreement](docs/contributing.md). Each increment needs the user's visible review and explicit approval before pushing or merging. Shared repository: https://github.com/EldarSadeghi/soen287-covershift. Teammate access still needs verification.
