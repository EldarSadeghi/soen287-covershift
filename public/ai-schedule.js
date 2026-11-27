import {responseHeader,responseStats,responseFields,responseNote,responseDetails,checkedMeta,localDate,savedShiftFields} from './ai-response-card.js';
import {formatShiftTime} from './shift-time.js';
import { element,shiftCard } from './shift-card.js';
import {requestJSON} from './request.js';
export function scheduleAnswerMessage(data){
 const date=new Intl.DateTimeFormat(undefined,{timeZone:'UTC',dateStyle:'medium'});
 const period=data.query.kind==='next'?'Next upcoming assigned shift':`${date.format(new Date(data.query.startDate+'T12:00:00Z'))} – ${date.format(new Date(Date.parse(data.query.endDate+'T12:00:00Z')-86400000))}`;
 const checked=new Intl.DateTimeFormat(undefined,{timeZone:data.timezone,dateStyle:'medium',timeStyle:'short'}).format(new Date(data.asOf));
 return `${period} · ${data.scope}: ${data.total} assigned shift${data.total===1?'':'s'}, ${data.totalHours} scheduled hours${data.clippedToWindow?' within this window':''}. ${data.pendingClaims} pending coverage claim${data.pendingClaims===1?'':'s'} excluded from hours. Checked ${checked} (${data.timezone}).`;
}
export function appendShiftDuties(container, shift) {
 if (!shift.duties?.length) return;
 const section=element('section','shift-duties');
 section.setAttribute('aria-label','Shift duties');
 const list=element('ul');
 for(const duty of shift.duties.slice(0,10)) list.append(element('li','',duty));
 section.append(element('h4','','Shift duties'),list);
 container.append(section);
}
export function showScheduleAnswer(card,data,{dutiesFocus=false}={}){
 card.replaceChildren();card.hidden=false;
 const next=data.query.kind==='next',shift=data.shifts[0];
 const title=!data.total?'No assigned shifts found.':next?'Here’s your next shift.':`${data.scope==='Entire team'?'Your team':data.scope} is scheduled for ${data.totalHours} hours.`;
 responseHeader(card,next&&data.total?'Assigned':'Saved schedule · Read only',title);
 if(dutiesFocus)card.append(responseMetaLine('Focused on shift duties'));
 if(next && shift){const t=formatShiftTime(shift,data.timezone);card.append(responseStats([[new Intl.DateTimeFormat(undefined,{timeZone:data.timezone,month:'short',day:'numeric'}).format(new Date(shift.startsAt)),'Next assigned shift'],[t.duration,'Scheduled duration']]),savedShiftFields(shift,data.timezone,shift.workerName));appendShiftDuties(card,shift);const link=element('a','ai-chat-review','View saved shift');link.href=shift.href;card.append(link);}
 else {
  const last=next?null:new Date(Date.parse(data.query.endDate+'T12:00:00Z')-86400000).toISOString().slice(0,10);
  if(!next)card.append(responseMetaLine(`${localDate(data.query.startDate)} – ${localDate(last)} · ${data.scope}`));
  card.append(responseStats([[`${data.totalHours} h`,'Assigned hours'],[data.total,'Assigned shifts']]));
  if(!data.total)card.append(element('p','',next?'No upcoming assigned shift is saved.':'No assigned work overlaps these dates.'));
  for(const s of data.shifts){const t=formatShiftTime(s,data.timezone),item=element('article','ai-response-shift');const details=element('div','');details.append(element('h4','',s.title),element('p','',t.date),element('p','',`${t.startTime} – ${t.endDate?t.endDate+' · ':''}${t.endTime}`),element('p','ai-response-meta',`Assigned to ${s.workerName}`));appendShiftDuties(details,s);const duration=element('span','ai-response-duration',t.duration);const link=element('a','','View saved shift');link.href=s.href;details.append(link);item.append(details,duration);card.append(item);}
 }
 if(data.pendingClaims)card.append(responseNote(`${data.pendingClaims} ${next?'upcoming ':''}request${data.pendingClaims===1?'':'s'} awaiting approval. Not included in assigned hours.`));
 if(data.total>data.shifts.length)card.append(responseMetaLine(`Showing ${data.shifts.length} of ${data.total} shifts. Totals include every matching shift; ask for a narrower window to see the rest.`));
 card.append(responseDetails('How this answer is calculated',next?'Next means the earliest assigned shift starting at or after the checked time. Pending coverage is not assigned work.':'Hours use actual elapsed time inside these dates, including overlapping overnight portions and daylight-saving changes. Pending claims are excluded. Team totals sum employee hours; break deductions are not applied.'),checkedMeta(data.asOf,data.timezone));
 if(!next||!shift){const schedule=element('a','ai-chat-review','Open saved schedule');schedule.href=data.scheduleHref;card.append(schedule);}
 card.append(responseMetaLine('Snapshot of saved work. Ask again to check for changes.'));
}
function responseMetaLine(text){return element('p','ai-response-meta',text);}
export async function mountSelectedScheduleShift(main){
 const id=new URLSearchParams(location.search).get('shift');if(!id)return;
 const box=element('section','panel');box.setAttribute('aria-label','Selected saved shift');main.prepend(box);
 async function load(){box.replaceChildren(element('p','','Loading selected shift…'));
  try{if(!/^[a-zA-Z0-9_-]{1,80}$/.test(id))throw Error();const r=await requestJSON('/api/schedule-shifts/'+id,{cache:'no-store'});if(r.status===401){location.replace('/login?expired=1');return;}if(!r.ok)throw Error();box.replaceChildren(element('h2','','Selected saved shift'),shiftCard(r.data.shift,r.data.timezone,{workerName:r.data.shift.workerName}),element('p','section-note','Current saved assignment. This detail is read-only.'));}
  catch{const retry=element('button','logout-button','Retry selected shift');retry.type='button';retry.addEventListener('click',load);box.replaceChildren(element('p','','This shift could not be loaded or is no longer in your assigned schedule.'),retry);}
 }await load();
}
