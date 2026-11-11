export function demoDatabase() {
  const time = '2026-11-11T15:00:00.000Z';
  const record = fields => ({ ...fields, createdAt: time, updatedAt: time });
  const businessId = 'business_demo_cafe';
  return {
    schemaVersion: 1,
    businesses: [record({ id: businessId, name: 'Neighbourhood Café', timezone: 'America/Toronto' })],
    users: [
      ['manager_morgan', 'Morgan Chen', 'manager'],
      ['worker_jamie', 'Jamie Lee', 'worker'],
      ['worker_alex', 'Alex Morgan', 'worker'],
      ['worker_sam', 'Sam Rivera', 'worker'],
      ['worker_taylor', 'Taylor Brooks', 'worker'],
    ].map(([id, name, role]) => record({ id, businessId, name, role, email: `${id}@example.test`, passwordHash: null })),
    shifts: [
      ['shift_thursday', 'Morning shift', 'worker_jamie', '2026-11-12T12:00:00.000Z', '2026-11-12T18:00:00.000Z'],
      ['shift_saturday', 'Afternoon shift', 'worker_jamie', '2026-11-14T17:00:00.000Z', '2026-11-14T23:00:00.000Z'],
      ['shift_monday', 'Opening shift', 'worker_jamie', '2026-11-16T11:30:00.000Z', '2026-11-16T17:30:00.000Z'],
      ['shift_friday', 'Afternoon coverage', 'worker_alex', '2026-11-13T18:00:00.000Z', '2026-11-13T23:00:00.000Z'],
      ['shift_sunday', 'Morning coverage', 'worker_sam', '2026-11-15T13:00:00.000Z', '2026-11-15T19:00:00.000Z'],
    ].map(([id, title, assignedWorkerId, startsAt, endsAt]) => record({ id, businessId, title, assignedWorkerId, startsAt, endsAt })),
    coverageRequests: [
      record({ id: 'request_friday', businessId, shiftId: 'shift_friday', originalWorkerId: 'worker_alex', claimantId: 'worker_taylor', reviewerId: null, status: 'pending' }),
      record({ id: 'request_sunday', businessId, shiftId: 'shift_sunday', originalWorkerId: 'worker_sam', claimantId: null, reviewerId: null, status: 'open' }),
    ],
  };
}

export async function seedDemo(store) {
  await store.initialize();
  return store.transaction(database => {
    if (Object.values(database).some(value => Array.isArray(value) && value.length > 0)) return false;
    Object.assign(database, demoDatabase());
    return true;
  });
}
