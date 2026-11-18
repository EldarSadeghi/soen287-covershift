# Reproduce the acceptance review

Run from the repository root with Node 24+. These scripts use temporary fictional stores. Do not point preview/fault tests at real data. The scripts are review utilities, not production application changes.

## Current regression suite

```sh
npm run verify
```

Expected at reviewed commit: syntax checks and 108 tests passed, 0 failed/skipped. HTTP tests need loopback-listener permission. The saved successful transcript is `evidence/verify.log`.

## Current-date usability probe of original seed

```sh
node docs/acceptance/2026-11-18/evidence/probe-expired-seed.mjs
```

Uses fixed audit date November 18, 2026, in a new temporary store; expects zero upcoming seeded shifts and one expired pending claim. Approval/rejection/cancellation each must return 409 without altering storage. This probes an existing policy limitation, not a desired new product behavior. Saved output: `evidence/expired-seed-check.json`.

## Normal fictional browser preview

```sh
node docs/acceptance/2026-11-18/evidence/create-preview.mjs
```

This prints a fresh `/tmp/covershift-acceptance-*` directory. Substitute that exact directory below:

```sh
DATA_DIRECTORY=/tmp/covershift-acceptance-REPLACE PORT=3013 npm start
```

Open http://localhost:3013/login. The review utility enables fictional seed users with the fictional-only password `Fictional acceptance review access!`; manager email `manager_morgan@example.test`, employee `worker_jamie@example.test`. Never use these demo credentials in production. Fixture shifts are moved to November 26–30, 2026 for this dated audit; this utility is not itself a solution to F-02 and eventually expires too.

Follow B-01–B-14 in REPORT.md. At the end the browser should show a six-shift manager schedule, an approved Taylor claim, a cancelled Jamie request on Acceptance overnight, and Jamie's pending claim for Sam. For an exact repeat create another fresh directory, since the walkthrough changes fictional data. Actual browser deletion, password creation/reset and employee deactivation submission were not part of this new browser walkthrough; automated tests cover them where stated.

Check settled responsive layout at 320×800 on the active preview tab. Record actual `innerWidth` before interpreting measurements; resize overrides may apply only to the selected tab. Reset overrides afterward. Desktop and earlier 390px/long-content checks are distinguished in the report.

## Inject only a delayed roster response

Stop any old fault server on port 3014 first. Use a temporary directory printed by create-preview.mjs; the wrapper refuses paths outside that temporary naming pattern.

```sh
ACCEPTANCE_DATA_DIRECTORY=/tmp/covershift-acceptance-REPLACE node docs/acceptance/2026-11-18/evidence/inject-roster-delay.mjs
```

Open http://localhost:3014/login, sign in as the fictional manager. The wrapper serves the real application and only intercepts `GET /api/manager/workers`, returning a synthetic 503 after 45 seconds. All other handlers, including the dashboard, are unchanged.

1. Open Team. After more than 15 seconds, inspect whether Refresh/retry becomes available. Audit observation at 23.577 seconds: Refresh disabled, roster aria-busy true, Loading your team remains.
2. Open Schedule. Saved schedule is initially empty behind Loading your workers, even though dashboard is healthy; no roster retry shown. Refresh has not yet received its handler because mount waits for roster. After the 45-second response, normal error handling can proceed. An indefinitely unresolved fetch has no application deadline.
3. Expected behavior for proposed CS-020: bounded roster error/retry, independent saved schedule loading and working Refresh; no automatic uncertain-mutation retries.
4. Stop this wrapper with Ctrl+C. Leave the normal preview only if needed. This fault wrapper must never be used as the real server.

Screenshots: team-stall.png and schedule-stall.png. Source relationships: `public/team.js` api/refresh, `public/create-shift.js` loadWorkers, `public/manager-dashboard.js` awaited creation mount before load/listener. Unbounded writes and other authentication fetches were source-reviewed, not all separately fault-injected.

## Evidence index

- `github-issues-and-merges.json`: fetched original closed-issue bodies and merged PR metadata; contains historical wording.
- `criterion-register.csv`: 1:1 checklist-to-AT-ID register with qualifications.
- `verify.log`: successful full syntax/test run.
- `http-checks.json`: 24 expected/actual public/asset/private-path checks (some shared assets repeated across pages).
- `expired-seed-check.json`: independent observed expired-seed assertions.
- `worker-history.png`: current participant-only pending/cancelled history.
- `worker-mobile.png`, `manager-mobile.png`: populated 320px reflow screenshots.
- `team-stall.png`, `schedule-stall.png`: delayed-roster failure evidence.

The raw HTTP checks were fresh requests to login/signup/setup/demo and referenced CSS/JS, plus runtime JSON/source/.env/AGENTS/unknown paths. Expected public/asset responses are 200; expected private/unknown responses are 404. Protected role/session/mutation guards are exercised in the integration suites, rather than inferred from these public checks.
