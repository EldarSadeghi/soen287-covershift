import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { JsonStore } from '../src/storage/json-store.js';
import { demoDatabase, seedDemo } from '../src/storage/seed.js';
import { createRecord, createRepositories } from '../src/storage/repositories.js';
import { validateDatabase } from '../src/storage/model.js';

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'covershift-storage-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const filename = join(directory, 'covershift.json');
  return { directory, filename, store: new JsonStore(filename) };
}

test('initializes empty, seeds stable references, and survives a new process', async t => {
  const { directory, filename, store } = await fixture(t);
  await store.initialize();
  assert.equal((await store.read()).users.length, 0);
  assert.equal(await seedDemo(store), true);
  const before = await store.read();
  assert.equal(before.users.length, 5);
  assert.equal(before.shifts.length, 5);
  const second = new JsonStore(filename);
  await second.initialize();
  assert.deepEqual(await second.read(), before);
  const child = spawnSync(process.execPath, ['scripts/data.js', 'inspect'], {
    encoding: 'utf8', env: { ...process.env, DATA_DIRECTORY: directory },
  });
  assert.equal(child.status, 0, child.stderr);
  assert.match(child.stdout, /worker_jamie/);
  assert.doesNotMatch(child.stdout, /passwordHash/);
  assert.equal((await stat(filename)).mode & 0o777, 0o600);
});

test('seeding never replaces existing records, even after edits', async t => {
  const { store } = await fixture(t);
  await seedDemo(store);
  await store.transaction(db => { db.businesses[0].name = 'Edited café'; });
  const before = await store.read();
  assert.equal(await seedDemo(store), false);
  assert.deepEqual(await store.read(), before);
});

test('concurrent transactions across store instances do not lose writes', async t => {
  const { store, filename, directory } = await fixture(t);
  await seedDemo(store);
  await store.transaction(db => { db.businesses[0].name = '0'; });
  await Promise.all(Array.from({ length: 25 }, (_, index) => (index % 2 ? store : new JsonStore(filename)).transaction(async db => {
    const next = Number(db.businesses[0].name) + 1;
    await new Promise(resolve => setTimeout(resolve, 1));
    db.businesses[0].name = String(next);
  })));
  assert.equal((await store.read()).businesses[0].name, '25');
  assert.deepEqual(await readdir(directory), ['covershift.json']);
});

test('failed and invalid transactions preserve disk data and release the queue', async t => {
  const { store, filename } = await fixture(t);
  await seedDemo(store);
  const before = await readFile(filename, 'utf8');
  await assert.rejects(store.transaction(db => { db.users.length = 0; throw new Error('Abort'); }), /Abort/);
  await assert.rejects(store.transaction(db => { db.shifts[0].assignedWorkerId = 'missing'; }), /worker in its business/);
  assert.equal(await readFile(filename, 'utf8'), before);
  await store.transaction(db => { db.businesses[0].name = 'Recovered'; });
  assert.equal((await store.read()).businesses[0].name, 'Recovered');
});

test('corrupt files and unsupported schema versions are never reset', async t => {
  const { store, filename } = await fixture(t);
  for (const content of ['{broken', JSON.stringify({ ...demoDatabase(), schemaVersion: 99 })]) {
    await writeFile(filename, content);
    await assert.rejects(store.initialize());
    await assert.rejects(seedDemo(store));
    assert.equal(await readFile(filename, 'utf8'), content);
  }
});

test('an existing writer lock rejects writes without changing or removing its lock', async t => {
  const { store, filename } = await fixture(t);
  await seedDemo(store);
  const before = await readFile(filename, 'utf8');
  await writeFile(`${filename}.lock`, 'other writer');
  await assert.rejects(store.transaction(() => {}), /Storage is busy/);
  assert.equal(await readFile(filename, 'utf8'), before);
  assert.equal(await readFile(`${filename}.lock`, 'utf8'), 'other writer');
});

test('readers always see complete valid JSON during writes', async t => {
  const { store } = await fixture(t);
  await seedDemo(store);
  await Promise.all([
    ...Array.from({ length: 15 }, (_, index) => store.transaction(db => { db.businesses[0].name = `Café ${index}`; })),
    (async () => { for (let i = 0; i < 50; i++) validateDatabase(await store.read()); })(),
  ]);
});

test('repositories scope by business and return detached records', async t => {
  const { store } = await fixture(t);
  await seedDemo(store);
  await store.transaction(db => {
    db.businesses.push({ ...db.businesses[0], id: 'another_business', name: 'Other café' });
    db.users.push({ ...db.users[1], id: 'worker_other', businessId: 'another_business', email: 'other@example.test' });
    db.shifts.push({ ...db.shifts[0], id: 'shift_other', businessId: 'another_business', assignedWorkerId: 'worker_other' });
  });
  const repos = createRepositories(store);
  assert.equal((await repos.users.list('another_business')).length, 1);
  assert.equal((await repos.users.list('business_demo_cafe')).length, 5);
  assert.equal(await repos.users.findById('business_demo_cafe', 'worker_other'), null);
  assert.equal(await repos.shifts.findById('another_business', 'shift_thursday'), null);
  assert.equal(await repos.shifts.findById('business_demo_cafe', 'shift_other'), null);
  await assert.rejects(repos.users.list(), /business ID/);
  const users = await repos.users.list('business_demo_cafe');
  users[0].name = 'Not persisted';
  assert.equal((await store.read()).users[0].name, 'Morgan Chen');
  const first = createRecord({ name: 'First' });
  const second = createRecord({ name: 'Second' });
  assert.notEqual(first.id, second.id);
});

test('model rejects duplicate identities, cross-business references, and invalid workflow records', () => {
  const invalidEdits = [
    db => { db.users[1].email = db.users[0].email; },
    db => { db.users[1].id = db.users[0].id; },
    db => { db.users[1].password = 'plaintext'; },
    db => { db.businesses[0].timezone = 'Invalid/Timezone'; },
    db => { db.shifts[0].endsAt = db.shifts[0].startsAt; },
    db => { db.coverageRequests[0].claimantId = 'worker_alex'; },
    db => { db.coverageRequests[0].reviewerId = 'worker_jamie'; },
    db => { db.coverageRequests[1].status = 'pending'; },
    db => { db.coverageRequests[1].shiftId = 'shift_friday'; db.coverageRequests[1].originalWorkerId = 'worker_alex'; },
    db => {
      db.businesses.push({ ...db.businesses[0], id: 'other_business' });
      db.users.find(u => u.id === 'worker_taylor').businessId = 'other_business';
    },
  ];
  for (const edit of invalidEdits) {
    const db = demoDatabase();
    edit(db);
    assert.throws(() => validateDatabase(db), /Invalid database/);
  }
});
