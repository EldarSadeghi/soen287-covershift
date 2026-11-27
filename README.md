# CoverShift

CoverShift helps small businesses find shift coverage, with manager approval before reassignment.

## Local setup

Install Node.js 24 or newer (includes npm), clone the shared repository when its URL is available, and open a terminal in the project folder.

```sh
npm start
```

Open http://127.0.0.1:3000. The server has no runtime dependencies. Run `npm ci` before running the development checks to install the pinned formatter. For automatic restarts during development, use `npm run dev`.

Optional: copy `.env.example` to `.env` and change the port if 3000 is occupied. Keep `.env` out of Git. Stop the server with Ctrl+C.

## Presentation demo (CS-021)

Run `npm run demo:prepare`, then `npm run demo:start` for isolated fictional manager and employee accounts, upcoming scenarios and a generated walkthrough. See [demo preparation](docs/demo-preparation.md) for sign-in details, reset instructions and the manual backup flow. Normal account data is preserved.

## Current scope

Managers can manage workers, create/edit/delete eligible shifts, and view saved schedules and pending coverage claims. Workers see their own assigned shifts, request/cancel coverage, and browse teammate requests. Dates use the business timezone. Protected pages use saved records; the public demo remains separate.

CS-013 is merged: **Open shifts → Check & claim** gives inline conflict warnings, a fresh server check and confirmation. Claims become pending manager approval and appear in **My requests → Coverage you claimed**. Original assignments remain unchanged until approval. CS-014 adds manager approval/rejection in Approvals with fresh conflict checks and confirmation. See [manager decisions](docs/manager-decisions.md). See [claiming instructions](docs/claiming.md).

Start at http://127.0.0.1:3000/login and use an account created through signup, or the explicit fictional role setup in [authentication instructions](docs/authentication.md). The public presentation demo stays at /demo and grants no account access.

## Structure

- `public/`: browser-facing pages and future assets.
- `src/`: server code and future application services.
- `data/`: ignored runtime JSON storage, implemented in CS-003.
- `docs/`: implementation plan, collaboration rules, and AI log.

## AI acceptance baseline (CS-029)

Run `npm run ai:acceptance` for 19 offline fictional conversation scenarios and an HTML/JSON report. No API key or paid calls are needed. The same corpus runs in `npm test`. See [scope, scenario IDs and real-model limitations](docs/ai-acceptance-tests.md).

## Checks

Run `npm run check` to check JavaScript syntax and formatting in the chat modules and `npm test` for automated verification. Start the app and verify navigation for both roles, direct-link refresh, keyboard focus, and a phone-width layout. The page, CSS, and JavaScript should load; unknown paths and private data paths should return 404. Authenticated pages use saved business records; /demo uses separate presentation data.

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

CS-009 local review adds **Schedule → Create a shift**, with worker assignment, business-timezone dates, overnight support and overlap prevention. See [shift creation](docs/shift-creation.md) for review steps and date rules.

CS-010 local review adds **Schedule → Edit shift / Delete shift** for eligible future shifts. Coverage-linked and started shifts are locked; see [shift management](docs/shift-management.md).

CS-011 local review adds **My shifts → Request coverage** and a working **My requests** page with confirmed cancellation of eligible open/pending requests. Assignments and cancelled records are preserved. See [coverage requests](docs/coverage-requests.md).

CS-012 introduced **Open shifts**, a board of teammates’ eligible future coverage requests with timezone-aware dates and refresh. CS-013 adds claiming. See [open-shift board](docs/open-shift-board.md).

CS-015 is ready for local review: **History** in both workspaces shows scoped coverage records, status filtering, current assignment and actor/time timelines. New successful actions record events atomically; older records show a saved-status snapshot with an explicit missing-history note. See [coverage history](docs/coverage-history.md).

CS-016 security/workflow verification is ready for local review: run `npm run verify` for syntax checks and the full test suite. See [verification evidence and deployment limits](docs/security-verification.md).

CS-017 is ready for local review: clearer focus/errors, keyboard dismissal and refresh focus, explicit password labels, larger phone controls and wrapped navigation/long content. See [accessibility review and verification](docs/accessibility-review.md).

CS-019 is ready for local review: **Team** can delete employees with no work records or deactivate eligible employees while retaining history. Active/inactive filtering, blockers and confirmation are included. See [employee removal](docs/employee-removal.md). **CS-018 Deployment and submission remains the final step.**

## Acceptance review

The [2026-11-18 acceptance report and proposed tasks](docs/acceptance/2026-11-18/REPORT.md) reviews the 18 merged implementation issues. See the [criterion-by-criterion evidence register](docs/acceptance/2026-11-18/CRITERIA.md) and [reproduction instructions](docs/acceptance/2026-11-18/REPRODUCE.md) for supporting logs, screenshots and limitations. Proposed tasks remain recommendations awaiting selection; CS-018 Deployment and submission remains the final step.

CS-020 local review improves request recovery and loads saved Schedule independently of the worker selector. See [request recovery](docs/request-recovery.md) for timeout, retry and uncertain-save behavior. User approval is required before push/merge.

CS-022 local review separates **Expired** coverage from actionable Approvals and adds an Expired filter to both-role History. Stored decisions/events and assignments remain intact. See [expired coverage](docs/expired-coverage.md). Awaiting user approval before push/merge.

Persistent AI chat and manager shift drafting (CS-031A): [setup, usage, budget controls and validation](docs/ai-shift-drafting.md). Manual scheduling works without an API key.

Employee AI search and confirmed requests (CS-031B-1): [workflow, scope and acceptance evidence](docs/ai-employee-shift-search.md). Employees review a real opening and explicitly confirm before a request is submitted for manager approval.

Employee confirmed availability (CS-031B-2): [usage, limits and safeguards](docs/ai-availability-rules.md). Rules require explicit confirmation; automatic matching and notifications are later increments.

Automatic availability matching (CS-031C): [execution, limits, approval and verification](docs/automatic-matching.md). Confirmed rules can submit eligible requests while the server runs; managers approve assignment changes.


Employee time off (CS-030): both roles have **Time off**, with full-day/partial-day requests, confirmed decisions/cancellation, private history and approved-leave scheduling safeguards. See [workflow, policy and recovery](docs/time-off.md).

Employee availability (CS-031): employees confirm dated windows in **Availability**; managers check Available / Unavailable / Unknown against saved windows and current conflicts. General windows are separate from automatic chat rules. See [policy and recovery](docs/employee-availability.md).

### Request cover (CS-040)

Employees can invite an available coworker to cover a whole assigned shift; acceptance still requires manager approval. See [workflow and review accounts](docs/request-cover.md) and [acceptance evidence](docs/acceptance/cs040/USER-STORIES.md). Completed in [PR #76](https://github.com/EldarSadeghi/soen287-covershift/pull/76).
