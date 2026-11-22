import { createHash, randomUUID } from 'node:crypto';
import { HttpError } from '../auth/errors.js';
import { coverageAccount } from '../requests/coverage.js';
import { businessInstant } from '../shifts/create.js';
export function availabilityAccount(db, userId) {
  const account = coverageAccount(db, userId);
  if (account.user.deactivation) throw new HttpError(401, 'Please sign in to continue.');
  return account;
}
export const ruleRevision = rule => createHash('sha256').update(JSON.stringify(rule)).digest('hex');
export const ruleStatus = (rule, now) => rule.status === 'cancelled' ? 'cancelled' : Date.parse(rule.endsAt) <= now ? 'expired' : rule.status;
export function availabilityFields(input, timezone, now, requireFuture = true) {
  const keys = ['startLocal','endLocal','title','maxClaims','timezone'];
  if (!input || Array.isArray(input) || Object.keys(input).length !== keys.length || !keys.every(k => Object.hasOwn(input,k)) || input.timezone !== timezone) throw new HttpError(422, 'Review the exact availability window in your current business timezone.');
  if (typeof input.title !== 'string' || input.title.length > 100 || /[\x00-\x1f]/.test(input.title) || !Number.isInteger(input.maxClaims) || input.maxClaims < 1 || input.maxClaims > 5) throw new HttpError(422, 'Use an optional title up to 100 characters and a maximum of 1–5 claims.');
  const startsAt = businessInstant(input.startLocal, timezone, 'startLocal');
  const endsAt = businessInstant(input.endLocal, timezone, 'endLocal');
  const wallDuration = Date.parse(input.endLocal + 'Z') - Date.parse(input.startLocal + 'Z');
  if (wallDuration <= 0 || wallDuration > 86400000) throw new HttpError(422, 'Choose one availability window of up to 24 local hours; overnight must end on the next day.');
  if (requireFuture && (Date.parse(startsAt) <= now || Date.parse(startsAt) > now + 90 * 86400000)) throw new HttpError(422, 'Availability must start in the future, within the next 90 days.');
  return { startsAt, endsAt, timezone, title: input.title.trim(), maxClaims: input.maxClaims };
}
const dto = (rule, now) => ({ ...rule, status: ruleStatus(rule, now), revision: ruleRevision(rule) });
export async function listAvailability(store, userId, clock = Date.now) {
  const db = await store.read(); const {user,business} = availabilityAccount(db,userId); const now = clock();
  return { rules: (db.availabilityRules || []).filter(r => r.workerId === user.id && r.businessId === business.id).sort((a,b) => b.confirmedAt.localeCompare(a.confirmedAt) || b.id.localeCompare(a.id)).map(r => dto(r,now)), timezone: business.timezone, matchingEnabled: false };
}
export async function confirmAvailability(store, userId, input, clock = Date.now) {
  if (!input || Array.isArray(input) || Object.keys(input).length !== 2 || typeof input.confirmationId !== 'string' || !/^[a-f0-9-]{36}$/.test(input.confirmationId) || !input.draft) throw new HttpError(422, 'Confirm only the availability draft shown in this chat.');
  return store.transaction(db => {
    const {user,business} = availabilityAccount(db,userId); const now=clock();
    const values=availabilityFields(input.draft,business.timezone,now,false);
    const existing=(db.availabilityRules || []).find(r => r.workerId === user.id && r.confirmationId === input.confirmationId);
    if (existing) {
      if (existing.businessId !== business.id || Object.keys(values).some(k => existing[k] !== values[k])) throw new HttpError(409,'This confirmation was already used for different availability. Refresh saved rules.');
      return {rule:dto(existing,now),matchingEnabled:false,message:'This availability confirmation was already saved. Check its current status.'};
    }
    availabilityFields(input.draft,business.timezone,now);
    const mine=(db.availabilityRules || []).filter(r=>r.workerId===user.id && r.businessId===business.id);
    if(mine.length>=100 || mine.filter(r=>['active','paused'].includes(ruleStatus(r,now))).length>=20) throw new HttpError(409,'You have reached the saved-rule limit (20 current, 100 total). Cancel an unused current rule or contact your manager.');
    const last=(db.availabilityRules || []).reduce((value,r)=>Math.max(value,Date.parse(r.confirmedAt)),0);
    const at=new Date(Math.max(now,last+1)).toISOString();
    const rule={id:randomUUID(),businessId:business.id,workerId:user.id,...values,confirmationId:input.confirmationId,status:'active',confirmedAt:at,createdAt:at,updatedAt:at};
    db.schemaVersion=Math.max(db.schemaVersion,6);db.availabilityRules ||= []; db.availabilityRules.push(rule);
    return {rule:dto(rule,now),matchingEnabled:false,message:'Availability saved. Automatic matching is not running yet; manager approval will be required for future claims.'};
  });
}
export async function changeAvailability(store,userId,ruleId,action,input,clock=Date.now) {
  if(!['pause','resume','cancel'].includes(action) || !input || Array.isArray(input) || Object.keys(input).length!==1 || typeof input.revision!=='string' || !/^[a-f0-9]{64}$/.test(input.revision)) throw new HttpError(422,'Submit only the current rule revision.');
  return store.transaction(db=>{
    const {user,business}=availabilityAccount(db,userId); const now=clock();
    const rule=(db.availabilityRules || []).find(r=>r.id===ruleId && r.workerId===user.id && r.businessId===business.id);
    if(!rule)throw new HttpError(404,'Availability rule not found. Refresh saved rules.');
    if(ruleRevision(rule)!==input.revision)throw new HttpError(409,'This rule changed. Refresh saved rules before trying again.');
    const state=ruleStatus(rule,now);
    if(['cancelled','expired'].includes(state) || action==='pause' && state!=='active' || action==='resume' && state!=='paused')throw new HttpError(409,'This action is no longer available. Refresh saved rules.');
    if(action==='resume' && rule.timezone!==business.timezone)throw new HttpError(409,'Your business timezone changed. Cancel this rule and confirm a new window.');
    rule.status={pause:'paused',resume:'active',cancel:'cancelled'}[action];rule.updatedAt=new Date(Math.max(now,Date.parse(rule.updatedAt)+1)).toISOString();
    return {rule:dto(rule,now),matchingEnabled:false,message:`Availability ${action==='resume'?'resumed':action==='pause'?'paused':'cancelled'}. Automatic matching is not running yet.`};
  });
}
