import { randomUUID } from 'node:crypto';
import { saveWindow } from '../availability/windows.js';
import { coverageShiftRevision, requestCoverage } from '../requests/coverage.js';
import { addDays, nextScheduleMonday, prepareSchedule } from '../schedules/publication.js';
import { createShift } from '../shifts/create.js';

export async function addPresentationScenarios(store, manifest, now) {
  const clock = () => now;
  const { thursday } = manifest.dates;
  const { timezone } = manifest;
  const openings = [
    { title: 'Evening coverage', worker: 'worker_sam', from: '17:00', until: '18:00' },
    { title: 'Closing coverage', worker: 'worker_taylor', from: '18:00', until: '20:00' },
  ];
  for (const opening of openings) {
    const { shift } = await createShift(store, 'manager_morgan', {
      title: opening.title, assignedWorkerId: opening.worker,
      startLocal: thursday + 'T' + opening.from, endLocal: thursday + 'T' + opening.until,
    }, clock);
    const snapshot = await store.read();
    const saved = snapshot.shifts.find(record => record.id === shift.id);
    await requestCoverage(store, opening.worker, shift.id, { revision: coverageShiftRevision(snapshot, saved) }, clock);
  }

  await saveWindow(store, 'worker_alex', {
    submissionId: randomUUID(),
    window: { startLocal: thursday + 'T17:00', endLocal: thursday + 'T20:00', timezone },
  }, clock);
  const startsOn = nextScheduleMonday(now, timezone);
  const overnightOn = addDays(startsOn, 1);
  const overnightEndsOn = addDays(overnightOn, 1);
  await prepareSchedule(store, 'manager_morgan', { startsOn }, clock);
  const summaryWeek = thursday < startsOn ? 'this' : 'next';
  const batchPrompt = `Draft two shifts: Presentation opening for Jamie Lee on ${startsOn} from 9 AM to noon and Presentation overnight for Alex Morgan on ${overnightOn} from 9 PM to 1 AM on ${overnightEndsOn}.`;
  const searchPrompt = `Find open shifts with coverage in the title on ${thursday} between 2 PM and 8 PM.`;
  return { ...manifest, presentation: { startsOn, endsOn: addDays(startsOn, 13), summaryWeek, batchPrompt, searchPrompt } };
}

// The optional preview exercises production validation with recorded replies for
// these two documented prompts. It cannot send network requests to the provider.
export function presentationReplies(manifest) {
  const { startsOn, batchPrompt, searchPrompt } = manifest.presentation;
  return async (_url, { body }) => {
    const payload = JSON.parse(body);
    const context = JSON.parse(payload.input);
    const match = expected => context.request.trim().toLowerCase() === expected.toLowerCase();
    let reply;
    if (payload.text.format.name === 'shift_batch' && match(batchPrompt)) {
      const worker = name => context.workers.find(row => row.name === name)?.ref;
      reply = { kind: 'batch', question: '', shifts: [
        { title: 'Presentation opening', worker: worker('Jamie Lee'), startLocal: startsOn + 'T09:00', endLocal: startsOn + 'T12:00' },
        { title: 'Presentation overnight', worker: worker('Alex Morgan'),
          startLocal: addDays(startsOn, 1) + 'T21:00', endLocal: addDays(startsOn, 2) + 'T01:00' },
      ] };
    } else if (payload.text.format.name === 'existing_shift_search' && match(searchPrompt)) {
      const date = manifest.dates.thursday;
      reply = { kind: 'search', question: '', date, startLocal: date + 'T14:00', endLocal: date + 'T20:00', title: 'coverage' };
    } else return new Response(null, { status: 503 });
    return Response.json({ status: 'completed', output: [{ type: 'message', content: [
      { type: 'output_text', text: JSON.stringify(reply) },
    ] }] });
  };
}
