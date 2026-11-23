# CS-021 acceptance report — 2026-11-23

Issue #65. Branch `codex/CS-021-demo-preparation`. Local implementation awaiting user review; no push or merge. Deployment/submission CS-018 remains last.

## Results

| ID | User story / acceptance criterion | Result and evidence |
| --- | --- | --- |
| CS-021-US01 | As presenter, prepare fictional manager/employee accounts without changing normal records. | Pass. Fixed managed demo root, unique run/business, real hashed fictional password, protected role sign-in. Workspace and Desktop normal database fingerprints unchanged; `reset-verification.json`. |
| CS-021-US02 | Show useful upcoming schedules, requests, decisions and history. | Pass. Five future shifts, four employees, two open requests, one pending Friday claim; Jamie starts with two assigned shifts / seven hours; approved and cancelled historical records. Fixtures use real application services and validated storage. |
| CS-021-US03 | Keep scenarios relevant when preparing on a different day. | Pass. Strictly next Thursday in Toronto; Friday/Saturday follow; year/DST/local-day boundaries checked. Launcher rejects stale preparations. Generated guide includes exact dates. |
| CS-021-US04 | Rehearse changes and safely restore the starting scenario. | Pass. Every preparation selects a fresh isolated run. Actual browser rehearsal run `run-2026-11-23-EsoafD` retained byte-for-byte after selecting pristine `run-2026-11-23-AE6mBO`. Failed preparation retains prior pointer and data. |
| CS-021-US05 | Keep both roles open during the presentation. | Pass. Manager localhost / employee 127.0.0.1 on 3035, distinct host sessions and demo-specific cookie names. Both fresh-run sign-ins verified; final tabs left at Overview and My shifts. |
| CS-021-US06 | Demonstrate AI and approval using saved work. | Pass within rehearsed scenarios. Real configured provider answered “When is my next shift?” with Jamie’s November 26 Opening service, 9AM–12PM / three hours, plus a separate pending claim note. Friday manager approval explicitly confirmed; UI reported transfer. Employee notifications showed approved receipt. `employee-ai.png`. |
| CS-021-US07 | Demonstrate automatic matching without bypassing approval. | Pass. Resumed prepared paused Saturday Weekend service rule in employee chat. Manager refresh showed Jamie’s pending request, original Alex assignment preserved. Employee inbox showed the submitted pending receipt. `automatic-pending.png`. |
| CS-021-US08 | Continue core presentation when AI is unavailable. | Pass. CLI integration starts with no API key and authenticates both roles; manual service walkthrough approves prepared claim and resumes rule. Live browser confirmed manual manager approval. Guide provides manual Open shifts/Schedule fallback. No fake provider response. |
| CS-021-US09 | Prevent accidental production use or unsafe data selection. | Pass. Production blocked, unknown roots/symlinks/traversal/manifest mismatch rejected; fixed root ignores normal DATA_DIRECTORY; loopback bind; port conflict and stale startup errors checked. Shared AI usage survives fresh preparations. |
| CS-021-US10 | Have clear instructions to follow and retry before presenting. | Pass. `docs/demo-preparation.md`, README commands, per-run dated `WALKTHROUGH.md`, role credentials, five-minute path, reset instructions, usage limits and recording/manual backup guidance. |

## Checks and scope

`npm run verify`: syntax checks and **223/223 tests pass**, including nine new fixture/preparation/CLI tests. Full output: `verification.txt`. CLI tests use a temporary copy, real protected sign-in and live HTTP server, with no private `.env` or normal database. Tests exercise multiple preparation dates, paused matching state, atomic repeat preparation, unsafe paths, environment guards, used port, stale run, and graceful stop.

Browser rehearsal used only fictional data at port 3035 with the existing private provider configuration loaded in the process. No key was copied into files or screenshots. Screenshots: `manager-start.png`, `employee-start.png` (fresh final run), `employee-ai.png`, `automatic-pending.png` (rehearsal). The final selected run was regenerated after rehearsal and retains the initial pending/open states; AI usage accounting was not reset.

The live AI check covers one existing schedule-question path, not exhaustive provider evaluation. Other AI capabilities already have their own feature acceptance evidence. The demo does not add chat intents, change production workflow logic, create email delivery, host the site, or generate a screen recording. Provider/network availability and credits still matter; manual fallback is documented. Original records are preserved rather than deleted on reset; repeated preparation consumes local disk. Stop the demo before preparing another run, and use one demo server instance.
