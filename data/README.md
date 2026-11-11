# Private runtime data

`covershift.json` stores the versioned business, user, shift, and coverage-request collections. This file, writer locks, and temporary files are ignored by Git. No data files are served by the web server.

Run `npm run data:seed` to create fictional records in an empty database; existing records are preserved. Run `npm run data:inspect` for a read-only summary. Server startup creates empty storage if missing and validates existing files.

See [the data model and recovery notes](../docs/data-model.md). Do not commit passwords, sessions, or personal staffing data. Demo users have no login credentials; signup and login come in subsequent increments.
