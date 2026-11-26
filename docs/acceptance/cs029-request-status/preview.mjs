import { randomUUID } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createAppServer } from '../../../src/app.js';
import { saveWindow } from '../../../src/availability/windows.js';
import { coverOptions, sendCoverInvitation } from '../../../src/cover/service.js';
import { prepareDemo } from '../../../src/demo/preparation.js';
import { requestTimeOff } from '../../../src/time-off/service.js';

const now = Date.parse('2026-11-26T12:00:00Z');
const clock = () => now;
const { store, manifest } = await prepareDemo(join(await mkdtemp(join(tmpdir(), 'covershift-status-')), 'demo'), { now });
const { friday, thursday } = manifest.dates;
const timezone = manifest.timezone;

for (const [date, start, end] of [
  [thursday, '18:00', '19:00'],
  [friday, '18:30', '19:30'],
  [friday, '20:00', '21:00'],
]) {
  await requestTimeOff(store, 'worker_jamie', {
    startLocal: date + 'T' + start, endLocal: date + 'T' + end,
    allDay: false, note: '', submissionId: randomUUID(), timezone,
  }, clock);
}

await saveWindow(store, 'worker_alex', {
  window: { startLocal: thursday + 'T09:00', endLocal: thursday + 'T12:00', timezone },
  submissionId: randomUUID(),
}, clock);
const { shifts } = await coverOptions(store, 'worker_jamie', 'worker_alex', clock);
const opening = shifts.find(shift => shift.startsAt.startsWith(thursday));
await sendCoverInvitation(store, 'worker_jamie', {
  recipientId: 'worker_alex', shiftId: opening.id, revision: opening.revision,
  submissionId: randomUUID(), note: '',
}, clock);

createAppServer({ store, shiftClock: clock }).listen(3068, '127.0.0.1', () => {
  console.log('Employee: http://127.0.0.1:3068/login');
  console.log('Manager: http://localhost:3068/login');
});
