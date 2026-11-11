import { store } from '../src/storage/index.js';
import { seedDemo } from '../src/storage/seed.js';

try {
  const command = process.argv[2];
  if (command === 'seed') {
    console.log(await seedDemo(store) ? 'Fictional demo records saved.' : 'Existing records preserved; demo seed skipped.');
  } else if (command !== 'inspect') {
    throw new Error('Use npm run data:seed or npm run data:inspect.');
  }
  const database = await store.read();
  console.log(`Storage: ${store.filename}`);
  console.log(`Schema: ${database.schemaVersion}`);
  console.table([
    { collection: 'Businesses', records: database.businesses.length },
    { collection: 'Users', records: database.users.length },
    { collection: 'Shifts', records: database.shifts.length },
    { collection: 'Coverage requests', records: database.coverageRequests.length },
  ]);
  // Review metadata only; never print password hashes or future credentials.
  console.table(database.businesses.map(({ id, name, timezone }) => ({ id, name, timezone })));
  console.table(database.users.map(({ id, name, role, businessId }) => ({ id, name, role, businessId })));
  console.table(database.shifts.map(({ id, assignedWorkerId, startsAt, endsAt }) => ({ id, assignedWorkerId, startsAt, endsAt })));
  console.table(database.coverageRequests.map(({ id, shiftId, status }) => ({ id, shiftId, status })));
} catch (error) {
  console.error(error.code === 'ENOENT' ? 'No data file yet. Run npm run data:seed, or start the server to initialize empty storage.' : error.message);
  process.exitCode = 1;
}
