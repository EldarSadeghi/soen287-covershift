import {randomUUID} from 'node:crypto';
import {hashPassword} from '../auth/passwords.js';
import {createShift,businessInstant} from '../shifts/create.js';
import {requestCoverage,cancelCoverage,coverageShiftRevision,requestRevision} from '../requests/coverage.js';
import {claimCoverage,claimRevision} from '../requests/claim.js';
import {reviewCoverage} from '../requests/review.js';
import {confirmAvailability,changeAvailability} from '../availability/rules.js';
import {withAvailabilityMatching} from '../availability/matching.js';
import {markNotificationsRead} from '../notifications/service.js';
// Public fictional local-demo identities, never real account credentials.
export const DEMO_PASSWORD='CoverShift demo access!';
export const DEMO_ACCOUNTS=[['manager_morgan','Morgan Chen','manager'],['worker_jamie','Jamie Lee','worker'],['worker_alex','Alex Morgan','worker'],['worker_sam','Sam Rivera','worker'],['worker_taylor','Taylor Brooks','worker']].map(([id,name,role])=>({id,name,role,email:`${id}@example.test`}));
export function assertLocalDemo(environment=process.env.NODE_ENV){if(environment==='production')throw new Error('Demo preparation and startup are disabled in production.');}
export function demoCalendar(now,timezone='America/Toronto'){
 const p=new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const today=['year','month','day'].map(k=>p.find(x=>x.type===k).value).join('-'),base=new Date(today+'T12:00:00Z');
 const offset=(4-base.getUTCDay()+7)%7||7,day=n=>new Date(base.getTime()+n*86400000).toISOString().slice(0,10);
 const result={today,thursday:day(offset),friday:day(offset+1),saturday:day(offset+2),sunday:day(offset+3),historyApproved:day(-2),historyCancelled:day(-1)};
 if(Object.values(result).some(d=>!/^20\d{2}-\d{2}-\d{2}$/.test(d)))throw new Error('Demo dates must stay between 2000 and 2099.');return result;
}
export async function buildDemoFixtures(raw,{now=Date.now(),timezone='America/Toronto',hash=hashPassword}={}){
 assertLocalDemo();const dates=demoCalendar(now,timezone),businessId='business_demo_'+randomUUID().slice(0,8),createdAt=new Date(now-30*86400000).toISOString(),passwordHash=await hash(DEMO_PASSWORD);
 await raw.initialize();await raw.transaction(db=>{if(Object.values(db).some(v=>Array.isArray(v)&&v.length))throw new Error('Demo fixtures refuse to replace a populated database.');Object.assign(db,{schemaVersion:1,businesses:[{id:businessId,name:'CoverShift Demo Café',timezone,createdAt,updatedAt:createdAt}],users:DEMO_ACCOUNTS.map(u=>({...u,businessId,passwordHash,createdAt,updatedAt:createdAt})),shifts:[],coverageRequests:[]});});
 let time=now;const clock=()=>time;const store=withAvailabilityMatching(raw,clock);
 async function shift(worker,title,date,start,end,at=now){time=at;const {shift}=await createShift(store,'manager_morgan',{assignedWorkerId:worker,title,startLocal:`${date}T${start}`,endLocal:`${date}T${end}`},clock);await raw.transaction(db=>{const s=db.shifts.find(s=>s.id===shift.id);s.createdAt=s.updatedAt=new Date(at).toISOString();});return shift.id;}
 async function open(worker,shiftId,at=now){time=at;const db=await raw.read(),s=db.shifts.find(s=>s.id===shiftId);return (await requestCoverage(store,worker,shiftId,{revision:coverageShiftRevision(db,s)},clock)).request.id;}
 async function revision(requestId){const db=await raw.read(),r=db.coverageRequests.find(r=>r.id===requestId);return claimRevision(r,db.shifts.find(s=>s.id===r.shiftId));}
 // History is produced by real workflow services at an earlier simulation time.
 const historyTime=Date.parse(businessInstant(dates.historyApproved+'T08:00',timezone,'history'))-86400000;
 const pastApproved=await shift('worker_alex','Completed coverage',dates.historyApproved,'09:00','12:00',historyTime);
 const approvedRequest=await open('worker_alex',pastApproved,historyTime+1000);time+=1000;await claimCoverage(store,'worker_jamie',approvedRequest,{revision:await revision(approvedRequest)},clock);time+=1000;await reviewCoverage(store,'manager_morgan',approvedRequest,'approve',{revision:await revision(approvedRequest)},clock);
 const pastCancelled=await shift('worker_sam','Cancelled coverage',dates.historyCancelled,'09:00','12:00',historyTime);
 const cancelledRequest=await open('worker_sam',pastCancelled,historyTime+4000);time+=1000;let db=await raw.read();await cancelCoverage(store,'worker_sam',cancelledRequest,{revision:requestRevision(db.coverageRequests.find(r=>r.id===cancelledRequest))},clock);
 // Old historical receipts start read; the current pending request starts unread.
 db=await raw.read();for(const u of DEMO_ACCOUNTS){const ids=(db.notifications||[]).filter(n=>n.userId===u.id).map(n=>n.id);if(ids.length)await markNotificationsRead(store,u.id,{ids},()=>now);}
 const assignedThursday=await shift('worker_jamie','Opening service',dates.thursday,'09:00','12:00');
 const assignedFriday=await shift('worker_jamie','Afternoon service',dates.friday,'14:00','18:00');
 const manualShift=await shift('worker_alex','Afternoon coverage',dates.thursday,'14:00','17:00');const manualRequest=await open('worker_alex',manualShift);
 const pendingShift=await shift('worker_alex','Morning coverage',dates.friday,'09:00','12:00');const pendingRequest=await open('worker_alex',pendingShift);time=now+1000;await claimCoverage(store,'worker_jamie',pendingRequest,{revision:await revision(pendingRequest)},clock);
 time=now+2000;const draft={startLocal:dates.saturday+'T14:00',endLocal:dates.saturday+'T18:00',title:'Weekend service',maxClaims:1,timezone};const {rule}=await confirmAvailability(store,'worker_jamie',{confirmationId:randomUUID(),draft},clock);time+=1000;await changeAvailability(store,'worker_jamie',rule.id,'pause',{revision:rule.revision},clock);
 const automaticShift=await shift('worker_alex','Weekend service',dates.saturday,'14:00','17:00');const automaticRequest=await open('worker_alex',automaticShift);
 return {version:1,createdAt:new Date(now).toISOString(),businessId,timezone,dates,scenarios:{assignedThursday,assignedFriday,manualShift,manualRequest,pendingShift,pendingRequest,automaticShift,automaticRequest,availabilityRule:rule.id,approvedRequest,cancelledRequest}};
}
