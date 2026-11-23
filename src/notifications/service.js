import { createHash } from 'node:crypto';
import { HttpError } from '../auth/errors.js';
import { coverageDisplayState } from '../requests/status.js';
const eventKey = (r,e) => `${r.id}:${e.action}:${e.at}`;
export const coverageEventKeys = db => new Set(db.coverageRequests.flatMap(r => (r.history || []).map(e => eventKey(r,e))));
// Capture BEFORE a workflow and project AFTER matching, inside its storage lock.
// Existing histories are intentionally not backfilled on upgrade or restart.
export function publishCoverageNotifications(db, before) {
  const existing = new Set((db.notifications || []).map(n => n.id));
  for (const r of db.coverageRequests) for (const e of r.history || []) {
    if (before.has(eventKey(r,e)) || !['claimed','approved','rejected','cancelled'].includes(e.action) || !r.claimantId) continue;
    const recipients = new Set([r.claimantId]);
    if (['approved','rejected'].includes(e.action)) recipients.add(r.originalWorkerId);
    if (['claimed','cancelled'].includes(e.action)) for (const u of db.users) if (u.businessId === r.businessId && u.role === 'manager') recipients.add(u.id);
    for (const userId of recipients) {
      const user = db.users.find(u => u.id === userId && u.businessId === r.businessId);
      if (!user || user.deactivation || user.passwordHash === null) continue;
      const id = createHash('sha256').update(`${eventKey(r,e)}:${userId}`).digest('hex');
      if (existing.has(id)) continue;
      db.schemaVersion = Math.max(db.schemaVersion,8); db.availabilityRules ||= []; db.availabilityMatches ||= []; db.notifications ||= [];
      db.notifications.push({id,businessId:r.businessId,userId,requestId:r.id,action:e.action,createdAt:e.at,readAt:null});existing.add(id);
    }
  }
}
function account(db,userId) {
  const u=db.users.find(u=>u.id===userId && u.passwordHash !== null && !u.deactivation);
  if (!u) throw new HttpError(401,'Please sign in to continue.'); return u;
}
const messages = {
  claimed: {manager:'A coverage request needs your approval.',worker:'Your coverage request was submitted. You are not assigned until a manager approves.'},
  approved: {claimant:'Your request was approved. You are assigned to this shift.',original:'Coverage was approved. You are no longer assigned to this shift.'},
  rejected: {claimant:'Your request was rejected. The original worker remains assigned.',original:'The coverage claim was rejected. You remain assigned; coverage has reopened.'},
  cancelled: {manager:'The original worker cancelled this coverage request. No assignment was transferred.',worker:'The original worker cancelled this coverage request. You were not assigned.'},
};
export async function listNotifications(store,userId,before=null,now=Date.now()) {
  const db=await store.read(),user=account(db,userId);
  const own=(db.notifications || []).filter(n=>n.userId===user.id && n.businessId===user.businessId).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id));
  const offset=before===null ? 0 : own.findIndex(n=>n.id===before)+1;
  if (before!==null && offset===0) throw new HttpError(400,'Refresh notifications to start again.');
  const page=own.slice(offset,offset+20);
  return {unreadCount:own.filter(n=>n.readAt===null).length, next:offset+page.length<own.length?page.at(-1).id:null,notifications:page.map(n=>{
    const r=db.coverageRequests.find(r=>r.id===n.requestId),shift=db.shifts.find(s=>s.id===r.shiftId);
    const audience=['approved','rejected'].includes(n.action)?(user.id===r.claimantId?'claimant':'original'):user.role;
    return {id:n.id,title:shift.title,message:messages[n.action][audience],createdAt:n.createdAt,readAt:n.readAt,currentStatus:coverageDisplayState(r,shift,now).displayStatus,href:`/workspace/${user.role}/history?request=${r.id}`};
  })};
}
export async function markNotificationsRead(store,userId,input,clock=Date.now) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length!==1 || !Array.isArray(input.ids) || input.ids.length<1 || input.ids.length>100 || input.ids.some(id=>typeof id!=='string'||! /^[a-f0-9]{64}$/.test(id)) || new Set(input.ids).size!==input.ids.length) throw new HttpError(400,'Choose up to 100 displayed notifications.');
  return store.transaction(db=>{
    const user=account(db,userId),records=input.ids.map(id=>(db.notifications||[]).find(n=>n.id===id && n.userId===user.id && n.businessId===user.businessId));
    if (records.some(n=>!n)) throw new HttpError(404,'Notification not found.');
    for (const n of records) if(n.readAt===null)n.readAt=new Date(Math.max(clock(),Date.parse(n.createdAt))).toISOString();
    return {message:'Selected notifications marked as read.'};
  });
}
