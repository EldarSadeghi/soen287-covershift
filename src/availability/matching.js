import { randomUUID } from 'node:crypto';
import { claimRevision, claimCommitments, claimInDatabase } from '../requests/claim.js';
import { findClaimConflicts } from '../../public/claim-conflicts.js';

export const matchesForRule = (db, ruleId) => (db.availabilityMatches || []).filter(m => m.ruleId === ruleId);
// Trusted business service: no provider call, timers, I/O, or nested transaction.
// All decisions and the resulting claim+ledger commit share the caller's lock.
export function matchAvailability(db, now = Date.now()) {
  if (!db.availabilityRules?.length) return 0;
  const users = new Map(db.users.map(u => [u.id,u]));
  const businesses = new Map(db.businesses.map(b => [b.id,b]));
  const shifts = new Map(db.shifts.map(s => [s.id,s]));
  const ledger = db.availabilityMatches || [];
  const counts = new Map(); const attempted = new Set();
  for (const match of ledger) { counts.set(match.ruleId,(counts.get(match.ruleId)||0)+1);attempted.add(`${match.workerId}:${match.shiftId}`); }
  for (const r of db.coverageRequests) if (r.status === 'rejected') attempted.add(`${r.claimantId}:${r.shiftId}`);
  const rules = db.availabilityRules.filter(r => r.status === 'active' && Date.parse(r.endsAt) > now).sort((a,b) => a.confirmedAt.localeCompare(b.confirmedAt) || a.id.localeCompare(b.id));
  const openings = db.coverageRequests.filter(r => r.status === 'open' && r.claimantId === null && r.reviewerId === null).sort((a,b) => (shifts.get(a.shiftId)?.startsAt || '').localeCompare(shifts.get(b.shiftId)?.startsAt || '') || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  let matched = 0;
  for (const request of openings) {
    const shift = shifts.get(request.shiftId);
    if (!shift || shift.businessId !== request.businessId || shift.assignedWorkerId !== request.originalWorkerId || Date.parse(shift.startsAt) <= now) continue;
    for (const rule of rules) {
      const worker = users.get(rule.workerId); const business = businesses.get(rule.businessId);
      if (rule.businessId !== request.businessId || !business || business.timezone !== rule.timezone || !worker || worker.role !== 'worker' || worker.deactivation || worker.passwordHash === null || worker.businessId !== rule.businessId || worker.id === request.originalWorkerId) continue;
      if ((counts.get(rule.id)||0) >= rule.maxClaims || attempted.has(`${worker.id}:${shift.id}`) || shift.startsAt < rule.startsAt || shift.endsAt > rule.endsAt || !shift.title.toLocaleLowerCase().includes(rule.title.toLocaleLowerCase())) continue;
      if (findClaimConflicts(shift,claimCommitments(db,worker,now)).length) continue;
      claimInDatabase(db,worker.id,request.id,{revision:claimRevision(request,shift)},Math.max(now,Date.parse(rule.confirmedAt)));
      const at = request.updatedAt;
      const match = {id:randomUUID(),businessId:rule.businessId,ruleId:rule.id,workerId:worker.id,shiftId:shift.id,requestId:request.id,createdAt:at,updatedAt:at};
      db.schemaVersion = Math.max(db.schemaVersion,7); db.availabilityMatches ||= []; db.availabilityMatches.push(match);
      counts.set(rule.id,(counts.get(rule.id)||0)+1);attempted.add(`${worker.id}:${shift.id}`);
      // Bump revisions so stale rule controls cannot ignore consumed capacity.
      rule.updatedAt = new Date(Math.max(now,Date.parse(rule.updatedAt)+1,Date.parse(at))).toISOString();
      matched++; break;
    }
  }
  return matched;
}
export function withAvailabilityMatching(store, clock = Date.now) {
  return {
    filename:store.filename,
    read:()=>store.read(),
    transaction:change=>store.transaction(async db=>{const result=await change(db);matchAvailability(db,clock());return result;}),
  };
}
export async function reconcileAvailability(store, clock = Date.now) {
  // Avoid rewriting a read-only/no-match database every polling interval. The
  // exclusive transaction still recomputes everything, never trusts this probe.
  const snapshot = await store.read();
  if (!matchAvailability(snapshot,clock())) return 0;
  return store.transaction(db=>matchAvailability(db,clock()));
}
export function startAvailabilityMatching(store,{clock=Date.now,intervalMs=30000,onError=()=>console.error('Availability matching failed. Check storage health; next reconciliation will retry.')}={}) {
  let running=false,stopped=false;
  const run=async()=>{if(running||stopped)return;running=true;try{await reconcileAvailability(store,clock);}catch{onError();}finally{running=false;}};
  const timer=setInterval(()=>{void run();},intervalMs);timer.unref?.();
  return {run,stop(){stopped=true;clearInterval(timer);}};
}
