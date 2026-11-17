import { createHash } from 'node:crypto';
import { HttpError } from '../auth/errors.js';
import { managerBusiness } from '../shifts/create.js';
export function workerRemovalState(db, worker, now) {
  const assigned = db.shifts.filter(s => s.businessId === worker.businessId && s.assignedWorkerId === worker.id);
  const requests = db.coverageRequests.filter(r => r.businessId === worker.businessId && (r.originalWorkerId === worker.id || r.claimantId === worker.id || r.history?.some(e => e.actorId === worker.id)));
  const blockers = assigned.filter(s => Date.parse(s.endsAt) > now).map(s => ({ id:s.id, title:s.title, kind:'assignment', startsAt:s.startsAt, endsAt:s.endsAt }));
  for (const r of requests.filter(r => r.status === 'pending' && r.claimantId === worker.id)) {
    const shift = db.shifts.find(s => s.id === r.shiftId);
    if (Date.parse(shift.endsAt) > now) blockers.push({id:shift.id,title:shift.title,kind:'pending_claim',startsAt:shift.startsAt,endsAt:shift.endsAt});
  }
  return { revision: createHash('sha256').update(JSON.stringify([worker,assigned,requests])).digest('hex'), canDelete: assigned.length === 0 && requests.length === 0, canDeactivate: !worker.deactivation && blockers.length === 0, blockers };
}
export async function removeWorker(store, managerId, workerId, action, input, clock=Date.now) {
  return store.transaction(db => {
    const business = managerBusiness(db,managerId);
    if (!['delete','deactivate'].includes(action) || !input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length !== 1 || typeof input.revision !== 'string' || !/^[a-f0-9]{64}$/.test(input.revision)) throw new HttpError(422,'Submit only the current employee revision.');
    const worker = db.users.find(u=>u.id===workerId && u.businessId===business.id && u.role==='worker');
    if (!worker) throw new HttpError(404,'Employee not found. Refresh Team.');
    const now=clock(); const state=workerRemovalState(db,worker,now);
    if (state.revision !== input.revision) throw new HttpError(409,'This employee or their work changed. Refresh Team and review again.');
    if (action==='delete') {
      if (!state.canDelete) throw new HttpError(409,'This employee has shift or coverage history. Deactivate them to preserve records.');
      db.users=db.users.filter(u=>u.id!==worker.id);
    } else {
      if (worker.deactivation) throw new HttpError(409,'This employee is already inactive.');
      if (!state.canDeactivate) throw new HttpError(409,'Resolve current/upcoming assignments and pending claims before deactivating this employee.',{blockers:state.blockers});
      const at=new Date(Math.max(now,Date.parse(worker.updatedAt)+1)).toISOString();
      db.schemaVersion=Math.max(db.schemaVersion,5);worker.passwordHash=null;delete worker.setup;
      worker.deactivation={at,managerId};worker.updatedAt=at;
    }
    return {message:action==='delete'?`${worker.name} was deleted. Their account and setup access are removed.`:`${worker.name} is inactive. Sign-in and setup access are blocked; history is retained.`};
  });
}
